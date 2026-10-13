import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearGastoDto } from './dto/crear-gasto.dto.js';
import { ConsultarGastosDto } from './dto/consultar-gastos.dto.js';
import { AnularGastoDto } from './dto/anular-gasto.dto.js';

const serialize = <T>(data: T): T =>
  JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );

const TIPOS_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
];
const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class GastosService {
  constructor(private readonly prisma: PrismaService) {}

  private async validarCategoria(idCategoria: bigint) {
    const categoria = await this.prisma.categoria_movimiento.findUnique({
      where: { id: idCategoria },
    });
    if (!categoria) {
      throw new NotFoundException(
        `Categoría con id ${idCategoria} no encontrada`,
      );
    }
    if (categoria.tipo !== 'gasto') {
      throw new BadRequestException(
        'La categoría seleccionada no es de tipo "gasto"',
      );
    }
    if (!categoria.activa) {
      throw new BadRequestException('La categoría seleccionada está inactiva');
    }
    return categoria;
  }

  private validarFecha(fechaStr: string) {
    const fecha = new Date(fechaStr);
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    if (fecha > hoy) {
      throw new BadRequestException('La fecha no puede ser futura');
    }
  }

  async crear(
    dto: CrearGastoDto,
    archivo: Express.Multer.File | undefined,
    idUsuario: string,
  ) {
    this.validarFecha(dto.fecha);
    await this.validarCategoria(BigInt(dto.id_categoria));

    let comprobante: {
      nombre: string;
      contenido: Buffer;
      mime: string;
      peso: bigint;
    } | null = null;

    if (archivo) {
      if (!TIPOS_PERMITIDOS.includes(archivo.mimetype)) {
        throw new BadRequestException(
          'Formato no permitido. Solo PDF, JPG, JPEG, PNG',
        );
      }
      if (archivo.size > TAMANO_MAXIMO) {
        throw new BadRequestException('El archivo supera los 5 MB');
      }
      comprobante = {
        nombre: archivo.originalname,
        contenido: archivo.buffer,
        mime: archivo.mimetype,
        peso: BigInt(archivo.size),
      };
    }

    if (dto.metodo !== 'efectivo' && !dto.id_cuenta) {
      throw new BadRequestException(
        'Debes seleccionar una cuenta bancaria para transferencia o depósito',
      );
    }

    const gasto = await this.prisma.gasto.create({
      data: {
        fecha: new Date(dto.fecha),
        monto: dto.monto.toFixed(2),
        id_categoria: BigInt(dto.id_categoria),
        proveedor: dto.proveedor?.trim() || null,
        descripcion: dto.descripcion?.trim() || null,
        metodo: dto.metodo,
        id_cuenta: dto.id_cuenta ? BigInt(dto.id_cuenta) : null,
        id_usuario: idUsuario,
        comprobante_nombre: comprobante?.nombre ?? null,
        comprobante_contenido: comprobante
          ? Buffer.from(comprobante.contenido)
          : null,
        comprobante_mime: comprobante?.mime ?? null,
        comprobante_peso: comprobante?.peso ?? null,
      },
      include: {
        categoria: { select: { id: true, nombre: true, tipo: true } },
      },
    });

    await this.registrarAuditoria(gasto.id, 'CREAR', null, gasto, idUsuario);

    return serialize(gasto);
  }

  async listar(filtros: ConsultarGastosDto) {
    const where: Record<string, unknown> = {};

    if (filtros.fecha_desde || filtros.fecha_hasta) {
      where.fecha = {};
      if (filtros.fecha_desde) {
        (where.fecha as Record<string, Date>).gte = new Date(filtros.fecha_desde);
      }
      if (filtros.fecha_hasta) {
        (where.fecha as Record<string, Date>).lte = new Date(filtros.fecha_hasta);
      }
    }
    if (filtros.id_categoria) {
      where.id_categoria = BigInt(filtros.id_categoria);
    }
    if (filtros.anulado !== undefined) {
      where.anulado = filtros.anulado;
    }

    const gastos = await this.prisma.gasto.findMany({
      where,
      include: {
        categoria: { select: { id: true, nombre: true, tipo: true } },
      },
      orderBy: { fecha: 'desc' },
    });

    const gastosSinContenido = gastos.map((g) => {
      const { comprobante_contenido, ...resto } = g;
      void comprobante_contenido;
      return resto;
    });

    return {
      total: gastos.length,
      gastos: gastosSinContenido.map(serialize),
    };
  }

  async anular(id: bigint, dto: AnularGastoDto, idUsuario: string) {
    const gasto = await this.prisma.gasto.findUnique({ where: { id } });
    if (!gasto) {
      throw new NotFoundException(`Gasto con id ${id} no encontrado`);
    }
    if (gasto.anulado) {
      throw new BadRequestException('El gasto ya está anulado');
    }

    const anulado = await this.prisma.gasto.update({
      where: { id },
      data: {
        anulado: true,
        motivo_anulacion: dto.motivo_anulacion.trim(),
        updated_at: new Date(),
      },
    });

    await this.registrarAuditoria(id, 'ANULAR', gasto, anulado, idUsuario);

    return serialize(anulado);
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
          tabla_afectada: 'gasto',
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