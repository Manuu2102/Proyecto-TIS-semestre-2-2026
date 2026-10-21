import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearIngresoDto } from './dto/crear-ingreso.dto.js';
import { ConsultarIngresosDto } from './dto/consultar-ingresos.dto.js';
import { AnularIngresoDto } from './dto/anular-ingreso.dto.js';

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
export class IngresosService {
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
    if (categoria.tipo !== 'ingreso') {
      throw new BadRequestException(
        'La categoría seleccionada no es de tipo "ingreso"',
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
    dto: CrearIngresoDto,
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

    const creado = await this.prisma.ingreso.create({
      data: {
        fecha: new Date(dto.fecha),
        monto: dto.monto.toFixed(2),
        id_categoria: BigInt(dto.id_categoria),
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
        categoria_movimiento: { select: { id: true, nombre: true, tipo: true } },
      },
    });
    // En el schema la relación se llama categoria_movimiento; la API sigue respondiendo "categoria"
    const { categoria_movimiento: categoria, ...resto } = creado;
    const ingreso = { ...resto, categoria };

    await this.registrarAuditoria(ingreso.id, 'CREAR', null, ingreso, idUsuario);

    return serialize(ingreso);
  }

  async listar(filtros: ConsultarIngresosDto) {
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

    const ingresos = await this.prisma.ingreso.findMany({
      where,
      include: {
        categoria_movimiento: { select: { id: true, nombre: true, tipo: true } },
      },
      orderBy: { fecha: 'desc' },
    });

    const ingresosSinContenido = ingresos.map((i) => {
      const { comprobante_contenido, categoria_movimiento, ...resto } = i;
      void comprobante_contenido;
      return { ...resto, categoria: categoria_movimiento };
    });

    return {
      total: ingresos.length,
      ingresos: ingresosSinContenido.map(serialize),
    };
  }

  async anular(id: bigint, dto: AnularIngresoDto, idUsuario: string) {
    const ingreso = await this.prisma.ingreso.findUnique({ where: { id } });
    if (!ingreso) {
      throw new NotFoundException(`Ingreso con id ${id} no encontrado`);
    }
    if (ingreso.anulado) {
      throw new BadRequestException('El ingreso ya está anulado');
    }

    const anulado = await this.prisma.ingreso.update({
      where: { id },
      data: {
        anulado: true,
        motivo_anulacion: dto.motivo_anulacion.trim(),
        updated_at: new Date(),
      },
    });

    await this.registrarAuditoria(id, 'ANULAR', ingreso, anulado, idUsuario);

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
          tabla_afectada: 'ingreso',
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