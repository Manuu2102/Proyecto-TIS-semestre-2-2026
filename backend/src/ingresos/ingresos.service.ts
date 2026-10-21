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

    // TRANSACCIÓN: Guardar ingreso y actualizar caja
    const ingreso = await this.prisma.$transaction(async (tx) => {
      const nuevoIngreso = await tx.ingreso.create({
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
          categoria: { select: { id: true, nombre: true, tipo: true } },
        },
      });

      // Si es efectivo, afectar la caja
      if (dto.metodo === 'efectivo') {
        let caja = await tx.caja.findFirst();
        if (!caja) caja = await tx.caja.create({ data: { abierta: false } });
        
        if (!caja.abierta) {
          throw new BadRequestException('La caja está cerrada. No se puede registrar efectivo.');
        }

        const movs = await tx.movimiento_caja.findMany({ where: { caja_id: caja.id, anulado: false } });
        let saldo = Number(caja.monto_apertura || 0);
        movs.forEach(m => saldo += (m.tipo === 'ENTRADA' ? Number(m.monto) : -Number(m.monto)));
        
        const nuevoSaldo = saldo + dto.monto;
        const year = new Date().getFullYear();
        const count = await tx.movimiento_caja.count();
        const numero = `CAJ-${year}-${String(count + 1).padStart(6, '0')}`;

        await tx.movimiento_caja.create({
          data: {
            caja_id: caja.id,
            numero,
            fecha: new Date(dto.fecha),
            hora: new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }),
            tipo: 'ENTRADA',
            monto: dto.monto.toFixed(2),
            concepto: `Ingreso: ${dto.descripcion || 'Sin descripción'}`,
            origen: 'Ingreso',
            saldo_posterior: nuevoSaldo.toFixed(2),
            id_usuario: idUsuario,
            id_referencia: nuevoIngreso.id,
          },
        });
      }

      return nuevoIngreso;
    });

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
        categoria: { select: { id: true, nombre: true, tipo: true } },
      },
      orderBy: { fecha: 'desc' },
    });

    const ingresosSinContenido = ingresos.map((i) => {
      const { comprobante_contenido, ...resto } = i;
      void comprobante_contenido;
      return resto;
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

    // Si fue en efectivo, revertir la caja
    if (ingreso.metodo === 'efectivo') {
      await this.prisma.$transaction(async (tx) => {
        let caja = await tx.caja.findFirst();
        if (caja && caja.abierta) {
          const movs = await tx.movimiento_caja.findMany({ where: { caja_id: caja.id, anulado: false } });
          let saldo = Number(caja.monto_apertura || 0);
          movs.forEach(m => saldo += (m.tipo === 'ENTRADA' ? Number(m.monto) : -Number(m.monto)));
          
          const nuevoSaldo = saldo - Number(ingreso.monto);
          const year = new Date().getFullYear();
          const count = await tx.movimiento_caja.count();
          const numero = `CAJ-${year}-${String(count + 1).padStart(6, '0')}`;

          await tx.movimiento_caja.create({
            data: {
              caja_id: caja.id,
              numero,
              fecha: new Date(),
              hora: new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }),
              tipo: 'SALIDA',
              monto: ingreso.monto,
              concepto: `Anulación Ingreso: ${ingreso.descripcion || ''}`,
              origen: 'Anulación',
              saldo_posterior: nuevoSaldo.toFixed(2),
              id_usuario: idUsuario,
              id_referencia: ingreso.id,
            },
          });
        }
      });
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