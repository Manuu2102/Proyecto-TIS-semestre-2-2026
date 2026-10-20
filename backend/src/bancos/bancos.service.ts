import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BancosService {
  constructor(private readonly prisma: PrismaService) {}

  async listarMovimientos(cuentaId?: bigint) {
    const where = cuentaId ? { cuenta_id: cuentaId } : {};
    const movs = await this.prisma.movimiento_banco.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return movs.map(m => JSON.parse(JSON.stringify(m, (_, v) => typeof v === 'bigint' ? v.toString() : v)));
  }

  async crearMovimiento(dto: any, idUsuario: string) {
    // DTO esperado: cuentaId, fecha, tipo, monto, signo, referencia, concepto, enCaja
    const cuenta = await this.prisma.cuenta_bancaria.findUnique({ where: { id: BigInt(dto.cuentaId) } });
    if (!cuenta || !cuenta.activa) throw new BadRequestException('Cuenta inválida o inactiva');

    // Calcular saldo cuenta (apertura + movimientos vigentes)
    const movsVigentes = await this.prisma.movimiento_banco.findMany({ where: { cuenta_id: cuenta.id, anulado: false } });
    let saldo = Number(cuenta.saldo);
    movsVigentes.forEach(m => saldo += (Number(m.monto) * m.signo));

    const nuevoSaldo = saldo + (Number(dto.monto) * dto.signo);
    if (nuevoSaldo < 0) throw new BadRequestException('Saldo insuficiente en la cuenta bancaria.');

    const year = new Date().getFullYear();
    const count = await this.prisma.movimiento_banco.count();
    const numero = `BAN-${year}-${String(count + 1).padStart(6, '0')}`;

    const mov = await this.prisma.movimiento_banco.create({
      data: {
        cuenta_id: cuenta.id,
        numero,
        fecha: new Date(dto.fecha),
        hora: new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }),
        tipo: dto.tipo,
        monto: Number(dto.monto).toFixed(2),
        signo: dto.signo,
        referencia: dto.referencia,
        concepto: dto.concepto,
        origen: 'Manual',
        saldo_posterior: nuevoSaldo.toFixed(2),
        id_usuario: idUsuario,
      },
    });

    // (Opcional) Aquí iría la lógica de vincular con caja si dto.enCaja === true.
    // Para simplificar y terminar rápido, lo omitimos o lo dejamos como TODO.

    return JSON.parse(JSON.stringify(mov, (_, v) => typeof v === 'bigint' ? v.toString() : v));
  }

  async anularMovimiento(numero: string, motivo: string, idUsuario: string) {
    const mov = await this.prisma.movimiento_banco.findUnique({ where: { numero } });
    if (!mov) throw new NotFoundException('Movimiento no encontrado');
    if (mov.anulado) throw new BadRequestException('Ya está anulado');

    const nuevoSaldo = Number(mov.saldo_posterior) - (Number(mov.monto) * mov.signo);
    const year = new Date().getFullYear();
    const count = await this.prisma.movimiento_banco.count();
    const numeroContrario = `BAN-${year}-${String(count + 1).padStart(6, '0')}`;

    await this.prisma.$transaction([
      this.prisma.movimiento_banco.update({
        where: { id: mov.id },
        data: { anulado: true, motivo_anulacion: motivo }
      }),
      this.prisma.movimiento_banco.create({
        data: {
          cuenta_id: mov.cuenta_id,
          numero: numeroContrario,
          fecha: new Date(),
          hora: new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }),
          tipo: mov.signo === 1 ? 'Retiro' : 'Depósito', // Contrario
          monto: mov.monto,
          signo: mov.signo === 1 ? -1 : 1,
          referencia: `ANU-${mov.numero}`,
          concepto: `Anulación de ${mov.numero}`,
          origen: 'Anulación',
          saldo_posterior: nuevoSaldo.toFixed(2),
          id_usuario: idUsuario,
          anula_a: mov.numero,
        }
      })
    ]);

    return { message: 'Anulado correctamente' };
  }

  async conciliarMovimiento(numero: string) {
    return this.prisma.movimiento_banco.update({
      where: { numero },
      data: { conciliado: true }
    });
  }
}