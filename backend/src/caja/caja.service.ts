import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { registrarAuditoria } from '../lib/auditoria.js';
import { generarPdf, filaTabla, ANCHO_TABLA, type LineaPdf } from '../lib/exportar.js';
import { generarExcel } from '../lib/excel.js';
import { datosEmision } from '../lib/emision.js';
import { leerFecha, leerMonto, leerTexto, obligatorio } from '../lib/validacion.js';
import {
  TIPO_XLSX,
  aFecha,
  bs,
  diaAnterior,
  esFechaISO,
  fechaCorta,
  hoyISO,
  horaParaTime,
  isoDia,
} from '../lib/formato.js';
import { AbrirCajaDto } from './dto/abrir-caja.dto.js';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto.js';

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaService;
type Tipo = 'ENTRADA' | 'SALIDA';
type Origen = 'Manual' | 'Ingreso' | 'Gasto' | 'Anulación';

const serialize = <T>(data: T): T =>
  JSON.parse(JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));

const CERO = new Prisma.Decimal(0);

// Identificador del candado de caja: serializa registros y anulaciones para que dos
// operaciones simultáneas no usen el mismo saldo ni el mismo número correlativo.
const CANDADO_CAJA = 4207001;

const MSJ = {
  sinAbrir: 'La caja aún no ha sido abierta. Regístrate primero con el monto inicial.',
  sinAbrirConsulta: 'La caja aún no ha sido abierta.',
  concepto: 'El concepto debe tener entre 10 y 255 caracteres.',
  motivo: 'El motivo debe tener entre 10 y 255 caracteres.',
};

/** Un movimiento anulado y su contrario se cancelan: ninguno cuenta en el saldo (HU-22 #3). */
const VIGENTE = { anulado: false, anula_a: null };

const usuarioSelect = { select: { nombres: true, apellido_paterno: true } } as const;
const nombreDe = (u: { nombres: string; apellido_paterno: string } | null | undefined) =>
  u ? `${u.nombres} ${u.apellido_paterno}`.trim() : '—';

export type DatosMovimiento = {
  tipo: Tipo;
  monto: Prisma.Decimal;
  fecha: string; // YYYY-MM-DD
  concepto: string;
  origen: Exclude<Origen, 'Anulación'>;
  idUsuario: string;
  idIngreso?: bigint;
  idGasto?: bigint;
};

@Injectable()
export class CajaService {
  constructor(private readonly prisma: PrismaService) {}

  // =====================================================================
  // Base: caja, candado, saldo y número correlativo
  // =====================================================================

  /** La caja es única; si no existe se crea cerrada. */
  private async getCaja(db: Db = this.prisma) {
    return (await db.caja.findFirst()) ?? (await db.caja.create({ data: { abierta: false } }));
  }

  private async cajaAbierta(db: Db) {
    const caja = await this.getCaja(db);
    if (!caja.abierta || !caja.fecha_apertura) throw new BadRequestException(MSJ.sinAbrir);
    return caja as typeof caja & { fecha_apertura: Date };
  }

  private async bloquear(tx: Tx) {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${CANDADO_CAJA}::bigint)`;
  }

  /**
   * Saldo = apertura + entradas vigentes − salidas vigentes (hasta una fecha, si se indica).
   * Es el mismo cálculo para validar salidas, anular y consultar (HU-22 #4).
   */
  private async saldo(db: Db, caja: { id: bigint; monto_apertura: Prisma.Decimal | null }, hasta?: string) {
    const grupos = await db.movimiento_caja.groupBy({
      by: ['tipo'],
      where: { caja_id: caja.id, ...VIGENTE, ...(hasta && { fecha: { lte: aFecha(hasta) } }) },
      _sum: { monto: true },
    });
    const suma = (tipo: Tipo) => grupos.find((g) => g.tipo === tipo)?._sum.monto ?? CERO;
    return (caja.monto_apertura ?? CERO).plus(suma('ENTRADA')).minus(suma('SALIDA'));
  }

  /** CAJ-AAAA-000001, correlativo por año. Se llama con el candado tomado. */
  private async siguienteNumero(tx: Tx) {
    const prefijo = `CAJ-${hoyISO().slice(0, 4)}-`;
    const ultimo = await tx.movimiento_caja.findFirst({
      where: { numero: { startsWith: prefijo } },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const n = ultimo ? Number(ultimo.numero.slice(prefijo.length)) + 1 : 1;
    return `${prefijo}${String(n).padStart(6, '0')}`;
  }

  /** La fecha no puede ser anterior a la apertura ni posterior a hoy (HU-20 #4). */
  private validarFechaMovimiento(fecha: string, apertura: Date) {
    if (fecha > hoyISO()) {
      throw new BadRequestException('La fecha del movimiento no puede ser posterior a hoy.');
    }
    if (fecha < isoDia(apertura)) {
      throw new BadRequestException(
        `La fecha del movimiento no puede ser anterior a la apertura de caja (${fechaCorta(isoDia(apertura))}).`,
      );
    }
  }

  // =====================================================================
  // HU-20: apertura
  // =====================================================================

  async obtenerCaja() {
    const caja = await this.getCaja();
    const saldo = caja.abierta ? await this.saldo(this.prisma, caja) : null;
    return serialize({ ...caja, saldo: saldo?.toNumber() ?? null });
  }

  async abrirCaja(dto: AbrirCajaDto, idUsuario: string) {
    const monto = leerMonto(dto.monto, 'monto inicial', true);
    const fecha = leerFecha(dto.fecha, 'fecha');
    if (fecha > hoyISO()) throw new BadRequestException('La fecha de apertura no puede ser posterior a hoy.');

    const caja = await this.prisma.$transaction(async (tx) => {
      await this.bloquear(tx);
      const actual = await this.getCaja(tx);
      if (actual.abierta) {
        const abiertaEl = actual.fecha_apertura ? fechaCorta(isoDia(actual.fecha_apertura)) : '';
        throw new BadRequestException(`La caja ya fue abierta el ${abiertaEl}.`);
      }
      const abierta = await tx.caja.update({
        where: { id: actual.id },
        data: { abierta: true, monto_apertura: monto, fecha_apertura: aFecha(fecha), updated_at: new Date() },
      });
      await registrarAuditoria(tx, {
        tabla: 'caja',
        registroId: abierta.id,
        accion: 'ABRIR',
        antes: actual,
        despues: abierta,
        usuarioId: idUsuario,
      });
      return abierta;
    });

    return serialize({ ...caja, message: `Caja abierta el ${fechaCorta(fecha)} con ${bs(monto)}.` });
  }

  // =====================================================================
  // HU-20: movimientos
  // =====================================================================

  async listarMovimientos() {
    const caja = await this.getCaja();
    const movimientos = await this.prisma.movimiento_caja.findMany({
      where: { caja_id: caja.id },
      orderBy: [{ fecha: 'desc' }, { numero: 'desc' }],
      include: {
        usuario: usuarioSelect,
        usuario_movimiento_caja_id_usuario_anuloTousuario: usuarioSelect,
      },
    });
    return movimientos.map(({ usuario_movimiento_caja_id_usuario_anuloTousuario: anulo, ...m }) =>
      serialize({ ...m, usuario_anulo: anulo ?? null }),
    );
  }

  /** Movimiento manual del administrador. */
  async crearMovimiento(dto: CrearMovimientoDto, idUsuario: string) {
    const fecha = leerFecha(dto.fecha, 'fecha');
    if (!dto.tipo || !String(dto.tipo).trim()) throw new BadRequestException(obligatorio('tipo'));
    const tipo = String(dto.tipo).trim().toUpperCase();
    if (tipo !== 'ENTRADA' && tipo !== 'SALIDA') {
      throw new BadRequestException('El tipo debe ser ENTRADA o SALIDA.');
    }
    const monto = leerMonto(dto.monto, 'monto');
    const concepto = leerTexto(dto.concepto, 'concepto', MSJ.concepto);

    const { movimiento, saldo } = await this.prisma.$transaction((tx) =>
      this.registrarEnTx(tx, { tipo, monto, fecha, concepto, origen: 'Manual', idUsuario }),
    );

    return serialize({
      ...movimiento,
      saldo_caja: saldo.toNumber(),
      message: `Movimiento ${movimiento.numero} registrado. Saldo de caja: ${bs(saldo)}.`,
    });
  }

  /**
   * Registra un movimiento dentro de una transacción. Lo usan los movimientos manuales
   * y los automáticos de ingresos y gastos en efectivo (HU-20 #10), para que el
   * movimiento de caja y su origen se guarden juntos o no se guarde ninguno.
   */
  async registrarEnTx(tx: Tx, datos: DatosMovimiento) {
    await this.bloquear(tx);
    const caja = await this.cajaAbierta(tx);
    this.validarFechaMovimiento(datos.fecha, caja.fecha_apertura);

    const disponible = await this.saldo(tx, caja);
    const saldo = datos.tipo === 'ENTRADA' ? disponible.plus(datos.monto) : disponible.minus(datos.monto);
    if (saldo.lt(0)) {
      throw new UnprocessableEntityException(
        `Saldo insuficiente en caja. Disponible: ${bs(disponible)}; la salida es de ${bs(datos.monto)}.`,
      );
    }

    const movimiento = await tx.movimiento_caja.create({
      data: {
        caja_id: caja.id,
        numero: await this.siguienteNumero(tx),
        fecha: aFecha(datos.fecha),
        hora: horaParaTime(),
        tipo: datos.tipo,
        monto: datos.monto,
        concepto: datos.concepto.slice(0, 255),
        origen: datos.origen,
        saldo_posterior: saldo,
        id_usuario: datos.idUsuario,
        id_ingreso: datos.idIngreso ?? null,
        id_gasto: datos.idGasto ?? null,
      },
    });

    await registrarAuditoria(tx, {
      tabla: 'movimiento_caja',
      registroId: movimiento.id,
      accion: 'CREAR',
      despues: movimiento,
      usuarioId: datos.idUsuario,
    });

    return { movimiento, saldo };
  }

  // =====================================================================
  // HU-20: anulación
  // =====================================================================

  /** Anulación desde la caja: solo movimientos manuales (HU-20 #12 y front #15). */
  async anularMovimiento(numero: string, motivoEntrada: string | undefined, idUsuario: string) {
    const motivo = leerTexto(motivoEntrada, 'motivo', MSJ.motivo);

    const { original, contrario, saldo } = await this.prisma.$transaction(async (tx) => {
      await this.bloquear(tx);
      const mov = await tx.movimiento_caja.findUnique({ where: { numero } });
      if (!mov) throw new NotFoundException(`El movimiento ${numero} no existe.`);
      if (!mov.anulado && !mov.anula_a && mov.origen !== 'Manual') {
        throw new BadRequestException(
          `El movimiento ${numero} fue generado por ${mov.origen} y se anula desde su registro de origen.`,
        );
      }
      return this.anularEnTx(tx, mov, motivo, idUsuario);
    });

    return serialize({
      originalAnulado: original,
      contrario,
      saldo_caja: saldo.toNumber(),
      message: `Movimiento ${original.numero} anulado.`,
    });
  }

  /**
   * Marca el original como anulado (con fecha, motivo y usuario) y crea el movimiento
   * contrario. Se llama con el candado tomado.
   */
  private async anularEnTx(
    tx: Tx,
    mov: Prisma.movimiento_cajaGetPayload<object>,
    motivo: string,
    idUsuario: string,
  ) {
    if (mov.anula_a) {
      throw new BadRequestException(`El movimiento ${mov.numero} es una anulación y no se puede anular.`);
    }
    if (mov.anulado) {
      // Los anulados antes de existir fecha_anulacion toman la fecha de su contrario
      const fecha =
        mov.fecha_anulacion ??
        (await tx.movimiento_caja.findUnique({ where: { anula_a: mov.numero } }))?.created_at;
      throw new BadRequestException(
        `El movimiento ${mov.numero} ya fue anulado el ${fecha ? fechaCorta(isoDia(fecha)) : 'anteriormente'}.`,
      );
    }

    const caja = await this.cajaAbierta(tx);
    const actual = await this.saldo(tx, caja);
    // Al anular, el original deja de contar: se revierte su efecto
    const saldo = mov.tipo === 'ENTRADA' ? actual.minus(mov.monto) : actual.plus(mov.monto);
    if (saldo.lt(0)) {
      throw new UnprocessableEntityException(
        `No se puede anular el movimiento ${mov.numero}: la caja quedaría en ${bs(saldo)}.`,
      );
    }

    const original = await tx.movimiento_caja.update({
      where: { id: mov.id },
      data: {
        anulado: true,
        motivo_anulacion: motivo.slice(0, 255),
        fecha_anulacion: new Date(),
        id_usuario_anulo: idUsuario,
      },
    });

    const contrario = await tx.movimiento_caja.create({
      data: {
        caja_id: mov.caja_id,
        numero: await this.siguienteNumero(tx),
        fecha: aFecha(hoyISO()),
        hora: horaParaTime(),
        tipo: mov.tipo === 'ENTRADA' ? 'SALIDA' : 'ENTRADA',
        monto: mov.monto,
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
      tabla: 'movimiento_caja',
      registroId: mov.id,
      accion: 'ANULAR',
      antes: mov,
      despues: { original, contrario },
      usuarioId: idUsuario,
    });

    return { original, contrario, saldo };
  }

  // =====================================================================
  // HU-22: saldo con fecha de corte o período
  // =====================================================================

  async consultarSaldo(corteEntrada?: string, desdeEntrada?: string) {
    const caja = await this.getCaja();
    if (!caja.abierta || !caja.fecha_apertura) throw new BadRequestException(MSJ.sinAbrirConsulta);
    const apertura = isoDia(caja.fecha_apertura);

    const corte = corteEntrada?.trim() || hoyISO();
    if (!esFechaISO(corte)) throw new BadRequestException('La fecha de corte no tiene un formato válido (AAAA-MM-DD).');
    if (corte > hoyISO()) throw new BadRequestException('La fecha de corte no puede ser posterior a hoy.');
    if (corte < apertura) {
      throw new BadRequestException(
        `La fecha de corte no puede ser anterior a la apertura de caja (${fechaCorta(apertura)}).`,
      );
    }

    const desde = desdeEntrada?.trim() || apertura;
    if (!esFechaISO(desde)) throw new BadRequestException('La fecha inicial no tiene un formato válido (AAAA-MM-DD).');
    if (desde < apertura) {
      throw new BadRequestException(
        `La fecha inicial no puede ser anterior a la apertura de caja (${fechaCorta(apertura)}).`,
      );
    }
    if (desde > corte) throw new BadRequestException('La fecha inicial no puede ser posterior a la fecha de corte.');

    // Saldo inicial: acumulado hasta el día anterior al período (HU-22 #8)
    const saldoInicial = await this.saldo(this.prisma, caja, diaAnterior(desde));

    const grupos = await this.prisma.movimiento_caja.groupBy({
      by: ['tipo'],
      where: { caja_id: caja.id, ...VIGENTE, fecha: { gte: aFecha(desde), lte: aFecha(corte) } },
      _sum: { monto: true },
    });
    const entradas = grupos.find((g) => g.tipo === 'ENTRADA')?._sum.monto ?? CERO;
    const salidas = grupos.find((g) => g.tipo === 'SALIDA')?._sum.monto ?? CERO;
    const saldoFinal = saldoInicial.plus(entradas).minus(salidas);

    const ultimos = await this.prisma.movimiento_caja.findMany({
      where: { caja_id: caja.id, fecha: { lte: aFecha(corte) } },
      orderBy: [{ fecha: 'desc' }, { numero: 'desc' }],
      take: 10,
      include: { usuario: usuarioSelect },
    });

    const minimo = caja.monto_minimo;
    return {
      fecha_apertura: apertura,
      monto_apertura: (caja.monto_apertura ?? CERO).toNumber(),
      desde,
      fecha_corte: corte,
      saldo_inicial: saldoInicial.toNumber(),
      total_entradas: entradas.toNumber(),
      total_salidas: salidas.toNumber(),
      saldo_final: saldoFinal.toNumber(),
      calculado_en: new Date().toISOString(),
      sin_fondos: saldoFinal.isZero(),
      monto_minimo: minimo?.toNumber() ?? null,
      saldo_bajo: minimo !== null && saldoFinal.lt(minimo),
      ultimos_movimientos: ultimos.map((m) => ({
        numero: m.numero,
        fecha: isoDia(m.fecha),
        tipo: m.tipo,
        origen: m.origen,
        concepto: m.concepto,
        monto: m.monto.toNumber(),
        saldo_posterior: m.saldo_posterior.toNumber(),
        estado: m.anulado ? 'Anulado' : m.anula_a ? `Anula a ${m.anula_a}` : 'Vigente',
        usuario: nombreDe(m.usuario),
      })),
    };
  }

  /** HU-22 #10: detalle de caja en PDF o Excel. */
  async exportarSaldo(formato: 'pdf' | 'excel', corte: string | undefined, desde: string | undefined, idUsuario: string) {
    const resumen = await this.consultarSaldo(corte, desde);
    const caja = await this.getCaja();
    const movimientos = await this.prisma.movimiento_caja.findMany({
      where: {
        caja_id: caja.id,
        fecha: { gte: aFecha(resumen.desde), lte: aFecha(resumen.fecha_corte) },
      },
      orderBy: [{ fecha: 'asc' }, { numero: 'asc' }],
    });
    if (movimientos.length === 0) throw new BadRequestException('No hay datos para exportar.');

    const { edificio, emisor, emitido } = await datosEmision(this.prisma, idUsuario);
    const estado = (m: (typeof movimientos)[number]) =>
      m.anulado ? 'Anulado' : m.anula_a ? `Anula ${m.anula_a}` : 'Vigente';
    const nombreArchivo = `caja-${resumen.fecha_corte}`;

    if (formato === 'excel') {
      const contenido = await generarExcel({
        hoja: 'Caja',
        edificio,
        titulo: 'Detalle de caja',
        cabecera: [
          `Fecha de corte: ${fechaCorta(resumen.fecha_corte)}   ·   Período: ${fechaCorta(resumen.desde)} al ${fechaCorta(resumen.fecha_corte)}`,
          `Emitido por: ${emisor}   ·   Fecha y hora de emisión: ${emitido}`,
        ],
        totales: [
          ['Saldo inicial', resumen.saldo_inicial],
          ['Total de entradas', resumen.total_entradas],
          ['Total de salidas', resumen.total_salidas],
          ['Saldo final', resumen.saldo_final],
        ],
        columnas: [
          { titulo: 'Número', ancho: 18 },
          { titulo: 'Fecha', ancho: 12 },
          { titulo: 'Tipo', ancho: 10 },
          { titulo: 'Origen', ancho: 12 },
          { titulo: 'Concepto', ancho: 50 },
          { titulo: 'Monto (Bs)', ancho: 14, tipo: 'monto' },
          { titulo: 'Saldo posterior (Bs)', ancho: 20, tipo: 'monto' },
          { titulo: 'Estado', ancho: 22 },
        ],
        filas: movimientos.map((m) => [
          m.numero,
          fechaCorta(isoDia(m.fecha)),
          m.tipo,
          m.origen,
          m.concepto,
          m.monto.toNumber(),
          m.saldo_posterior.toNumber(),
          estado(m),
        ]),
        // Los anulados y sus contrarios no cuentan en el saldo: se ven atenuados
        atenuadas: movimientos.flatMap((m, i) => (m.anulado || m.anula_a ? [i] : [])),
      });
      return { contenido, nombre: `${nombreArchivo}.xlsx`, tipo: TIPO_XLSX };
    }

    // Suma de anchos + separadores = ANCHO_TABLA
    const anchos = [15, 10, 7, 9, 30, 13, 13, 8];
    const derecha = [5, 6];
    const lineas: LineaPdf[] = [
      { texto: edificio, estilo: 'titulo' },
      { texto: 'Detalle de caja', estilo: 'subtitulo' },
      { texto: `Fecha de corte: ${fechaCorta(resumen.fecha_corte)}   ·   Período: ${fechaCorta(resumen.desde)} al ${fechaCorta(resumen.fecha_corte)}` },
      { texto: `Emitido por: ${emisor}   ·   Fecha y hora de emisión: ${emitido}` },
      { texto: '' },
      { texto: `Saldo inicial: ${bs(resumen.saldo_inicial)}   ·   Entradas: ${bs(resumen.total_entradas)}   ·   Salidas: ${bs(resumen.total_salidas)}` },
      { texto: `Saldo final: ${bs(resumen.saldo_final)}`, estilo: 'subtitulo' },
      { texto: '' },
      {
        texto: filaTabla(['Número', 'Fecha', 'Tipo', 'Origen', 'Concepto', 'Monto', 'Saldo post.', 'Estado'], anchos, derecha),
        estilo: 'tabla-encabezado',
      },
      { texto: '-'.repeat(ANCHO_TABLA), estilo: 'tabla' },
      ...movimientos.map((m) => ({
        texto: filaTabla(
          [m.numero, fechaCorta(isoDia(m.fecha)), m.tipo, m.origen, m.concepto, bs(m.monto), bs(m.saldo_posterior), estado(m)],
          anchos,
          derecha,
        ),
        estilo: 'tabla' as const,
      })),
    ];
    return { contenido: generarPdf(lineas), nombre: `${nombreArchivo}.pdf`, tipo: 'application/pdf' };
  }
}
