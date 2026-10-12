import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearCategoriaDto } from './dto/crear-categoria.dto.js';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto.js';
import { ConsultarCategoriasDto } from './dto/consultar-categorias.dto.js';

const serialize = <T>(data: T): T =>
  JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(dto: CrearCategoriaDto, idUsuario: string) {
    const nombreTrim = dto.nombre.trim();
    if (!nombreTrim) {
      throw new BadRequestException('El nombre es obligatorio');
    }

    // Verificar duplicado por nombre + tipo (ignorando mayúsculas y espacios)
    const existente = await this.prisma.categoria_movimiento.findFirst({
      where: {
        tipo: dto.tipo,
        nombre: {
          equals: nombreTrim,
          mode: 'insensitive',
        },
      },
    });
    if (existente) {
      throw new ConflictException(
        `Ya existe una categoría de tipo "${dto.tipo}" con ese nombre`,
      );
    }

    const categoria = await this.prisma.categoria_movimiento.create({
      data: {
        nombre: nombreTrim,
        tipo: dto.tipo,
        descripcion: dto.descripcion?.trim() || null,
        activa: dto.activa ?? true,
      },
    });

    await this.registrarAuditoria(
      categoria.id,
      'CREAR',
      null,
      categoria,
      idUsuario,
    );

    return serialize(categoria);
  }

  async listar(filtros: ConsultarCategoriasDto) {
    const where: Record<string, unknown> = {};
    if (filtros.tipo) where.tipo = filtros.tipo;
    if (filtros.activa !== undefined) where.activa = filtros.activa;

    const categorias = await this.prisma.categoria_movimiento.findMany({
      where,
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    });

    return {
      total: categorias.length,
      categorias: categorias.map(serialize),
    };
  }

  async buscarPorId(id: bigint) {
    const categoria = await this.prisma.categoria_movimiento.findUnique({
      where: { id },
    });
    if (!categoria) {
      throw new NotFoundException(`Categoría con id ${id} no encontrada`);
    }
    return categoria;
  }

  async actualizar(id: bigint, dto: ActualizarCategoriaDto, idUsuario: string) {
    const categoriaAnterior = await this.buscarPorId(id);

    if (dto.nombre !== undefined) {
      const nombreTrim = dto.nombre.trim();
      if (!nombreTrim) {
        throw new BadRequestException('El nombre no puede estar vacío');
      }
      const existente = await this.prisma.categoria_movimiento.findFirst({
        where: {
          id: { not: id },
          tipo: categoriaAnterior.tipo,
          nombre: {
            equals: nombreTrim,
            mode: 'insensitive',
          },
        },
      });
      if (existente) {
        throw new ConflictException(
          `Ya existe una categoría de tipo "${categoriaAnterior.tipo}" con ese nombre`,
        );
      }
    }

    const categoria = await this.prisma.categoria_movimiento.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
        ...(dto.descripcion !== undefined && {
          descripcion: dto.descripcion?.trim() || null,
        }),
        ...(dto.activa !== undefined && { activa: dto.activa }),
        updated_at: new Date(),
      },
    });

    await this.registrarAuditoria(
      id,
      'ACTUALIZAR',
      categoriaAnterior,
      categoria,
      idUsuario,
    );

    return serialize(categoria);
  }

  async desactivar(id: bigint, idUsuario: string) {
    const categoriaAnterior = await this.buscarPorId(id);

    const categoria = await this.prisma.categoria_movimiento.update({
      where: { id },
      data: { activa: false, updated_at: new Date() },
    });

    await this.registrarAuditoria(
      id,
      'DESACTIVAR',
      categoriaAnterior,
      categoria,
      idUsuario,
    );

    return serialize(categoria);
  }

  private async registrarAuditoria(
    registroId: bigint,
    accion: string,
    datosAnteriores: unknown,
    datosNuevos: unknown,
    idUsuario: string,
  ) {
    try {
      await this.prisma.auditoria.create({
        data: {
          usuario_id: idUsuario,
          tabla_afectada: 'categoria_movimiento',
          registro_id: registroId.toString(),
          accion,
          datos_anteriores: datosAnteriores
            ? JSON.parse(
                JSON.stringify(datosAnteriores, (_, v) =>
                  typeof v === 'bigint' ? v.toString() : v,
                ),
              )
            : null,
          datos_nuevos: datosNuevos
            ? JSON.parse(
                JSON.stringify(datosNuevos, (_, v) =>
                  typeof v === 'bigint' ? v.toString() : v,
                ),
              )
            : null,
        },
      });
    } catch (e) {
      console.error('Error al registrar auditoría:', e);
    }
  }
}