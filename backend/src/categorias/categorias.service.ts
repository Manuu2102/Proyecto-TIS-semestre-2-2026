import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { CrearCategoriaDto } from './dto/crear-categoria.dto.js';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto.js';
import { ConsultarCategoriasDto } from './dto/consultar-categorias.dto.js';
import { registrarAuditoria } from '../lib/auditoria.js';
import { leerOpcional, obligatorio } from '../lib/validacion.js';

const serialize = <T>(data: T): T =>
  JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );

type Tipo = 'ingreso' | 'gasto';

/**
 * HU-17: categorías de ingresos y gastos. Nombre único dentro de cada tipo (sin importar
 * mayúsculas ni espacios al inicio o al final). Los movimientos guardan el id, así que un
 * cambio de nombre se ve en todos ellos. Cada cambio queda en auditoría junto con el cambio.
 */
@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  private leerNombre(valor: unknown) {
    const nombre = typeof valor === 'string' ? valor.trim() : '';
    if (!nombre) throw new BadRequestException(obligatorio('nombre'));
    if (nombre.length > 100) throw new BadRequestException('El nombre admite como máximo 100 caracteres.');
    return nombre;
  }

  /** Rechaza un nombre que ya existe en el mismo tipo (HU-17 #3). */
  private async validarDuplicado(db: Prisma.TransactionClient, tipo: string, nombre: string, excluirId?: bigint) {
    const existente = await db.categoria_movimiento.findFirst({
      where: {
        tipo,
        nombre: { equals: nombre, mode: 'insensitive' },
        ...(excluirId && { id: { not: excluirId } }),
      },
    });
    if (existente) {
      throw new ConflictException(
        `Ya existe una categoría de ${tipo} llamada "${existente.nombre}". No se permiten categorías duplicadas.`,
      );
    }
  }

  async crear(dto: CrearCategoriaDto, idUsuario: string) {
    const nombre = this.leerNombre(dto.nombre);
    const tipo = String(dto.tipo ?? '').trim().toLowerCase();
    if (!tipo) throw new BadRequestException(obligatorio('tipo'));
    if (tipo !== 'ingreso' && tipo !== 'gasto') {
      throw new BadRequestException('El tipo debe ser ingreso o gasto.');
    }
    const descripcion = leerOpcional(dto.descripcion, 'descripción');

    const categoria = await this.prisma.$transaction(async (tx) => {
      await this.validarDuplicado(tx, tipo, nombre);
      const nueva = await tx.categoria_movimiento.create({
        data: { nombre, tipo: tipo as Tipo, descripcion, activa: dto.activa ?? true },
      });
      await registrarAuditoria(tx, {
        tabla: 'categoria_movimiento',
        registroId: nueva.id,
        accion: 'CREAR',
        despues: nueva,
        usuarioId: idUsuario,
      });
      return nueva;
    });

    return { ...serialize(categoria), message: `Categoría "${categoria.nombre}" creada.` };
  }

  async listar(filtros: ConsultarCategoriasDto) {
    const categorias = await this.prisma.categoria_movimiento.findMany({
      where: {
        ...(filtros.tipo && { tipo: filtros.tipo }),
        ...(filtros.activa !== undefined && { activa: filtros.activa }),
      },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
      // Cuántos movimientos usan cada categoría
      include: { _count: { select: { ingreso: true, gasto: true } } },
    });

    return {
      total: categorias.length,
      categorias: categorias.map(({ _count, ...c }) =>
        serialize({ ...c, movimientos: _count.ingreso + _count.gasto }),
      ),
    };
  }

  async buscarPorId(id: bigint) {
    const categoria = await this.prisma.categoria_movimiento.findUnique({ where: { id } });
    if (!categoria) {
      throw new NotFoundException(`La categoría #${id} no existe.`);
    }
    return categoria;
  }

  async actualizar(id: bigint, dto: ActualizarCategoriaDto, idUsuario: string) {
    const nombre = dto.nombre !== undefined ? this.leerNombre(dto.nombre) : undefined;

    const categoria = await this.prisma.$transaction(async (tx) => {
      const anterior = await tx.categoria_movimiento.findUnique({ where: { id } });
      if (!anterior) throw new NotFoundException(`La categoría #${id} no existe.`);
      if (nombre !== undefined) await this.validarDuplicado(tx, anterior.tipo, nombre, id);

      const actualizada = await tx.categoria_movimiento.update({
        where: { id },
        data: {
          ...(nombre !== undefined && { nombre }),
          ...(dto.descripcion !== undefined && { descripcion: dto.descripcion.trim() || null }),
          ...(dto.activa !== undefined && { activa: dto.activa }),
          updated_at: new Date(),
        },
      });
      await registrarAuditoria(tx, {
        tabla: 'categoria_movimiento',
        registroId: id,
        accion: 'ACTUALIZAR',
        antes: anterior,
        despues: actualizada,
        usuarioId: idUsuario,
      });
      return actualizada;
    });

    return { ...serialize(categoria), message: `Categoría "${categoria.nombre}" actualizada.` };
  }

  /** Desactivar: la categoría deja de ofrecerse, pero los movimientos que la usan se conservan. */
  async desactivar(id: bigint, idUsuario: string) {
    const categoria = await this.prisma.$transaction(async (tx) => {
      const anterior = await tx.categoria_movimiento.findUnique({ where: { id } });
      if (!anterior) throw new NotFoundException(`La categoría #${id} no existe.`);
      if (!anterior.activa) throw new BadRequestException(`La categoría "${anterior.nombre}" ya está desactivada.`);

      const desactivada = await tx.categoria_movimiento.update({
        where: { id },
        data: { activa: false, updated_at: new Date() },
      });
      await registrarAuditoria(tx, {
        tabla: 'categoria_movimiento',
        registroId: id,
        accion: 'DESACTIVAR',
        antes: anterior,
        despues: desactivada,
        usuarioId: idUsuario,
      });
      return desactivada;
    });

    return { ...serialize(categoria), message: `Categoría "${categoria.nombre}" desactivada.` };
  }
}
