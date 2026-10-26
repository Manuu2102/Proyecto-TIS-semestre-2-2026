import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { registrarAuditoria } from '../lib/auditoria.js';
import { aFecha, bs, fechaCorta, horaActual, hoyISO, isoDia } from '../lib/formato.js';
import { leerFecha, leerId, leerMonto, leerTexto, obligatorio } from '../lib/validacion.js';

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaService;

const serialize = <T>(data: T): T =>
  JSON.parse(JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));

const CERO = new Prisma.Decimal(0);

// Candado de bancos: serializa registros y anulaciones (saldo y número correlativo)
const CANDADO_BANCOS = 4207002;

/** Un movimiento anulado y su contrario se cancelan: ninguno cuenta en el saldo. */
const VIGENTE = { anulado: false, anula_a: null };

const usuarioSelect = { select: { nombres: true, apellido_paterno: true } } as const;

export type DatosMovimientoBanco = {
  idCuenta: bigint;
  tipo: string; // Depósito, Retiro, Transferencia recibida, Transferencia enviada, …
  signo: 1 | -1; // +1 entra a la cuenta, -1 sale
  monto: Prisma.Decimal;
  fecha: string; // YYYY-MM-DD
  referencia: string;
  concepto: string;
  origen: 'Manual' | 'Ingreso' | 'Gasto';
  idUsuario: string;
  idIngreso?: bigint;
  idGasto?: bigint;
};

/**
 * Movimientos bancarios. El saldo de una cuenta es su saldo inicial (cuenta_bancaria.saldo)
 * más los movimientos vigentes. Los ingresos y gastos por transferencia o depósito
 * registran aquí su movimiento, en la misma transacción (HU-15 #6, HU-16 #6).
 */
@Injectable()
export class BancosService {
  constructor(private readonly prisma: PrismaService) {}

  // =====================================================================
  // Base
  // =====================================================================

  private async bloquear(tx: Tx) {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${CANDADO_BANCOS}::bigint)`;
  }

  /** La cuenta debe existir y estar activa. */
  async cuentaActiva(db: Db, idCuenta: bigint) {
    const cuenta = await db.cuenta_bancaria.findUnique({ where: { id: idCuenta } });
    if (!cuenta) throw new BadRequestException('La cuenta bancaria seleccionada no existe.');
    if (!cuenta.activa) throw new BadRequestException('La cuenta bancaria seleccionada está inactiva.');
    return cuenta;
  }

  /** Saldo inicial de la cuenta + movimientos vigentes (signo × monto). */
  private async saldo(db: Db, cuenta: { id: bigint; saldo: Prisma.Decimal }) {
    const grupos = await db.movimiento_banco.groupBy({
      by: ['signo'],
      where: { cuenta_id: cuenta.id, ...VIGENTE },
      _sum: { monto: true },
    });
    const suma = (signo: number) => grupos.find((g) => g.signo === signo)?._sum.monto ?? CERO;
    return cuenta.saldo.plus(suma(1)).minus(suma(-1));
  }

  /** BAN-AAAA-000001, correlativo por año. Se llama con el candado tomado. */
  private async siguienteNumero(tx: Tx) {
    const prefijo = `BAN-${hoyISO().slice(0, 4)}-`;
    const ultimo = await tx.movimiento_banco.findFirst({
      where: { numero: { startsWith: prefijo } },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const n = ultimo ? Number(ultimo.numero.slice(prefijo.length)) + 1 : 1;
    return `${prefijo}${String(n).padStart(6, '0')}`;
  }

  private nombreCuenta(c: { banco: string; numero_cuenta: string }) {
    return `${c.banco} ${c.numero_cuenta}`;
  }

  // =====================================================================
  // Registro (manual y automático)
  // =====================================================================

  /**
   * Registra un movimiento dentro de una transacción. Si la cuenta quedaría en negativo
   * se rechaza (422) y no se guarda nada.
   */
  async registrarEnTx(tx: Tx, d: DatosMovimientoBanco) {
    await this.bloquear(tx);
    const cuenta = await this.cuentaActiva(tx, d.idCuenta);
    if (d.fecha > hoyISO()) throw new BadRequestException('La fecha no puede ser posterior a hoy.');

    const disponible = await this.saldo(tx, cuenta);
    const saldo = d.signo === 1 ? disponible.plus(d.monto) : disponible.minus(d.monto);
    if (saldo.lt(0)) {
      throw new UnprocessableEntityException(
        `Saldo insuficiente en la cuenta ${this.nombreCuenta(cuenta)}. Disponible: ${bs(disponible)}; ` +
          `el movimiento es de ${bs(d.monto)}.`,
      );
    }

    const movimiento = await tx.movimiento_banco.create({
      data: {
        cuenta_id: cuenta.id,
        numero: await this.siguienteNumero(tx),
        fecha: aFecha(d.fecha),
        hora: horaActual().slice(0, 5),
        tipo: d.tipo,
        monto: d.monto,
        signo: d.signo,
        referencia: d.referencia.slice(0, 100),
        concepto: d.concepto.slice(0, 255),
        origen: d.origen,
        saldo_posterior: saldo,
        id_usuario: d.idUsuario,
        id_ingreso: d.idIngreso ?? null,
        id_gasto: d.idGasto ?? null,
      },
    });

    await registrarAuditoria(tx, {
      tabla: 'movimiento_banco',
      registroId: movimiento.id,
      accion: 'CREAR',
      despues: movimiento,
      usuarioId: d.idUsuario,
    });

    return { movimiento, saldo };
  }

  /** Movimiento manual desde la pantalla de bancos. */
  async crearMovimiento(dto: Record<string, unknown>, idUsuario: string) {
    const idCuenta = leerId(dto.cuentaId, 'cuenta');
    const fecha = leerFecha(dto.fecha, 'fecha');
    const monto = leerMonto(dto.monto, 'monto');
    if (!dto.tipo || !String(dto.tipo).trim()) throw new BadRequestException(obligatorio('tipo'));
    const signo = Number(dto.signo);
    if (signo !== 1 && signo !== -1) throw new BadRequestException('El signo debe ser 1 (entrada) o -1 (salida).');
    const referencia = String(dto.referencia ?? '').trim();
    if (!referencia) throw new BadRequestException(obligatorio('referencia'));
    const concepto = String(dto.concepto ?? '').trim();
    if (!concepto) throw new BadRequestException(obligatorio('concepto'));

    const { movimiento } = await this.prisma.$transaction((tx) =>
      this.registrarEnTx(tx, {
        idCuenta,
        tipo: String(dto.tipo).trim(),
        signo,
        monto,
        fecha,
        referencia,
        concepto,
        origen: 'Manual',
        idUsuario,
      }),
    );
    return serialize(movimiento);
  }

  async listarMovimientos(cuentaId?: bigint) {
    const movs = await this.prisma.movimiento_banco.findMany({
      where: cuentaId ? { cuenta_id: cuentaId } : {},
      orderBy: [{ fecha: 'desc' }, { numero: 'desc' }],
      include: {
        usuario: usuarioSelect,
        usuario_movimiento_banco_id_usuario_anuloTousuario: usuarioSelect,
      },
    });
    return movs.map(({ usuario_movimiento_banco_id_usuario_anuloTousuario: anulo, ...m }) =>
      serialize({ ...m, usuario_anulo: anulo ?? null }),
    );
  }

  // =====================================================================
  // Anulación
  // =====================================================================

  /** Anulación desde la pantalla de bancos: solo movimientos manuales. */
  async anularMovimiento(numero: string, motivoEntrada: string | undefined, idUsuario: string) {
    const motivo = leerTexto(motivoEntrada, 'motivo', 'El motivo debe tener entre 10 y 255 caracteres.');
    await this.prisma.$transaction(async (tx) => {
      await this.bloquear(tx);
      const mov = await tx.movimiento_banco.findUnique({ where: { numero } });
      if (!mov) throw new NotFoundException(`El movimiento ${numero} no existe.`);
      if (!mov.anulado && !mov.anula_a && mov.origen !== 'Manual') {
        throw new BadRequestException(
          `El movimiento ${numero} fue generado por ${mov.origen} y se anula desde su registro de origen.`,
        );
      }
      await this.anularEnTx(tx, mov, motivo, idUsuario);
    });
    return { message: `Movimiento ${numero} anulado.` };
  }

  /**
   * Anula el movimiento bancario generado por un ingreso o un gasto, dentro de la
   * transacción que anula el origen. Si el origen no pasó por banco, no hace nada.
   */
  async anularPorOrigenEnTx(
    tx: Tx,
    origen: { idIngreso: bigint } | { idGasto: bigint },
    motivo: string,
    idUsuario: string,
  ) {
    await this.bloquear(tx);
    const mov = await tx.movimiento_banco.findFirst({
      where:
        'idIngreso' in origen
          ? { id_ingreso: origen.idIngreso, origen: 'Ingreso' }
          : { id_gasto: origen.idGasto, origen: 'Gasto' },
    });
    if (!mov || mov.anulado) return null;
    return this.anularEnTx(tx, mov, motivo, idUsuario);
  }

  /** Marca el original como anulado y crea el movimiento contrario. Con el candado tomado. */
  private async anularEnTx(
    tx: Tx,
    mov: Prisma.movimiento_bancoGetPayload<object>,
    motivo: string,
    idUsuario: string,
  ) {
    if (mov.anula_a) {
      throw new BadRequestException(`El movimiento ${mov.numero} es una anulación y no se puede anular.`);
    }
    if (mov.anulado) {
      const fecha = mov.fecha_anulacion ?? (await tx.movimiento_banco.findFirst({ where: { anula_a: mov.numero } }))?.created_at;
      throw new BadRequestException(
        `El movimiento ${mov.numero} ya fue anulado el ${fecha ? fechaCorta(isoDia(fecha)) : 'anteriormente'}.`,
      );
    }

    const cuenta = await tx.cuenta_bancaria.findUniqueOrThrow({ where: { id: mov.cuenta_id } });
    const actual = await this.saldo(tx, cuenta);
    // Al anular, el original deja de contar: se revierte su efecto
    const saldo = actual.minus(mov.monto.mul(mov.signo));
    if (saldo.lt(0)) {
      throw new UnprocessableEntityException(
        `No se puede anular el movimiento ${mov.numero}: la cuenta ${this.nombreCuenta(cuenta)} quedaría en ${bs(saldo)}.`,
      );
    }

    const original = await tx.movimiento_banco.update({
      where: { id: mov.id },
      data: {
        anulado: true,
        motivo_anulacion: motivo.slice(0, 255),
        fecha_anulacion: new Date(),
        id_usuario_anulo: idUsuario,
      },
    });

    const contrario = await tx.movimiento_banco.create({
      data: {
        cuenta_id: mov.cuenta_id,
        numero: await this.siguienteNumero(tx),
        fecha: aFecha(hoyISO()),
        hora: horaActual().slice(0, 5),
        tipo: 'Ajuste',
        monto: mov.monto,
        signo: mov.signo === 1 ? -1 : 1,
        referencia: `ANU-${mov.numero}`,
        concepto: `Anulación de ${mov.numero}: ${motivo}`.slice(0, 255),
        origen: 'Anulación',
        saldo_posterior: saldo,
        id_usuario: idUsuario,
        anula_a: mov.numero,
        // Se conserva el vínculo para poder ir al registro de origen
        id_ingreso: mov.id_ingreso,
        id_gasto: mov.id_gasto,
      },
    });

    await registrarAuditoria(tx, {
      tabla: 'movimiento_banco',
      registroId: mov.id,
      accion: 'ANULAR',
      antes: mov,
      despues: { original, contrario },
      usuarioId: idUsuario,
    });

    return { original, contrario, saldo };
  }

  async conciliarMovimiento(numero: string) {
    const mov = await this.prisma.movimiento_banco.findUnique({ where: { numero } });
    if (!mov) throw new NotFoundException(`El movimiento ${numero} no existe.`);
    return serialize(
      await this.prisma.movimiento_banco.update({ where: { numero }, data: { conciliado: true } }),
    );
  }
}
