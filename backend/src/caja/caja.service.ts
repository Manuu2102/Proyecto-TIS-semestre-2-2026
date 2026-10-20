import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const serialize = <T>(data: T): T =>
  JSON.parse(JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));

@Injectable()
export class CajaService {
  constructor(private readonly prisma: PrismaService) {}

  // Obtener la caja (o crearla si no existe)
  private async getCaja() {
    let caja = await this.prisma.caja.findFirst();
    if (!caja) {
      caja = await this.prisma.caja.create({ data: { abierta: false } });
    }
    return caja;
  }

  async obtenerCaja() {
    return serialize(await this.getCaja());
  }

  // HU-20: Abrir caja (solo una vez)
  async abrirCaja(dto: { monto: number; fecha: string }) {
    const caja = await this.getCaja();
    
    if (caja.abierta) {
      throw new BadRequestException('La caja ya fue abierta anteriormente.');
    }

    const cajaAbierta = await this.prisma.caja.update({
      where: { id: caja.id },
      data: {
        abierta: true,
        monto_apertura: dto.monto.toFixed(2),
        fecha_apertura: new Date(dto.fecha),
      },
    });

    return serialize(cajaAbierta);
  }

  async listarMovimientos() {
    const caja = await this.getCaja();
    const movimientos = await this.prisma.movimiento_caja.findMany({
      where: { caja_id: caja.id },
      orderBy: { created_at: 'desc' },
      include: {
        usuario: { select: { nombres: true, apellido_paterno: true } }
      }
    });
    return movimientos.map(serialize);
  }

  // HU-20: Registrar movimiento manual
  async crearMovimiento(dto: { tipo: 'ENTRADA' | 'SALIDA'; monto: number; concepto: string; fecha?: string }, idUsuario: string) {
    const caja = await this.getCaja();
    if (!caja.abierta) throw new BadRequestException('La caja aún no ha sido abierta.');

    // Calcular saldo actual (solo movimientos no anulados)
    const movsVigentes = await this.prisma.movimiento_caja.findMany({
      where: { caja_id: caja.id, anulado: false }
    });
    
    let saldo = Number(caja.monto_apertura || 0);
    movsVigentes.forEach(m => {
      saldo += (m.tipo === 'ENTRADA' ? Number(m.monto) : -Number(m.monto));
    });

    const nuevoSaldo = dto.tipo === 'ENTRADA' ? saldo + dto.monto : saldo - dto.monto;
    if (nuevoSaldo < 0) {
      throw new BadRequestException(`Saldo insuficiente. Disponible: Bs. ${saldo.toFixed(2)}`);
    }

    // Generar número correlativo (CAJ-AAAA-000001)
    const year = new Date().getFullYear();
    const count = await this.prisma.movimiento_caja.count();
    const numero = `CAJ-${year}-${String(count + 1).padStart(6, '0')}`;

    const movimiento = await this.prisma.movimiento_caja.create({
      data: {
        caja_id: caja.id,
        numero,
        fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
        hora: new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }),
        tipo: dto.tipo,
        monto: dto.monto.toFixed(2),
        concepto: dto.concepto,
        origen: 'Manual',
        saldo_posterior: nuevoSaldo.toFixed(2),
        id_usuario: idUsuario,
      },
    });

    return serialize(movimiento);
  }

  // HU-20: Anular movimiento (crea el movimiento contrario)
  async anularMovimiento(numero: string, motivo: string, idUsuario: string) {
    const caja = await this.getCaja();
    const mov = await this.prisma.movimiento_caja.findFirst({
      where: { caja_id: caja.id, numero }
    });

    if (!mov) throw new NotFoundException('Movimiento no encontrado');
    if (mov.anulado) throw new BadRequestException('El movimiento ya está anulado');
    if (mov.origen !== 'Manual') {
      throw new BadRequestException(`Este movimiento fue generado por ${mov.origen} y debe anularse desde su origen.`);
    }

    // Calcular saldo actual y el resultante de anular
    const movsVigentes = await this.prisma.movimiento_caja.findMany({
      where: { caja_id: caja.id, anulado: false }
    });
    
    let saldo = Number(caja.monto_apertura || 0);
    movsVigentes.forEach(m => {
      saldo += (m.tipo === 'ENTRADA' ? Number(m.monto) : -Number(m.monto));
    });

    const saldoResultante = mov.tipo === 'ENTRADA' 
      ? saldo - Number(mov.monto) 
      : saldo + Number(mov.monto);

    if (saldoResultante < 0) {
      throw new BadRequestException(`No se puede anular: la caja quedaría con saldo negativo (Bs. ${saldoResultante.toFixed(2)})`);
    }

    // Generar número para el movimiento contrario
    const year = new Date().getFullYear();
    const count = await this.prisma.movimiento_caja.count();
    const numeroContrario = `CAJ-${year}-${String(count + 1).padStart(6, '0')}`;

    // Transacción para actualizar el original y crear el contrario
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Marcar el original como anulado
      const originalAnulado = await tx.movimiento_caja.update({
        where: { id: mov.id },
        data: { anulado: true, motivo_anulacion: motivo }
      });

      // 2. Crear el movimiento contrario
      const contrario = await tx.movimiento_caja.create({
        data: {
          caja_id: caja.id,
          numero: numeroContrario,
          fecha: new Date(),
          hora: new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }),
          tipo: mov.tipo === 'ENTRADA' ? 'SALIDA' : 'ENTRADA',
          monto: mov.monto,
          concepto: `Anulación de ${mov.numero}: ${motivo}`,
          origen: 'Anulación',
          saldo_posterior: saldoResultante.toFixed(2),
          id_usuario: idUsuario,
          anula_a: mov.numero,
        }
      });

      return { originalAnulado, contrario };
    });

    return serialize(result);
  }
}