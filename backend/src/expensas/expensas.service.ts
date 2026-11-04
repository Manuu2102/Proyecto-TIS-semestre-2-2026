import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PagarExpensaDto } from './dto/pagar-expensa.dto.js';
import { CrearExtrasDto } from './dto/crear-extras.dto.js';
import { ActualizarTarifaDto } from './dto/actualizar-tarifa.dto.js';
import { DepositarFondosDto } from './dto/depositar-fondos.dto.js';
import { ReglaMoraDto } from './dto/regla-mora.dto.js';
import { calcularMora, type ReglaMora } from './mora.js';
import { deudasQueCubre } from './saldo.js';
import { desdeLaPaz, enLaPaz, horaDesdeTexto, horaTexto, momentoLaPaz } from './hora-la-paz.js';
import { ahora as relojAhora } from './reloj.js';

const ESTADO_PENDIENTE = BigInt(2);
const ESTADO_PAGADA = BigInt(3);
const ESTADO_VENCIDA = BigInt(4);

const serialize = <T>(data: T): T =>
  JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );

/**
 * Como Promise.all, pero espera las consultas una tras otra. Las consultas de Prisma no
 * empiezan hasta que se esperan, así que cada pantalla ocupa una sola conexión a la vez
 * (el pooler de Supabase en modo session admite pocas para todo el equipo).
 */
const enOrden = async <T extends readonly unknown[] | []>(
  consultas: T,
): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> => {
  const resultados: unknown[] = [];
  for (const consulta of consultas) resultados.push(await consulta);
  return resultados as { -readonly [K in keyof T]: Awaited<T[K]> };
};

// Nombre de cada tipo de departamento ("A", "B", "C"...), por id
const nombresDeTipos = (tipos: { id: bigint; nombre: string | null }[]) =>
  new Map(tipos.map((t) => [t.id, t.nombre?.trim().toUpperCase()]));

const sumarMeses = (mes: Date, n: number) =>
  new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() + n, 1));

// Fecha de hoy en La Paz, como Date en UTC a medianoche (para columnas @db.Date)
const hoyLaPaz = () =>
  new Date(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(relojAhora()),
  );

const primerDiaDelMes = (fecha: string) => {
  const d = new Date(fecha);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

const mesActual = () => primerDiaDelMes(hoyLaPaz().toISOString());

// La deuda de un mes vence el mes siguiente, en el día y la hora (de La Paz) de la regla
// vigente al crearla. Si luego cambian, las deudas ya creadas conservan los suyos.
const calcularVencimiento = (mes: Date, regla: { dia: number; hora: Date }) =>
  desdeLaPaz(
    mes.getUTCFullYear(),
    mes.getUTCMonth() + 1,
    regla.dia,
    regla.hora.getUTCHours(),
    regla.hora.getUTCMinutes(),
  );

// Rango de vencimientos de las deudas de un mes (vencen en algún momento del mes siguiente)
const vencimientosDelMes = (mes: Date) => ({
  gte: desdeLaPaz(mes.getUTCFullYear(), mes.getUTCMonth() + 1, 1),
  lt: desdeLaPaz(mes.getUTCFullYear(), mes.getUTCMonth() + 2, 1),
});

// Mes cubierto por una deuda (vence el mes siguiente), a medianoche UTC del día 1
const mesCubierto = (vencimiento: Date) => sumarMeses(enLaPaz(vencimiento), -1);
const periodoDe = (vencimiento: Date) => mesCubierto(vencimiento).toISOString().slice(0, 7);

// Último día (de La Paz) para pagar sin mora: el del minuto anterior al vencimiento
const ultimoDiaSinMora = (vencimiento: Date) =>
  enLaPaz(new Date(vencimiento.getTime() - 60_000)).toISOString().slice(0, 10);

// Sin regla configurada (tabla vacía o inexistente): comportamiento anterior,
// deudas el día 1 a las 00:00 y mora = mora_valor de cada expensa por mes.
const REGLA_POR_DEFECTO: ReglaMora = {
  dia: 1,
  hora: new Date(0),
  tipo: 'fijo',
  valor: new Prisma.Decimal(0),
  tope: null,
  frecuencia: 'mes',
  configurada: false,
};

/**
 * Desglose de una deuda: la expensa (salvo en una deuda complementaria, que va en 0) y
 * cada extra. `concepto` solo existe en extras antiguos guardados como deuda suelta.
 */
const conceptosDe = (deuda: {
  monto: Prisma.Decimal;
  concepto: string | null;
  expensa: { nombre: string } | null;
  pago_expensa_extra: { concepto: string; monto: Prisma.Decimal }[];
}) => {
  const lineas = [
    ...(deuda.monto.gt(0) || deuda.pago_expensa_extra.length === 0
      ? [{ concepto: deuda.concepto ?? deuda.expensa?.nombre ?? 'Extra', monto: deuda.monto.toNumber() }]
      : []),
    ...deuda.pago_expensa_extra.map((e) => ({ concepto: e.concepto, monto: e.monto.toNumber() })),
  ];
  const total = deuda.pago_expensa_extra.reduce((t, e) => t.plus(e.monto), deuda.monto);
  return { lineas, total };
};

// Campos de una deuda que hacen falta para calcular su total y su mora
const SELECT_COBRO = {
  id_expensa: true,
  monto: true,
  fecha_vencimiento: true,
  expensa: { select: { mora_valor: true } },
  pago_expensa_extra: { select: { monto: true } },
} as const;

type DeudaCobro = {
  monto: Prisma.Decimal;
  fecha_vencimiento: Date;
  id_expensa: bigint | null;
  expensa: { mora_valor: Prisma.Decimal } | null;
  pago_expensa_extra: { monto: Prisma.Decimal }[];
};

// Lo que se debe sin la mora: expensa + extras de la deuda
const montoSinMora = (deuda: DeudaCobro) =>
  deuda.pago_expensa_extra.reduce((total, e) => total.plus(e.monto), deuda.monto);

// Mora de una deuda en el momento `ahora`, con la regla vigente. Si es por porcentaje,
// se calcula sobre la expensa más los extras.
const moraDe = (deuda: DeudaCobro, regla: ReglaMora, ahora: Date) =>
  calcularMora(
    {
      monto: montoSinMora(deuda),
      fecha_vencimiento: deuda.fecha_vencimiento,
      id_expensa: deuda.id_expensa,
      mora_valor_expensa: deuda.expensa?.mora_valor ?? null,
    },
    regla,
    ahora,
  );

@Injectable()
export class ExpensasService {
  private readonly logger = new Logger(ExpensasService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async reglaMora(db: Prisma.TransactionClient = this.prisma) {
    try {
      const regla = await db.regla_mora.findFirst({ orderBy: { id: 'asc' } });
      return regla ? { ...regla, configurada: true } : REGLA_POR_DEFECTO;
    } catch (e) {
      // P2021: la tabla aún no se creó en esta base (ver prisma/sql/regla_mora.sql)
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2021') {
        return REGLA_POR_DEFECTO;
      }
      throw e;
    }
  }

  async obtenerReglaMora() {
    const r = await this.reglaMora();
    return {
      dia: r.dia,
      // "HH:mm" en hora de La Paz
      hora: horaTexto(r.hora),
      tipo: r.tipo,
      valor: r.valor.toNumber(),
      tope: r.tope?.toNumber() ?? null,
      frecuencia: r.frecuencia,
      // false: todavía se usa el mora_valor de cada expensa
      configurada: r.configurada,
      ...('updated_at' in r ? { updated_at: r.updated_at } : {}),
    };
  }

  /**
   * Guarda la regla y recalcula la mora de las deudas vencidas sin pagar.
   * El nuevo día y la nueva hora solo se usan para las deudas que se creen desde ahora.
   */
  async guardarReglaMora(dto: ReglaMoraDto) {
    if (dto.tipo === 'porcentaje' && dto.valor > 100) {
      throw new BadRequestException('El porcentaje no puede superar el 100%');
    }

    const data = {
      dia: dto.dia,
      ...(dto.hora ? { hora: horaDesdeTexto(dto.hora) } : {}),
      tipo: dto.tipo,
      valor: dto.valor.toFixed(2),
      tope: dto.tope != null ? dto.tope.toFixed(2) : null,
      frecuencia: dto.frecuencia,
      updated_at: new Date(),
    };
    const actual = await this.prisma.regla_mora.findFirst({ orderBy: { id: 'asc' } });
    if (actual) {
      await this.prisma.regla_mora.update({ where: { id: actual.id }, data });
    } else {
      await this.prisma.regla_mora.create({ data });
    }

    await this.aplicarVencimientos();
    return this.obtenerReglaMora();
  }

  /** Departamentos activos de un tipo. */
  private async departamentosDelTipo(idTipo: bigint) {
    const departamentos = await this.prisma.departamento.findMany({
      where: { estatus: true, tipo_departamento: idTipo },
      select: { id: true, piso: true, numero: true },
      orderBy: [{ piso: 'asc' }, { numero: 'asc' }],
    });
    if (departamentos.length === 0) {
      throw new BadRequestException(
        'No hay departamentos activos de ese tipo para asignar la expensa',
      );
    }
    return departamentos;
  }

  /**
   * Departamentos por id. Se leen en una consulta aparte (y no con include) para no
   * depender de las relaciones de la tabla departamento, que administra otro módulo.
   */
  private async departamentosPorId(ids: bigint[]) {
    const departamentos = await this.prisma.departamento.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, numero: true, piso: true, tipo_departamento: true },
    });
    return new Map(departamentos.map((d) => [d.id, d]));
  }

  /** Nombre del ocupante actual de cada departamento (solo lectura). */
  private async responsables(ids: bigint[]) {
    const ocupaciones = await this.prisma.departamento_usuario.findMany({
      where: { id_departamento: { in: ids }, estatus: true, fecha_fin_ocupacion: null },
      orderBy: { fecha_ocupacion: 'desc' },
      select: {
        id_departamento: true,
        usuario: { select: { nombres: true, apellido_paterno: true, apellido_materno: true } },
      },
    });
    const nombres = new Map<bigint, string>();
    for (const o of ocupaciones) {
      // Vienen de la más reciente a la más antigua: se queda la primera
      if (nombres.has(o.id_departamento)) continue;
      const u = o.usuario;
      nombres.set(
        o.id_departamento,
        [u.nombres, u.apellido_paterno, u.apellido_materno].filter(Boolean).join(' '),
      );
    }
    return nombres;
  }

  private async estadoPendiente() {
    const pendiente = await this.prisma.estado_deuda.findFirst({
      where: { nombre: 'pendiente' },
    });
    if (!pendiente) {
      throw new BadRequestException('Falta el estado "pendiente" en la tabla estado_deuda');
    }
    return pendiente;
  }

  /** Inserta una deuda por departamento, todas por el mismo monto. */
  private async insertarDeudas(
    tx: Prisma.TransactionClient,
    idExpensa: bigint,
    monto: Prisma.Decimal | string,
    departamentos: { id: bigint }[],
    vencimiento: Date,
    idEstado: bigint,
  ) {
    await tx.pago_expensa.createMany({
      data: departamentos.map((d) => ({
        id_departamento: d.id,
        id_expensa: idExpensa,
        monto,
        id_estado: idEstado,
        fecha_vencimiento: vencimiento,
      })),
    });

    // Si el departamento tiene saldo a favor, las deudas nuevas se pagan solas
    await this.consumirFondos(tx, departamentos.map((d) => d.id));
  }

  /**
   * Lo que comparten las expensas al generar un mes. Cada dato se consulta la primera vez
   * que se necesita y luego se reutiliza (también los errores, que se repiten igual).
   */
  private contextoGeneracion() {
    let regla: Promise<ReglaMora> | undefined;
    let pendiente: Promise<{ id: bigint }> | undefined;
    const porTipo = new Map<bigint, Promise<{ id: bigint }[]>>();
    return {
      regla: () => (regla ??= this.reglaMora()),
      pendiente: () => (pendiente ??= this.estadoPendiente()),
      departamentos: (tipo: bigint) => {
        let p = porTipo.get(tipo);
        if (!p) {
          p = this.departamentosDelTipo(tipo);
          // Evita un "unhandled rejection" si nadie llega a esperarla
          p.catch(() => undefined);
          porTipo.set(tipo, p);
        }
        return p;
      },
    };
  }

  /**
   * Genera las deudas de un mes para una expensa. `conDeuda` son los departamentos que ya
   * tienen deuda de esa expensa ese mes (por ejemplo, por pago anticipado): se omiten.
   */
  private async generarDeudasDeExpensa(
    expensa: { id: bigint; monto_total: Prisma.Decimal; tipo_departamento: bigint },
    mes: Date,
    conDeuda: Set<bigint>,
    contexto: ReturnType<ExpensasService['contextoGeneracion']>,
  ) {
    if (mes < mesActual()) {
      throw new BadRequestException('No se pueden generar deudas de meses pasados');
    }

    const vencimiento = calcularVencimiento(mes, await contexto.regla());
    const departamentos = await contexto.departamentos(expensa.tipo_departamento);

    const faltantes = departamentos.filter((d) => !conDeuda.has(d.id));
    if (faltantes.length === 0) {
      throw new ConflictException('Ya se generaron las deudas de ese mes para esta expensa');
    }

    const pendiente = await contexto.pendiente();

    try {
      await this.prisma.$transaction(
        (tx) =>
          this.insertarDeudas(
            tx,
            expensa.id,
            expensa.monto_total,
            faltantes,
            vencimiento,
            pendiente.id,
          ),
        { timeout: 30000 },
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya se generaron las deudas de ese mes para esta expensa');
      }
      throw e;
    }

    return serialize({
      id_expensa: expensa.id,
      mes,
      fecha_vencimiento: vencimiento,
      deudas_generadas: faltantes.length,
    });
  }

  /**
   * Genera las deudas de un mes para todas las expensas.
   * Es idempotente: lo que ya existe se omite.
   */
  async generarDeudasMensuales(mes: Date) {
    const expensas = await this.prisma.expensa.findMany({
      where: { tipo_departamento: { not: null } }, // ignora expensas sin tipo
      select: { id: true, nombre: true, monto_total: true, tipo_departamento: true },
      orderBy: { id: 'asc' },
    });

    // Deudas que ya existen ese mes, de todas las expensas en una sola consulta.
    // Se busca por mes y no por fecha exacta: el día y la hora de vencimiento pueden haber cambiado.
    const existentes = await this.prisma.pago_expensa.findMany({
      where: {
        id_expensa: { in: expensas.map((e) => e.id) },
        fecha_vencimiento: vencimientosDelMes(mes),
      },
      select: { id_expensa: true, id_departamento: true },
    });
    const conDeuda = new Map<bigint, Set<bigint>>();
    for (const e of existentes) {
      const set = conDeuda.get(e.id_expensa!) ?? new Set<bigint>();
      set.add(e.id_departamento);
      conDeuda.set(e.id_expensa!, set);
    }

    const contexto = this.contextoGeneracion();
    const resultado = { generadas: 0, omitidas: 0, errores: 0 };

    for (const expensa of expensas) {
      try {
        await this.generarDeudasDeExpensa(
          { id: expensa.id, monto_total: expensa.monto_total, tipo_departamento: expensa.tipo_departamento! },
          mes,
          conDeuda.get(expensa.id) ?? new Set(),
          contexto,
        );
        resultado.generadas++;
      } catch (e) {
        if (e instanceof ConflictException) {
          resultado.omitidas++;
        } else {
          resultado.errores++;
          this.logger.error(
            `Expensa "${expensa.nombre}" (${mes.toISOString().slice(0, 7)}): ${
              e instanceof Error ? e.message : e
            }`,
          );
        }
      }
    }

    return resultado;
  }

  /**
   * Pasa a vencida (4) las deudas pendientes (2) cuyo vencimiento (fecha y hora) ya llegó
   * y calcula la mora con la regla vigente:
   *   por unidad = % de lo que se debe (expensa + extras) o monto fijo (limitado por el tope)
   *   unidades   = meses (uno más cada vez que llega el día y la hora del vencimiento)
   *                o días (uno más cada 24 horas desde el vencimiento, contando el primero)
   * A las que ya están vencidas les actualiza la mora. Las pagadas (3) no se tocan.
   * Las deudas que el saldo a favor cubre ya se pagaron al crearse, así que aquí no se miran fondos.
   * Es idempotente: recalcula el total, no suma sobre lo anterior.
   */
  async aplicarVencimientos() {
    const ahora = relojAhora();
    const regla = await this.reglaMora();

    const deudas = await this.prisma.pago_expensa.findMany({
      where: {
        id_estado: { in: [ESTADO_PENDIENTE, ESTADO_VENCIDA] },
        fecha_vencimiento: { lte: ahora },
      },
      select: { id: true, id_estado: true, monto_mora: true, ...SELECT_COBRO },
    });

    // Solo se escriben las deudas cuyo estado o mora cambian
    const cambios = deudas
      .map((d) => ({
        id: d.id,
        mora: moraDe(d, regla, ahora),
        cambia: d.id_estado !== ESTADO_VENCIDA,
        moraAnterior: d.monto_mora,
      }))
      .filter((c) => c.cambia || !c.mora.equals(c.moraAnterior));

    // Un solo update por cada valor de mora distinto, no uno por deuda
    const porMora = new Map<string, { mora: Prisma.Decimal; ids: bigint[] }>();
    for (const c of cambios) {
      const clave = c.mora.toString();
      const grupo = porMora.get(clave) ?? { mora: c.mora, ids: [] };
      grupo.ids.push(c.id);
      porMora.set(clave, grupo);
    }

    // El filtro por estado evita reabrir una deuda que se pagó mientras tanto
    const resultados = await this.prisma.$transaction(
      [...porMora.values()].map((g) =>
        this.prisma.pago_expensa.updateMany({
          where: { id: { in: g.ids }, id_estado: { in: [ESTADO_PENDIENTE, ESTADO_VENCIDA] } },
          data: { id_estado: ESTADO_VENCIDA, monto_mora: g.mora },
        }),
      ),
    );

    return { actualizadas: resultados.reduce((suma, r) => suma + r.count, 0) };
  }

  /**
   * Paga una deuda completa: crea la factura y la pasa a estado "pagada".
   * No hay pagos parciales: el monto recibido debe ser el total (expensa + extras + mora).
   * La mora se calcula en el momento del pago: no depende de que el cron ya haya pasado.
   */
  async pagar(idPago: number, dto: PagarExpensaDto, idUsuario: string) {
    const pago = await this.prisma.pago_expensa.findUnique({
      where: { id: BigInt(idPago) },
      select: { id: true, id_estado: true, ...SELECT_COBRO },
    });
    if (!pago) throw new NotFoundException('Deuda no encontrada');
    if (pago.id_estado === ESTADO_PAGADA) {
      throw new ConflictException('Esta deuda ya está pagada');
    }

    const mora = moraDe(pago, await this.reglaMora(), relojAhora());
    const monto = montoSinMora(pago).plus(mora);
    if (dto.monto !== undefined && !monto.equals(dto.monto.toFixed(2))) {
      throw new BadRequestException(
        `El pago debe cubrir el total de la deuda: Bs. ${monto.toFixed(2)}`,
      );
    }
    // La deuda vence el mes siguiente; el mes cubierto es el anterior
    const fechaCubierta = mesCubierto(pago.fecha_vencimiento);

    const factura = await this.prisma.$transaction(async (tx) => {
      // El filtro por estado evita doble pago si llegan dos requests a la vez
      const { count } = await tx.pago_expensa.updateMany({
        where: { id: pago.id, id_estado: { not: ESTADO_PAGADA } },
        data: { id_estado: ESTADO_PAGADA, monto_mora: mora },
      });
      if (count === 0) throw new ConflictException('Esta deuda ya está pagada');

      return tx.factura_pago_expensa.create({
        data: {
          id_usuario: idUsuario,
          id_pago_expensa: pago.id,
          fecha_pago: dto.fecha ? new Date(dto.fecha) : hoyLaPaz(),
          fecha_cubierta: fechaCubierta,
          monto,
          metodo: dto.metodo,
          referencia: dto.referencia,
        },
      });
    });

    return serialize(factura);
  }

  /** Saldo de fondos por departamento: depósitos menos consumos. */
  private async saldosFondos(db: Prisma.TransactionClient, idsDepartamento: bigint[]) {
    const grupos = await db.movimiento_fondo.groupBy({
      by: ['id_departamento', 'tipo'],
      where: { id_departamento: { in: idsDepartamento } },
      _sum: { monto: true },
    });
    const saldos = new Map<bigint, Prisma.Decimal>();
    for (const g of grupos) {
      if (g.tipo !== 'deposito' && g.tipo !== 'consumo') continue;
      const monto = g._sum.monto ?? new Prisma.Decimal(0);
      const saldo = saldos.get(g.id_departamento) ?? new Prisma.Decimal(0);
      saldos.set(g.id_departamento, g.tipo === 'deposito' ? saldo.plus(monto) : saldo.minus(monto));
    }
    return saldos;
  }

  /** Saldo de fondos de un departamento: depósitos menos consumos. */
  private async saldoFondos(db: Prisma.TransactionClient, idDepartamento: bigint) {
    const saldos = await this.saldosFondos(db, [idDepartamento]);
    return saldos.get(idDepartamento) ?? new Prisma.Decimal(0);
  }

  /**
   * Paga con el saldo a favor de cada departamento sus deudas sin pagar (expensa + extras +
   * la mora del momento, que es 0 si aún no vencen), de la más antigua a la más nueva
   * (deudasQueCubre): cada una completa, y se detiene en la primera que no cubre.
   * Devuelve cuántas deudas pagó.
   * Los saldos y las deudas se leen en una consulta cada uno, no una por departamento.
   */
  private async consumirFondos(tx: Prisma.TransactionClient, idsDepartamento: bigint[]) {
    const ids = [...new Set(idsDepartamento)];
    if (ids.length === 0) return 0;

    const saldos = await this.saldosFondos(tx, ids);
    const conSaldo = ids.filter((id) => saldos.get(id)?.gt(0));
    if (conSaldo.length === 0) return 0;

    const deudas = await tx.pago_expensa.findMany({
      where: {
        id_departamento: { in: conSaldo },
        id_estado: { in: [ESTADO_PENDIENTE, ESTADO_VENCIDA] },
      },
      orderBy: [{ fecha_vencimiento: 'asc' }, { id: 'asc' }],
      select: { id: true, id_departamento: true, id_estado: true, ...SELECT_COBRO },
    });
    // Se agrupan por departamento conservando el orden de la consulta
    const deudasPorDepartamento = new Map<bigint, typeof deudas>();
    for (const d of deudas) {
      const lista = deudasPorDepartamento.get(d.id_departamento) ?? [];
      lista.push(d);
      deudasPorDepartamento.set(d.id_departamento, lista);
    }

    const hoy = hoyLaPaz();
    const ahora = relojAhora();
    const regla = await this.reglaMora(tx);
    let pagadas = 0;
    for (const idDepartamento of conSaldo) {
      const conTotal = (deudasPorDepartamento.get(idDepartamento) ?? []).map((d) => {
        const mora = moraDe(d, regla, ahora);
        return { ...d, mora, total: montoSinMora(d).plus(mora) };
      });

      for (const { id, fecha_vencimiento, mora, total } of deudasQueCubre(
        saldos.get(idDepartamento)!,
        conTotal,
      )) {
        // El filtro por estado evita pagar dos veces una deuda que se pagó mientras tanto
        const { count } = await tx.pago_expensa.updateMany({
          where: { id, id_estado: { not: ESTADO_PAGADA } },
          data: { id_estado: ESTADO_PAGADA, monto_mora: mora },
        });
        if (count === 0) continue;

        const factura = await tx.factura_pago_expensa.create({
          data: {
            id_usuario: null,
            id_pago_expensa: id,
            fecha_pago: hoy,
            fecha_cubierta: mesCubierto(fecha_vencimiento),
            monto: total,
          },
        });
        await tx.movimiento_fondo.create({
          data: {
            id_departamento: idDepartamento,
            tipo: 'consumo',
            monto: total,
            fecha: hoy,
            id_factura: factura.id,
          },
        });
        pagadas++;
      }
    }
    return pagadas;
  }

  /**
   * Registra fondos para un departamento, aunque tenga deudas: el depósito paga al instante
   * sus deudas sin pagar, de la más antigua a la más nueva (las vencidas con su mora),
   * mientras alcance.
   */
  async depositarFondos(dto: DepositarFondosDto, idUsuario: string) {
    const departamento = await this.prisma.departamento.findUnique({
      where: { id: BigInt(dto.id_departamento) },
      select: { id: true },
    });
    if (!departamento) throw new NotFoundException('Departamento no encontrado');

    await this.prisma.$transaction(
      async (tx) => {
        await tx.movimiento_fondo.create({
          data: {
            id_departamento: departamento.id,
            tipo: 'deposito',
            monto: dto.monto.toFixed(2),
            fecha: dto.fecha ? new Date(dto.fecha) : hoyLaPaz(),
            metodo: dto.metodo,
            referencia: dto.referencia,
            id_usuario: idUsuario,
          },
        });
        await this.consumirFondos(tx, [departamento.id]);
      },
      { timeout: 30000 },
    );

    return this.obtenerSaldo(dto.id_departamento);
  }

  async obtenerSaldo(idDepartamento: number) {
    const saldo = await this.saldoFondos(this.prisma, BigInt(idDepartamento));
    return serialize({ id_departamento: BigInt(idDepartamento), saldo });
  }

  /**
   * Datos de la pantalla de pagos: departamentos activos con su responsable y la
   * expensa mensual de su tipo, las deudas sin pagar y el saldo a favor de cada uno.
   */
  async resumenPagos() {
    const [departamentos, tipos, expensas, deudas, fondos] = await enOrden([
      this.prisma.departamento.findMany({
        where: { estatus: true },
        select: { id: true, numero: true, tipo_departamento: true },
        orderBy: [{ piso: 'asc' }, { numero: 'asc' }],
      }),
      this.prisma.tipo_departamento.findMany({ select: { id: true, nombre: true } }),
      this.prisma.expensa.findMany({
        where: { tipo_departamento: { not: null } },
        select: { tipo_departamento: true, monto_total: true },
      }),
      this.prisma.pago_expensa.findMany({
        where: { id_estado: { not: ESTADO_PAGADA } },
        select: {
          id: true,
          id_departamento: true,
          id_estado: true,
          monto: true,
          monto_mora: true,
          fecha_vencimiento: true,
          pago_expensa_extra: { select: { concepto: true, monto: true }, orderBy: { id: 'asc' } },
        },
        orderBy: [{ fecha_vencimiento: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.movimiento_fondo.groupBy({
        by: ['id_departamento', 'tipo'],
        _sum: { monto: true },
      }),
    ]);

    const nombres = nombresDeTipos(tipos);
    const numeros = new Map(departamentos.map((d) => [d.id, d.numero]));
    const responsables = await this.responsables(departamentos.map((d) => d.id));

    // Expensa mensual de cada tipo: suma de las expensas asignadas a ese tipo
    const tarifas = new Map<bigint, Prisma.Decimal>();
    for (const e of expensas) {
      const tipo = e.tipo_departamento!;
      tarifas.set(tipo, (tarifas.get(tipo) ?? new Prisma.Decimal(0)).plus(e.monto_total));
    }

    // Saldo a favor por número de departamento: depósitos menos consumos
    const aFavor: Record<number, number> = {};
    for (const f of fondos) {
      const numero = numeros.get(f.id_departamento);
      if (numero === undefined) continue;
      const monto = f._sum.monto?.toNumber() ?? 0;
      aFavor[numero] = (aFavor[numero] ?? 0) + (f.tipo === 'consumo' ? -monto : monto);
    }

    return {
      departamentos: departamentos.map((d) => ({
        id: d.id.toString(),
        numero: d.numero,
        categoria: (d.tipo_departamento !== null && nombres.get(d.tipo_departamento)) || '-',
        responsable: responsables.get(d.id) ?? 'Sin responsable',
        tarifa:
          d.tipo_departamento !== null
            ? (tarifas.get(d.tipo_departamento)?.toNumber() ?? 0)
            : 0,
      })),
      // Solo deudas de departamentos activos. El período es el mes cubierto
      // (la deuda vence el mes siguiente).
      deudas: deudas.filter((p) => numeros.has(p.id_departamento)).map((p) => ({
        id: p.id.toString(),
        departamento: numeros.get(p.id_departamento)!,
        periodo: periodoDe(p.fecha_vencimiento),
        // Momento (hora de La Paz) desde el que corre la mora
        vence: momentoLaPaz(p.fecha_vencimiento),
        // Expensa + extras, sin la mora
        monto: p.pago_expensa_extra.reduce((t, e) => t.plus(e.monto), p.monto).toNumber(),
        extras: p.pago_expensa_extra.map((e) => ({ concepto: e.concepto, monto: e.monto.toNumber() })),
        mora: p.monto_mora.toNumber(),
        vencida: p.id_estado === ESTADO_VENCIDA,
      })),
      aFavor,
    };
  }

  /** Pagos de expensas y depósitos de fondos, del más nuevo al más antiguo. */
  async historialPagos() {
    const usuarioSelect = { select: { nombres: true, apellido_paterno: true } };
    const nombreDe = (u: { nombres: string; apellido_paterno: string } | null) =>
      u ? `${u.nombres} ${u.apellido_paterno}` : 'Sistema (fondos)';

    const [facturas, depositos] = await enOrden([
      this.prisma.factura_pago_expensa.findMany({
        select: {
          id: true,
          fecha_pago: true,
          monto: true,
          metodo: true,
          referencia: true,
          usuario: usuarioSelect,
          pago_expensa: { select: { id_departamento: true } },
        },
        orderBy: { id: 'desc' },
      }),
      this.prisma.movimiento_fondo.findMany({
        where: { tipo: 'deposito' },
        select: {
          id: true,
          fecha: true,
          monto: true,
          metodo: true,
          referencia: true,
          usuario: usuarioSelect,
          id_departamento: true,
        },
        orderBy: { id: 'desc' },
      }),
    ]);

    const departamentos = await this.departamentosPorId([
      ...facturas.map((f) => f.pago_expensa.id_departamento),
      ...depositos.map((d) => d.id_departamento),
    ]);
    const numeroDe = (id: bigint) => departamentos.get(id)?.numero ?? 0;

    return [
      ...facturas.map((f) => ({
        id: `P-${f.id}`,
        fecha: f.fecha_pago.toISOString().slice(0, 10),
        departamento: numeroDe(f.pago_expensa.id_departamento),
        tipo: 'Pago de expensa',
        monto: f.monto.toNumber(),
        // Sin usuario = pagada automáticamente con los fondos del departamento
        metodo: f.metodo ?? (f.usuario ? '-' : 'Fondos'),
        referencia: f.referencia ?? '',
        usuario: nombreDe(f.usuario),
      })),
      ...depositos.map((d) => ({
        id: `D-${d.id}`,
        fecha: d.fecha.toISOString().slice(0, 10),
        departamento: numeroDe(d.id_departamento),
        tipo: 'Pago anticipado registrado',
        monto: d.monto.toNumber(),
        metodo: d.metodo ?? '-',
        referencia: d.referencia ?? '',
        usuario: nombreDe(d.usuario),
      })),
    ].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  /** Departamentos activos para el buscador del estado de cuenta. */
  async departamentosEstadoCuenta() {
    // Consultas una tras otra para no ocupar varias conexiones a la vez
    const departamentos = await this.prisma.departamento.findMany({
      where: { estatus: true },
      select: { id: true, numero: true, tipo_departamento: true },
      orderBy: [{ piso: 'asc' }, { numero: 'asc' }],
    });
    const tipos = await this.prisma.tipo_departamento.findMany({
      select: { id: true, nombre: true },
    });
    const responsables = await this.responsables(departamentos.map((d) => d.id));
    const nombres = nombresDeTipos(tipos);

    return departamentos.map((d) => ({
      numero: d.numero,
      categoria: (d.tipo_departamento !== null && nombres.get(d.tipo_departamento)) || '-',
      responsable: responsables.get(d.id) ?? 'Sin responsable',
    }));
  }

  /**
   * Estado de cuenta de un departamento, en orden cronológico:
   *  - expensa: lo emitido en cada mes (expensa base y extras), con su desglose
   *  - mora:    la mora de las deudas de ese mes
   *  - pago:    cada pago registrado por un usuario
   *  - anticipo: cada depósito de saldo a favor
   * Las deudas pagadas con saldo a favor no se listan como pago (el dinero ya figura
   * como anticipo); su expensa lo indica en el detalle.
   * saldo = deuda sin pagar (monto + mora) − saldo a favor. Negativo = a favor.
   */
  async estadoCuenta(numero: number) {
    const coincidencias = await this.prisma.departamento.findMany({
      where: { numero, estatus: true },
      select: { id: true, numero: true, tipo_departamento: true },
    });
    if (coincidencias.length === 0) throw new NotFoundException(`Departamento ${numero} no encontrado`);
    if (coincidencias.length > 1) {
      throw new BadRequestException(`Hay varios departamentos con el número ${numero}`);
    }
    const departamento = coincidencias[0];

    const tipo =
      departamento.tipo_departamento !== null
        ? await this.prisma.tipo_departamento.findUnique({
            where: { id: departamento.tipo_departamento },
            select: { nombre: true },
          })
        : null;
    const responsable =
      (await this.responsables([departamento.id])).get(departamento.id) ?? 'Sin responsable';

    const deudas = await this.prisma.pago_expensa.findMany({
      where: { id_departamento: departamento.id },
      select: {
        id_estado: true,
        monto: true,
        monto_mora: true,
        fecha_vencimiento: true,
        concepto: true,
        expensa: { select: { nombre: true } },
        pago_expensa_extra: { select: { concepto: true, monto: true }, orderBy: { id: 'asc' } },
        factura_pago_expensa: {
          select: { id: true, fecha_pago: true, monto: true, metodo: true, referencia: true, id_usuario: true },
        },
      },
      orderBy: [{ fecha_vencimiento: 'asc' }, { id: 'asc' }],
    });
    const fondos = await this.prisma.movimiento_fondo.findMany({
      where: { id_departamento: departamento.id },
      select: { id: true, tipo: true, monto: true, fecha: true, metodo: true, referencia: true },
      orderBy: { id: 'asc' },
    });

    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
      'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const nombrePeriodo = (periodo: string) => {
      const [anio, mes] = periodo.split('-').map(Number);
      return `${MESES[mes - 1]} ${anio}`;
    };

    type Movimiento = {
      id: string;
      fecha: string;
      tipo: 'expensa' | 'pago' | 'anticipo' | 'mora';
      detalle: string;
      monto: number;
      desglose?: { concepto: string; monto: number }[];
      vencimiento?: string;
      vence?: string;
    };
    type Mes = {
      periodo: string;
      emision: Date;
      vencimiento: Date;
      desglose: { concepto: string; monto: number }[];
      monto: Prisma.Decimal;
      mora: Prisma.Decimal;
      conFondos: boolean;
    };

    // Agrupa las deudas por mes cubierto (vencen el mes siguiente)
    const meses = new Map<string, Mes>();
    const pagos: Movimiento[] = [];
    let pendiente = new Prisma.Decimal(0);

    for (const d of deudas) {
      const periodo = periodoDe(d.fecha_vencimiento);
      let mes = meses.get(periodo);
      if (!mes) {
        const v = enLaPaz(d.fecha_vencimiento);
        mes = {
          periodo,
          // Se emite el mismo día del mes anterior al vencimiento
          emision: new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth() - 1, v.getUTCDate())),
          vencimiento: d.fecha_vencimiento,
          desglose: [],
          monto: new Prisma.Decimal(0),
          mora: new Prisma.Decimal(0),
          conFondos: false,
        };
        meses.set(periodo, mes);
      }
      const conceptos = conceptosDe(d);
      mes.desglose.push(...conceptos.lineas);
      mes.monto = mes.monto.plus(conceptos.total);
      mes.mora = mes.mora.plus(d.monto_mora);
      if (d.id_estado !== ESTADO_PAGADA) pendiente = pendiente.plus(conceptos.total).plus(d.monto_mora);

      for (const f of d.factura_pago_expensa) {
        if (f.id_usuario === null) {
          mes.conFondos = true;
          continue;
        }
        const extras = [f.metodo, f.referencia ? `Ref. ${f.referencia}` : null].filter(Boolean);
        pagos.push({
          id: `pag-${f.id}`,
          fecha: iso(f.fecha_pago),
          tipo: 'pago',
          detalle: [`Pago de la expensa de ${nombrePeriodo(periodo)}`, ...extras].join(' · '),
          monto: f.monto.toNumber(),
        });
      }
    }

    const movimientos: Movimiento[] = [];
    for (const mes of meses.values()) {
      movimientos.push({
        id: `exp-${mes.periodo}`,
        fecha: iso(mes.emision),
        tipo: 'expensa',
        detalle:
          `Expensa de ${nombrePeriodo(mes.periodo)}` +
          (mes.conFondos ? ' (pagada con saldo a favor)' : ''),
        monto: mes.monto.toNumber(),
        desglose: mes.desglose,
        // Último día para pagar sin mora y momento exacto en que empieza a correr
        vencimiento: ultimoDiaSinMora(mes.vencimiento),
        vence: momentoLaPaz(mes.vencimiento),
      });
      if (mes.mora.gt(0)) {
        movimientos.push({
          id: `mor-${mes.periodo}`,
          fecha: iso(enLaPaz(mes.vencimiento)),
          tipo: 'mora',
          detalle: `Mora de la expensa de ${nombrePeriodo(mes.periodo)}`,
          monto: mes.mora.toNumber(),
        });
      }
    }
    movimientos.push(...pagos);

    let aFavor = new Prisma.Decimal(0);
    for (const f of fondos) {
      if (f.tipo === 'consumo') {
        aFavor = aFavor.minus(f.monto);
        continue;
      }
      aFavor = aFavor.plus(f.monto);
      const extras = [f.metodo, f.referencia ? `Ref. ${f.referencia}` : null].filter(Boolean);
      movimientos.push({
        id: `ant-${f.id}`,
        fecha: iso(f.fecha),
        tipo: 'anticipo',
        detalle: ['Pago anticipado', ...extras].join(' · '),
        monto: f.monto.toNumber(),
      });
    }

    // Mismo día: primero lo emitido, luego mora, pagos y anticipos
    const orden = { expensa: 0, mora: 1, pago: 2, anticipo: 3 };
    movimientos.sort((a, b) => a.fecha.localeCompare(b.fecha) || orden[a.tipo] - orden[b.tipo]);

    const suma = (t: Movimiento['tipo']) =>
      movimientos
        .filter((m) => m.tipo === t)
        .reduce((total, m) => total.plus(m.monto), new Prisma.Decimal(0))
        .toNumber();

    return {
      depto: {
        numero: departamento.numero,
        categoria: tipo?.nombre?.trim().toUpperCase() || '-',
        responsable,
      },
      movimientos,
      totales: {
        expensas: suma('expensa'),
        pagos: suma('pago'),
        anticipos: suma('anticipo'),
        moras: suma('mora'),
        saldo: pendiente.minus(aFavor).toNumber(),
      },
    };
  }

  /**
   * Tarifas por categoría: las expensas configuradas para cada tipo de departamento
   * (A, B, C), con el nombre como concepto. Reemplaza las tarifas fijas del front.
   */
  async listarTarifas() {
    const [expensas, tipos] = await enOrden([
      this.prisma.expensa.findMany({
        where: { tipo_departamento: { not: null } },
        select: { nombre: true, monto_total: true, tipo_departamento: true },
        orderBy: { id: 'asc' },
      }),
      this.prisma.tipo_departamento.findMany({ select: { id: true, nombre: true } }),
    ]);
    const nombres = new Map(tipos.map((t) => [t.id, t.nombre?.trim().toUpperCase() ?? '']));

    const tarifas: Record<string, { concepto: string; monto: number }[]> = { A: [], B: [], C: [] };
    for (const e of expensas) {
      const categoria = nombres.get(e.tipo_departamento!);
      if (!categoria) continue;
      (tarifas[categoria] ??= []).push({ concepto: e.nombre, monto: e.monto_total.toNumber() });
    }
    return tarifas;
  }

  /** Cambia el monto de la expensa de una categoría; aplica a las deudas que se generen después. */
  async actualizarTarifa(dto: ActualizarTarifaDto) {
    const tipos = await this.prisma.tipo_departamento.findMany({ select: { id: true, nombre: true } });
    const tipo = tipos.find((t) => t.nombre?.trim().toUpperCase() === dto.categoria);
    if (!tipo) throw new NotFoundException(`No existe la categoría ${dto.categoria}`);

    const expensas = await this.prisma.expensa.findMany({
      where: { tipo_departamento: tipo.id },
      select: { id: true },
    });
    if (expensas.length === 0) {
      throw new NotFoundException(`La categoría ${dto.categoria} no tiene una expensa configurada`);
    }
    // Con varias no se sabe a cuál aplicar el monto
    if (expensas.length > 1) {
      throw new ConflictException(
        `La categoría ${dto.categoria} tiene ${expensas.length} expensas configuradas; debe tener una sola`,
      );
    }

    await this.prisma.expensa.update({
      where: { id: expensas[0].id },
      data: { monto_total: dto.monto.toFixed(2) },
    });
    return this.listarTarifas();
  }

  /**
   * Genera las expensas de un mes elegido. Solo crea las que faltan; si ya estaban
   * todas generadas, responde 409 y no genera nada.
   */
  async generarMes(periodo: string) {
    const mes = primerDiaDelMes(`${periodo}-01`);
    if (mes < mesActual()) {
      throw new BadRequestException('No se pueden generar expensas de meses pasados');
    }

    // Departamentos que ya tenían alguna deuda ese mes (solo los ids, no las filas completas)
    const previas = await this.prisma.pago_expensa.findMany({
      where: { fecha_vencimiento: vencimientosDelMes(mes) },
      select: { id_departamento: true },
      distinct: ['id_departamento'],
    });
    const departamentosPrevios = await this.departamentosPorId(
      previas.map((p) => p.id_departamento),
    );
    const antes = new Set([...departamentosPrevios.values()].map((d) => d.numero));
    const r = await this.generarDeudasMensuales(mes);
    if (r.generadas === 0) {
      if (r.errores > 0) throw new BadRequestException('No se pudieron generar las expensas. Intenta nuevamente.');
      throw new ConflictException('Ya se generaron las expensas de este mes');
    }

    const filas = await this.listarMensuales(periodo);
    return {
      periodo,
      generadas: filas.filter((f) => !antes.has(f.departamento)),
      omitidos: [],
      yaExistian: antes.size,
    };
  }

  /** Departamentos activos, con la forma que usa el front. */
  async listarDepartamentos() {
    const [departamentos, tipos] = await enOrden([
      this.prisma.departamento.findMany({
        where: { estatus: true },
        select: { numero: true, libre: true, tipo_departamento: true },
        orderBy: [{ piso: 'asc' }, { numero: 'asc' }],
      }),
      this.prisma.tipo_departamento.findMany({ select: { id: true, nombre: true } }),
    ]);
    const nombres = nombresDeTipos(tipos);

    return departamentos.map((d) => {
      const nombre = d.tipo_departamento !== null ? nombres.get(d.tipo_departamento) : undefined;
      return {
        numero: d.numero,
        categoria: nombre && ['A', 'B', 'C'].includes(nombre) ? nombre : null,
        ocupado: !d.libre,
      };
    });
  }

  /** Meses cubiertos por alguna deuda (YYYY-MM), del más nuevo al más antiguo. */
  async listarPeriodos() {
    const fechas = await this.prisma.pago_expensa.groupBy({ by: ['fecha_vencimiento'] });
    // La deuda vence el mes siguiente; el período es el mes cubierto
    const periodos = fechas.map((f) => periodoDe(f.fecha_vencimiento));
    return [...new Set(periodos)].sort().reverse();
  }

  /**
   * Una fila por departamento y mes. El desglose lista cada deuda (expensa base y extras)
   * y la mora acumulada como un concepto más.
   */
  async listarMensuales(periodo?: string) {
    if (periodo && !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      throw new BadRequestException('Periodo inválido: usa el formato YYYY-MM');
    }

    const [pagos, tipos] = await enOrden([
      this.prisma.pago_expensa.findMany({
        where: periodo
          ? { fecha_vencimiento: vencimientosDelMes(primerDiaDelMes(`${periodo}-01`)) }
          : undefined,
        select: {
          id_estado: true,
          monto: true,
          monto_mora: true,
          fecha_vencimiento: true,
          concepto: true,
          expensa: { select: { nombre: true } },
          pago_expensa_extra: { select: { concepto: true, monto: true }, orderBy: { id: 'asc' } },
          id_departamento: true,
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.tipo_departamento.findMany({ select: { id: true, nombre: true } }),
    ]);
    const nombres = new Map(tipos.map((t) => [t.id, t.nombre]));
    const departamentos = await this.departamentosPorId(pagos.map((p) => p.id_departamento));

    type Grupo = {
      id: string;
      departamento: number;
      categoria: string;
      periodo: string;
      fechaLimite: string;
      vence: string;
      desglose: { concepto: string; monto: number }[];
      total: Prisma.Decimal;
      mora: Prisma.Decimal;
      pendiente: boolean;
    };
    const grupos = new Map<string, Grupo>();

    for (const p of pagos) {
      // La deuda vence el mes siguiente; el período es el mes cubierto
      const periodoFila = periodoDe(p.fecha_vencimiento);
      const departamento = departamentos.get(p.id_departamento);
      if (!departamento) continue;
      const numero = departamento.numero;
      const clave = `${periodoFila}-${numero}`;

      let g = grupos.get(clave);
      if (!g) {
        const tipoId = departamento.tipo_departamento;
        g = {
          id: clave,
          departamento: numero,
          categoria: (tipoId !== null && nombres.get(tipoId)) || '-',
          periodo: periodoFila,
          // Último día para pagar sin mora y momento exacto en que empieza a correr
          fechaLimite: ultimoDiaSinMora(p.fecha_vencimiento),
          vence: momentoLaPaz(p.fecha_vencimiento),
          desglose: [],
          total: new Prisma.Decimal(0),
          mora: new Prisma.Decimal(0),
          pendiente: false,
        };
        grupos.set(clave, g);
      }

      const conceptos = conceptosDe(p);
      g.desglose.push(...conceptos.lineas);
      g.total = g.total.plus(conceptos.total).plus(p.monto_mora);
      g.mora = g.mora.plus(p.monto_mora);
      if (p.id_estado !== ESTADO_PAGADA) g.pendiente = true;
    }

    return [...grupos.values()]
      .map((g) => {
        if (g.mora.gt(0)) g.desglose.push({ concepto: 'Mora', monto: g.mora.toNumber() });
        return {
          id: g.id,
          departamento: g.departamento,
          categoria: g.categoria,
          periodo: g.periodo,
          desglose: g.desglose,
          total: g.total.toNumber(),
          fechaLimite: g.fechaLimite,
          vence: g.vence,
          estado: g.pendiente ? 'Pendiente' : 'Pagado',
        };
      })
      .sort((a, b) => b.periodo.localeCompare(a.periodo) || a.departamento - b.departamento);
  }

  /**
   * Añade extras a la deuda de un mes (el actual o el siguiente, ya generados) de cada
   * departamento. Se suman a la deuda del mes y se pagan con ella, en una sola factura.
   * Si esa deuda ya se pagó (a mano o con el saldo a favor), van a una deuda complementaria
   * del mismo mes (monto 0 + los extras), con el mismo vencimiento, su propia mora y su
   * propia factura. Así la mora solo corre sobre lo que falta pagar.
   */
  async crearExtras(dto: CrearExtrasDto) {
    const mes = primerDiaDelMes(`${dto.periodo}-01`);
    const actual = mesActual();
    if (mes < actual) {
      throw new BadRequestException('No se pueden registrar extras de meses pasados');
    }
    if (mes > sumarMeses(actual, 1)) {
      throw new BadRequestException('Solo se pueden registrar extras del mes actual o del siguiente');
    }

    const numeros = [...new Set(dto.extras.map((e) => e.departamento))];
    const departamentos = await this.prisma.departamento.findMany({
      where: { numero: { in: numeros }, estatus: true },
      select: { id: true, numero: true },
    });
    for (const n of numeros) {
      const coincidencias = departamentos.filter((d) => d.numero === n);
      if (coincidencias.length === 0) {
        throw new NotFoundException(`Departamento ${n} no encontrado`);
      }
      if (coincidencias.length > 1) {
        throw new BadRequestException(`Hay varios departamentos con el número ${n}`);
      }
    }
    const idPorNumero = new Map(departamentos.map((d) => [d.numero, d.id]));

    // Deudas de expensa de ese mes de cada departamento, de la más antigua a la más nueva
    const deudasDelMes = await this.prisma.pago_expensa.findMany({
      where: {
        id_departamento: { in: [...idPorNumero.values()] },
        id_expensa: { not: null },
        fecha_vencimiento: vencimientosDelMes(mes),
      },
      select: { id: true, id_departamento: true, id_expensa: true, id_estado: true, fecha_vencimiento: true },
      orderBy: { id: 'asc' },
    });
    const sinExpensa = numeros.filter(
      (n) => !deudasDelMes.some((d) => d.id_departamento === idPorNumero.get(n)),
    );
    if (sinExpensa.length > 0) {
      throw new BadRequestException(
        `Primero genera las expensas de ${dto.periodo} para: Dpto. ${sinExpensa.join(', ')}.`,
      );
    }

    const pendiente = await this.estadoPendiente();

    await this.prisma.$transaction(
      async (tx) => {
        // Deuda del mes a la que se suman los extras de cada departamento
        const destino = new Map<bigint, bigint>();
        for (const idDepartamento of new Set(idPorNumero.values())) {
          const delDepartamento = deudasDelMes.filter((d) => d.id_departamento === idDepartamento);
          const sinPagar = delDepartamento.find((d) => d.id_estado !== ESTADO_PAGADA);
          if (sinPagar) {
            destino.set(idDepartamento, sinPagar.id);
            continue;
          }
          // Ya pagada por adelantado: deuda complementaria del mismo mes
          const base = delDepartamento[0];
          const complementaria = await tx.pago_expensa.create({
            data: {
              id_departamento: idDepartamento,
              id_expensa: base.id_expensa,
              monto: 0,
              id_estado: pendiente.id,
              fecha_vencimiento: base.fecha_vencimiento,
            },
            select: { id: true },
          });
          destino.set(idDepartamento, complementaria.id);
        }

        await tx.pago_expensa_extra.createMany({
          data: dto.extras.map((extra) => ({
            id_pago_expensa: destino.get(idPorNumero.get(extra.departamento)!)!,
            concepto: extra.concepto.trim(),
            monto: extra.monto.toFixed(2),
          })),
        });

        // Si el saldo a favor cubre la deuda con sus extras, se paga sola
        await this.consumirFondos(tx, [...destino.keys()]);
      },
      { timeout: 30000 },
    );

    const filas = (await this.listarMensuales(dto.periodo)).filter((f) =>
      numeros.includes(f.departamento),
    );
    return { periodo: dto.periodo, generadas: filas, omitidos: [], yaExistian: 0 };
  }
}