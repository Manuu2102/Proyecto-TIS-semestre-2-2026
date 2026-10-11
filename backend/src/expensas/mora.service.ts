import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MoraService {
  private readonly logger = new Logger(MoraService.name);

  constructor(private readonly prisma: PrismaService) {}

  private calcularMoraMeses(
    fechaVencimiento: Date,
    moraValor: number,
    hoy: Date = new Date(),
  ): number {
    if (hoy <= fechaVencimiento) return 0;

    const unDia = 24 * 60 * 60 * 1000;
    const diasAtraso = Math.floor(
      (hoy.getTime() - fechaVencimiento.getTime()) / unDia,
    );
    const mesesAtraso = Math.floor(diasAtraso / 30);

    if (mesesAtraso <= 0) return 0;

    return mesesAtraso * Math.round(moraValor * 100);
  }

  async aplicarMoraMensual() {
    const hoy = new Date();

    const deudas = await this.prisma.pago_expensa.findMany({
      where: {
        fecha_vencimiento: { lt: hoy },
        estado_deuda: {
          nombre: { notIn: ['pagado', 'Pagado'] },
        },
      },
      include: {
        expensa: {
          select: {
            mora_valor: true,
          },
        },
        estado_deuda: true,
      },
    });

    if (deudas.length === 0) {
      this.logger.log('No hay deudas vencidas para aplicar mora');
      return { procesadas: 0, actualizadas: 0 };
    }

    const estados = await this.prisma.estado_deuda.findMany();
    const estadoVencido = estados.find(
      (e) => e.nombre?.toLowerCase() === 'vencido',
    );

    if (!estadoVencido) {
      throw new Error(
        'No existe el estado "vencido" en estado_deuda. Créalo antes de usar mora.',
      );
    }

    const actualizaciones: Array<{
      id: bigint;
      montoMora: string;
      idEstado: bigint;
    }> = [];

    for (const deuda of deudas) {
      const fechaVenc = deuda.fecha_vencimiento;
      if (!fechaVenc) continue;

      const moraValor = Number(deuda.expensa.mora_valor);
      if (moraValor <= 0) continue;

      const moraCents = this.calcularMoraMeses(fechaVenc, moraValor, hoy);
      if (moraCents === 0) continue;

      const montoMoraStr = (moraCents / 100).toFixed(2);
      const moraActualStr = Number(deuda.monto_mora).toFixed(2);

      const cambioMonto = montoMoraStr !== moraActualStr;
      const cambioEstado = deuda.id_estado !== estadoVencido.id;

      if (cambioMonto || cambioEstado) {
        actualizaciones.push({
          id: deuda.id,
          montoMora: montoMoraStr,
          idEstado: estadoVencido.id,
        });
      }
    }

    if (actualizaciones.length > 0) {
      await this.prisma.$transaction(
        actualizaciones.map((u) =>
          this.prisma.pago_expensa.update({
            where: { id: u.id },
            data: {
              monto_mora: u.montoMora,
              id_estado: u.idEstado,
            },
          }),
        ),
      );
    }

    this.logger.log(
      `Mora aplicada: ${actualizaciones.length} deudas actualizadas de ${deudas.length} procesadas`,
    );

    return {
      procesadas: deudas.length,
      actualizadas: actualizaciones.length,
      fechaEjecucion: hoy.toISOString(),
    };
  }

  async previsualizarMora(idPagoExpensa: bigint) {
    const deuda = await this.prisma.pago_expensa.findUnique({
      where: { id: idPagoExpensa },
      include: {
        expensa: {
          select: {
            mora_valor: true,
          },
        },
        estado_deuda: true,
      },
    });

    if (!deuda) return null;

    const fechaVenc = deuda.fecha_vencimiento;
    if (!fechaVenc) return null;

    const moraValor = Number(deuda.expensa.mora_valor);
    const moraCents = this.calcularMoraMeses(fechaVenc, moraValor);

    const montoBaseCents = Math.round(Number(deuda.monto) * 100);

    return {
      id: deuda.id.toString(),
      monto_base: (montoBaseCents / 100).toFixed(2),
      monto_mora_actual: Number(deuda.monto_mora).toFixed(2),
      monto_mora_calculada: (moraCents / 100).toFixed(2),
      total: ((montoBaseCents + moraCents) / 100).toFixed(2),
      fecha_vencimiento: fechaVenc.toISOString().slice(0, 10),
      estado: deuda.estado_deuda.nombre,
    };
  }
}