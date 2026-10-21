import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { CreateExpensaDto } from './dto/create-expensa.dto.js';
import { GenerarDeudasDto } from './dto/generar-deudas.dto.js';
import { PagarExpensaDto } from './dto/pagar-expensa.dto.js';
import { PagarAnticipadoDto } from './dto/pagar-anticipado.dto.js';
import { CrearExtrasDto } from './dto/crear-extras.dto.js';
import { DepositarFondosDto } from './dto/depositar-fondos.dto.js';
import { ReglaMoraDto } from './dto/regla-mora.dto.js';
import { calcularMora, type ReglaMora } from './mora.js';

const ESTADO_PENDIENTE = BigInt(2);
const ESTADO_PAGADA = BigInt(3);
const ESTADO_VENCIDA = BigInt(4);

const serialize = <T>(data: T): T =>
  JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );

const sumarMeses = (mes: Date, n: number) =>
  new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() + n, 1));

// Fecha de hoy en La Paz, como Date en UTC a medianoche (para columnas @db.Date)
const hoyLaPaz = () =>
  new Date(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(new Date()),
  );

const primerDiaDelMes = (fecha: string) => {
  const d = new Date(fecha);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

const mesActual = () => primerDiaDelMes(hoyLaPaz().toISOString());

// La deuda de un mes vence el mes siguiente, en el día de cobro de mora vigente
// al crearla. Si luego cambia el día, las deudas ya creadas conservan el suyo.
const calcularVencimiento = (mes: Date, dia: number) =>
  new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() + 1, dia));

// Rango de vencimientos de las deudas de un mes (vencen en algún día del mes siguiente)
const vencimientosDelMes = (mes: Date) => ({ gte: sumarMeses(mes, 1), lt: sumarMeses(mes, 2) });

// Sin regla configurada (tabla vacía o inexistente): comportamiento anterior,
// deudas el día 1 y mora = mora_valor de cada expensa por mes.
const REGLA_POR_DEFECTO: ReglaMora = {
  dia: 1,
  tipo: 'fijo',
  valor: new Prisma.Decimal(0),
  tope: null,
  frecuencia: 'mes',
  configurada: false,
};

@Injectable()
export class ExpensasService {
  private readonly logger = new Logger(ExpensasService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async reglaMora() {
    try {
      const regla = await this.prisma.regla_mora.findFirst({ orderBy: { id: 'asc' } });
      return regla ? { ...regla, configurada: true } : REGLA_POR_DEFECTO;
    } catch (e) {
      // P2021: la tabla aún no se creó en esta base (ver prisma/sql/regla_mora.sql)
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2021') {
        return REGLA_POR_DEFECTO;
      }
      throw e;
    }
  }

  /** Día del mes en que se cobra la mora y se generan las deudas nuevas. */
  private async diaCobro() {
    return (await this.reglaMora()).dia;
  }

  /**
   * El cron genera las deudas del mes desde el día de cobro en adelante.
   * Sin regla configurada, solo el día 1, como antes.
   */
  async tocaGenerarDeudas() {
    const regla = await this.reglaMora();
    const hoy = hoyLaPaz().getUTCDate();
    return regla.configurada ? hoy >= regla.dia : hoy === 1;
  }

  async obtenerReglaMora() {
    const r = await this.reglaMora();
    return {
      dia: r.dia,
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
   * El nuevo día solo se usa para las deudas que se creen desde ahora.
   */
  async guardarReglaMora(dto: ReglaMoraDto) {
    if (dto.tipo === 'porcentaje' && dto.valor > 100) {
      throw new BadRequestException('El porcentaje no puede superar el 100%');
    }

    const data = {
      dia: dto.dia,
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

  private async validarTipo(idTipo: number | bigint) {
    const tipo = await this.prisma.tipo_departamento.findUnique({
      where: { id: BigInt(idTipo) },
    });
    if (!tipo) throw new NotFoundException('Tipo de departamento no encontrado');
    return tipo;
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

    // Si el departamento tiene fondos, las deudas nuevas se pagan solas
    await this.consumirFondos(tx, departamentos.map((d) => d.id));
  }

  /** Muestra a qué departamentos se les asignaría la expensa, sin guardar nada. */
  async previsualizar(dto: CreateExpensaDto) {
    await this.validarTipo(dto.tipo_departamento);
    const departamentos = await this.departamentosDelTipo(BigInt(dto.tipo_departamento));
    return {
      monto_por_departamento: dto.monto_total.toFixed(2),
      fecha_vencimiento: calcularVencimiento(mesActual(), await this.diaCobro()),
      total_departamentos: departamentos.length,
      departamentos: departamentos.map((d) => ({
        id_departamento: d.id.toString(),
        piso: d.piso,
        numero: d.numero,
        monto: dto.monto_total.toFixed(2),
      })),
    };
  }

  /** Crea la expensa y genera las deudas del mes actual. */
  async create(dto: CreateExpensaDto) {
    await this.validarTipo(dto.tipo_departamento);
    const departamentos = await this.departamentosDelTipo(BigInt(dto.tipo_departamento));
    const pendiente = await this.estadoPendiente();
    const vencimiento = calcularVencimiento(mesActual(), await this.diaCobro());

    try {
      const expensaId = await this.prisma.$transaction(
        async (tx) => {
          const expensa = await tx.expensa.create({
            data: {
              nombre: dto.nombre,
              monto_total: dto.monto_total.toFixed(2),
              mora_valor: (dto.mora_valor ?? 0).toFixed(2),
              tipo_departamento: BigInt(dto.tipo_departamento),
            },
          });
          await this.insertarDeudas(
            tx,
            expensa.id,
            expensa.monto_total,
            departamentos,
            vencimiento,
            pendiente.id,
          );
          return expensa.id;
        },
        { timeout: 30000 },
      );

      return this.findOne(Number(expensaId));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe una expensa con ese nombre');
      }
      throw e;
    }
  }

  /**
   * Genera las deudas de un mes para una expensa que ya existe.
   * Sin `mes`, usa el mes actual. No se permiten meses futuros.
   */
  async generarDeudas(id: number | bigint, dto: GenerarDeudasDto) {
    const expensa = await this.prisma.expensa.findUnique({
      where: { id: BigInt(id) },
    });
    if (!expensa) throw new NotFoundException('Expensa no encontrada');
    if (expensa.tipo_departamento === null) {
      throw new BadRequestException('La expensa no tiene tipo de departamento asignado');
    }

    const mes = dto.mes ? primerDiaDelMes(dto.mes) : mesActual();
    if (mes > mesActual()) {
      throw new BadRequestException('No se pueden generar deudas de meses futuros');
    }

    const vencimiento = calcularVencimiento(mes, await this.diaCobro());
    const departamentos = await this.departamentosDelTipo(expensa.tipo_departamento);

    // Omite los departamentos que ya tienen deuda ese mes (por ejemplo, por pago anticipado).
    // Se busca por mes y no por fecha exacta: el día de vencimiento puede haber cambiado.
    const existentes = await this.prisma.pago_expensa.findMany({
      where: { id_expensa: expensa.id, fecha_vencimiento: vencimientosDelMes(mes) },
      select: { id_departamento: true },
    });
    const conDeuda = new Set(existentes.map((e) => e.id_departamento));
    const faltantes = departamentos.filter((d) => !conDeuda.has(d.id));
    if (faltantes.length === 0) {
      throw new ConflictException('Ya se generaron las deudas de ese mes para esta expensa');
    }

    const pendiente = await this.estadoPendiente();

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
   * Genera las deudas del mes actual para todas las expensas.
   * Es idempotente: lo que ya existe se omite.
   */
  async generarDeudasMensuales() {
    const expensas = await this.prisma.expensa.findMany({
      where: { tipo_departamento: { not: null } }, // ignora expensas sin tipo
      select: { id: true, nombre: true },
      orderBy: { id: 'asc' },
    });

    const mes = mesActual();
    const resultado = { generadas: 0, omitidas: 0, errores: 0 };

    for (const expensa of expensas) {
      try {
        await this.generarDeudas(expensa.id, { mes: mes.toISOString() });
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
   * Pasa a vencida (4) las deudas pendientes (2) cuya fecha de vencimiento ya llegó
   * y calcula la mora con la regla vigente:
   *   por unidad = % del monto o monto fijo (limitado por el tope, si hay)
   *   unidades   = meses (cuenta uno más cada vez que llega el día del vencimiento)
   *                o días desde el vencimiento, contando el propio día
   * A las que ya están vencidas les actualiza la mora. Las pagadas (3) no se tocan.
   * Las deudas sin expensa (extras) pasan a vencida con mora 0.
   * Es idempotente: recalcula el total, no suma sobre lo anterior.
   */
  async aplicarVencimientos() {
    const hoy = hoyLaPaz();
    const regla = await this.reglaMora();

    const deudas = await this.prisma.pago_expensa.findMany({
      where: {
        id_estado: { in: [ESTADO_PENDIENTE, ESTADO_VENCIDA] },
        fecha_vencimiento: { lte: hoy },
      },
      select: {
        id: true,
        id_estado: true,
        id_expensa: true,
        monto: true,
        monto_mora: true,
        fecha_vencimiento: true,
        expensa: { select: { mora_valor: true } },
      },
    });

    // Solo se escriben las deudas cuyo estado o mora cambian
    const cambios = deudas
      .map((d) => ({
        id: d.id,
        mora: calcularMora(
          {
            monto: d.monto,
            fecha_vencimiento: d.fecha_vencimiento,
            id_expensa: d.id_expensa,
            mora_valor_expensa: d.expensa?.mora_valor ?? null,
          },
          regla,
          hoy,
        ),
        cambia: d.id_estado !== ESTADO_VENCIDA,
        moraAnterior: d.monto_mora,
      }))
      .filter((c) => c.cambia || !c.mora.equals(c.moraAnterior));

    // El filtro por estado evita reabrir una deuda que se pagó mientras tanto
    const resultados = await this.prisma.$transaction(
      cambios.map((c) =>
        this.prisma.pago_expensa.updateMany({
          where: { id: c.id, id_estado: { in: [ESTADO_PENDIENTE, ESTADO_VENCIDA] } },
          data: { id_estado: ESTADO_VENCIDA, monto_mora: c.mora },
        }),
      ),
    );

    return { actualizadas: resultados.reduce((suma, r) => suma + r.count, 0) };
  }

  async findOne(id: number) {
    const expensa = await this.prisma.expensa.findUnique({
      where: { id: BigInt(id) },
      include: {
        pago_expensa: {
          orderBy: [{ fecha_vencimiento: 'desc' }, { id_departamento: 'asc' }],
        },
      },
    });
    if (!expensa) throw new NotFoundException('Expensa no encontrada');

    const departamentos = await this.departamentosPorId(
      expensa.pago_expensa.map((p) => p.id_departamento),
    );
    return serialize({
      ...expensa,
      pago_expensa: expensa.pago_expensa.map((p) => {
        const d = departamentos.get(p.id_departamento);
        return { ...p, departamento: d ? { piso: d.piso, numero: d.numero } : null };
      }),
    });
  }

  /**
   * Paga una deuda completa: crea la factura y la pasa a estado "pagada".
   * No hay pagos parciales: el monto recibido debe ser el total (monto + mora).
   */
  async pagar(idPago: number, dto: PagarExpensaDto, idUsuario: string) {
    const pago = await this.prisma.pago_expensa.findUnique({
      where: { id: BigInt(idPago) },
    });
    if (!pago) throw new NotFoundException('Deuda no encontrada');
    if (pago.id_estado === ESTADO_PAGADA) {
      throw new ConflictException('Esta deuda ya está pagada');
    }

    const monto = pago.monto.plus(pago.monto_mora);
    if (dto.monto !== undefined && !monto.equals(dto.monto.toFixed(2))) {
      throw new BadRequestException(
        `El pago debe cubrir el total de la deuda: Bs. ${monto.toFixed(2)}`,
      );
    }
    // La deuda vence el día 1 del mes siguiente; el mes cubierto es el anterior
    const fechaCubierta = sumarMeses(pago.fecha_vencimiento, -1);

    const factura = await this.prisma.$transaction(async (tx) => {
      // El filtro por estado evita doble pago si llegan dos requests a la vez
      const { count } = await tx.pago_expensa.updateMany({
        where: { id: pago.id, id_estado: { not: ESTADO_PAGADA } },
        data: { id_estado: ESTADO_PAGADA },
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

    /** Saldo de fondos de un departamento: depósitos menos consumos. */
  private async saldoFondos(db: Prisma.TransactionClient, idDepartamento: bigint) {
    const grupos = await db.movimiento_fondo.groupBy({
      by: ['tipo'],
      where: { id_departamento: idDepartamento },
      _sum: { monto: true },
    });
    const suma = (tipo: string) =>
      grupos.find((g) => g.tipo === tipo)?._sum.monto ?? new Prisma.Decimal(0);
    return suma('deposito').minus(suma('consumo'));
  }

  /**
   * Paga con los fondos de cada departamento sus deudas pendientes o vencidas, de la más
   * antigua a la más nueva. Cada aplicación crea una factura (sin usuario) y un movimiento
   * de consumo. Si los fondos no alcanzan, la deuda queda con pago parcial.
   */
    /**
   * Paga con los fondos de cada departamento sus deudas pendientes o vencidas, de la más
   * antigua a la más nueva. Cada deuda se paga completa o no se paga: si los fondos no la
   * cubren, se detiene y el saldo queda intacto.
   */
  private async consumirFondos(tx: Prisma.TransactionClient, idsDepartamento: bigint[]) {
    for (const idDepartamento of idsDepartamento) {
      let saldo = await this.saldoFondos(tx, idDepartamento);
      if (saldo.lte(0)) continue;

      const deudas = await tx.pago_expensa.findMany({
        where: {
          id_departamento: idDepartamento,
          id_estado: { in: [ESTADO_PENDIENTE, ESTADO_VENCIDA] },
        },
        orderBy: [{ fecha_vencimiento: 'asc' }, { id: 'asc' }],
        select: { id: true, monto: true, monto_mora: true, fecha_vencimiento: true },
      });

      for (const deuda of deudas) {
        const total = deuda.monto.plus(deuda.monto_mora);
        if (saldo.lt(total)) break;

        const factura = await tx.factura_pago_expensa.create({
          data: {
            id_usuario: null,
            id_pago_expensa: deuda.id,
            fecha_pago: hoyLaPaz(),
            fecha_cubierta: sumarMeses(deuda.fecha_vencimiento, -1),
            monto: total,
          },
        });
        await tx.movimiento_fondo.create({
          data: {
            id_departamento: idDepartamento,
            tipo: 'consumo',
            monto: total,
            fecha: hoyLaPaz(),
            id_factura: factura.id,
          },
        });
        await tx.pago_expensa.update({
          where: { id: deuda.id },
          data: { id_estado: ESTADO_PAGADA },
        });

        saldo = saldo.minus(total);
      }
    }
  }

  /** Registra fondos para un departamento. Solo si está al día. */
  async depositarFondos(dto: DepositarFondosDto, idUsuario: string) {
    const departamento = await this.prisma.departamento.findUnique({
      where: { id: BigInt(dto.id_departamento) },
      select: { id: true },
    });
    if (!departamento) throw new NotFoundException('Departamento no encontrado');

    const pendientes = await this.prisma.pago_expensa.count({
      where: { id_departamento: departamento.id, id_estado: { not: ESTADO_PAGADA } },
    });
    if (pendientes > 0) {
      throw new ConflictException(
        'El departamento tiene deudas pendientes: los fondos solo se pueden registrar cuando está al día',
      );
    }

    await this.prisma.movimiento_fondo.create({
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

    return this.obtenerSaldo(dto.id_departamento);
  }

  async obtenerSaldo(idDepartamento: number) {
    const saldo = await this.saldoFondos(this.prisma, BigInt(idDepartamento));
    return serialize({ id_departamento: BigInt(idDepartamento), saldo });
  }
  
  /** Paga por adelantado N meses de un departamento: crea las deudas ya pagadas y sus facturas. */
  async pagarAnticipado(dto: PagarAnticipadoDto, idUsuario: string) {
    const departamento = await this.prisma.departamento.findUnique({
      where: { id: BigInt(dto.id_departamento) },
      select: { id: true, tipo_departamento: true },
    });
    if (!departamento) throw new NotFoundException('Departamento no encontrado');
    if (departamento.tipo_departamento === null) {
      throw new BadRequestException('El departamento no tiene tipo asignado');
    }

    const expensas = await this.prisma.expensa.findMany({
      where: {
        tipo_departamento: departamento.tipo_departamento,
        ...(dto.id_expensa ? { id: BigInt(dto.id_expensa) } : {}),
      },
    });
    if (expensas.length === 0) {
      throw new NotFoundException('No hay una expensa para el tipo de este departamento');
    }
    if (expensas.length > 1) {
      throw new BadRequestException(
        'Hay varias expensas para ese tipo de departamento: indica id_expensa',
      );
    }
    const expensa = expensas[0];

    // El vencimiento de la última deuda es el mes que sigue por cubrir
    const ultima = await this.prisma.pago_expensa.aggregate({
      where: { id_departamento: departamento.id, id_expensa: expensa.id },
      _max: { fecha_vencimiento: true },
    });
    const actual = mesActual();
    const siguiente = ultima._max.fecha_vencimiento;
    const inicio = siguiente && siguiente > actual ? siguiente : actual;

    const mesesCubiertos = Array.from({ length: dto.meses }, (_, i) => sumarMeses(inicio, i));
    const fechaPago = hoyLaPaz();
    const dia = await this.diaCobro();

    try {
      const facturas = await this.prisma.$transaction(
        async (tx) => {
          const pagos = await tx.pago_expensa.createManyAndReturn({
            data: mesesCubiertos.map((mes) => ({
              id_departamento: departamento.id,
              id_expensa: expensa.id,
              monto: expensa.monto_total,
              id_estado: ESTADO_PAGADA,
              fecha_vencimiento: calcularVencimiento(mes, dia),
            })),
            select: { id: true, fecha_vencimiento: true },
          });

          await tx.factura_pago_expensa.createMany({
            data: pagos.map((p) => ({
              id_usuario: idUsuario,
              id_pago_expensa: p.id,
              fecha_pago: fechaPago,
              fecha_cubierta: sumarMeses(p.fecha_vencimiento, -1),
              monto: expensa.monto_total,
            })),
          });

          return pagos.length;
        },
        { timeout: 30000 },
      );

      return serialize({
        id_departamento: departamento.id,
        id_expensa: expensa.id,
        meses_pagados: facturas,
        desde: mesesCubiertos[0],
        hasta: mesesCubiertos[mesesCubiertos.length - 1],
        monto_por_mes: expensa.monto_total,
        monto_total: expensa.monto_total.mul(dto.meses),
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existen deudas para alguno de esos meses');
      }
      throw e;
    }
  }

  /**
   * Datos de la pantalla de pagos: departamentos activos con su responsable y la
   * expensa mensual de su tipo, las deudas sin pagar y el saldo a favor de cada uno.
   */
  async resumenPagos() {
    const [departamentos, tipos, expensas, deudas, fondos] = await Promise.all([
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
        },
        orderBy: [{ fecha_vencimiento: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.movimiento_fondo.groupBy({
        by: ['id_departamento', 'tipo'],
        _sum: { monto: true },
      }),
    ]);

    const nombres = new Map(tipos.map((t) => [t.id, t.nombre?.trim().toUpperCase()]));
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
        periodo: sumarMeses(p.fecha_vencimiento, -1).toISOString().slice(0, 7),
        monto: p.monto.toNumber(),
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

    const [facturas, depositos] = await Promise.all([
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

  /** Departamentos activos, con la forma que usa el front. */
  async listarDepartamentos() {
    const [departamentos, tipos] = await Promise.all([
      this.prisma.departamento.findMany({
        where: { estatus: true },
        select: { numero: true, libre: true, tipo_departamento: true },
        orderBy: [{ piso: 'asc' }, { numero: 'asc' }],
      }),
      this.prisma.tipo_departamento.findMany({ select: { id: true, nombre: true } }),
    ]);
    const nombres = new Map(tipos.map((t) => [t.id, t.nombre?.trim().toUpperCase()]));

    return departamentos.map((d) => {
      const nombre = d.tipo_departamento !== null ? nombres.get(d.tipo_departamento) : undefined;
      return {
        numero: d.numero,
        categoria: nombre && ['A', 'B', 'C'].includes(nombre) ? nombre : null,
        ocupado: !d.libre,
      };
    });
  }

  /**
   * Una fila por departamento y mes. El desglose lista cada deuda (expensa base y extras)
   * y la mora acumulada como un concepto más.
   */
  async listarMensuales(periodo?: string) {
    if (periodo && !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      throw new BadRequestException('Periodo inválido: usa el formato YYYY-MM');
    }

    const [pagos, tipos] = await Promise.all([
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
      desglose: { concepto: string; monto: number }[];
      total: Prisma.Decimal;
      mora: Prisma.Decimal;
      pendiente: boolean;
    };
    const grupos = new Map<string, Grupo>();

    for (const p of pagos) {
      // La deuda vence el día 1 del mes siguiente; el período es el mes cubierto
      const periodoFila = sumarMeses(p.fecha_vencimiento, -1).toISOString().slice(0, 7);
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
          // Último día del mes cubierto
          fechaLimite: new Date(p.fecha_vencimiento.getTime() - 86400000)
            .toISOString()
            .slice(0, 10),
          desglose: [],
          total: new Prisma.Decimal(0),
          mora: new Prisma.Decimal(0),
          pendiente: false,
        };
        grupos.set(clave, g);
      }

      g.desglose.push({
        concepto: p.concepto ?? p.expensa?.nombre ?? 'Extra',
        monto: p.monto.toNumber(),
      });
      g.total = g.total.plus(p.monto).plus(p.monto_mora);
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
          estado: g.pendiente ? 'Pendiente' : 'Pagado',
        };
      })
      .sort((a, b) => b.periodo.localeCompare(a.periodo) || a.departamento - b.departamento);
  }

  /** Añade deudas extra a departamentos específicos para un mes. */
  async crearExtras(dto: CrearExtrasDto) {
    const mes = primerDiaDelMes(`${dto.periodo}-01`);
    if (mes > mesActual()) {
      throw new BadRequestException('No se pueden generar deudas de meses futuros');
    }
    // Misma fecha de vencimiento que las deudas que genera el cron para ese mes
    const vencimiento = calcularVencimiento(mes, await this.diaCobro());

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
    const pendiente = await this.estadoPendiente();

    // Deudas sueltas: sin expensa asociada (id_expensa null)
        await this.prisma.$transaction(
      async (tx) => {
        await tx.pago_expensa.createMany({
          data: dto.extras.map((extra) => ({
            id_departamento: idPorNumero.get(extra.departamento)!,
            id_expensa: null,
            concepto: extra.concepto.trim(),
            monto: extra.monto.toFixed(2),
            id_estado: pendiente.id,
            fecha_vencimiento: vencimiento,
          })),
        });
        await this.consumirFondos(tx, [...idPorNumero.values()]);
      },
      { timeout: 30000 },
    );

    const filas = (await this.listarMensuales(dto.periodo)).filter((f) =>
      numeros.includes(f.departamento),
    );
    return { periodo: dto.periodo, generadas: filas, omitidos: [], yaExistian: 0 };
  }
}