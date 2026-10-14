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

const ESTADO_PAGADA = BigInt(3);

const sumarMeses = (mes: Date, n: number) =>
  new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() + n, 1));

const serialize = <T>(data: T): T =>
  JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );

const primerDiaDelMes = (fecha: string) => {
  const d = new Date(fecha);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

const mesActual = () => primerDiaDelMes(new Date().toISOString());

// La deuda de un mes vence el día 1 del mes siguiente.
const calcularVencimiento = (mes: Date) =>
  new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() + 1, 1));

const hoyLaPaz = () =>
  new Date(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(new Date()),
  );
@Injectable()
export class ExpensasService {
  private readonly logger = new Logger(ExpensasService.name);

  constructor(private readonly prisma: PrismaService) {}

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
  }

  /** Muestra a qué departamentos se les asignaría la expensa, sin guardar nada. */
  async previsualizar(dto: CreateExpensaDto) {
    await this.validarTipo(dto.tipo_departamento);
    const departamentos = await this.departamentosDelTipo(BigInt(dto.tipo_departamento));
    return {
      monto_por_departamento: dto.monto_total.toFixed(2),
      fecha_vencimiento: calcularVencimiento(mesActual()),
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
    const vencimiento = calcularVencimiento(mesActual());

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

    const vencimiento = calcularVencimiento(mes);
    const departamentos = await this.departamentosDelTipo(expensa.tipo_departamento);

    // Omite los departamentos que ya tienen deuda ese mes (por ejemplo, por pago anticipado)
    const existentes = await this.prisma.pago_expensa.findMany({
      where: { id_expensa: expensa.id, fecha_vencimiento: vencimiento },
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

  async findOne(id: number) {
    const expensa = await this.prisma.expensa.findUnique({
      where: { id: BigInt(id) },
      include: {
        pago_expensa: {
          orderBy: [{ fecha_vencimiento: 'desc' }, { id_departamento: 'asc' }],
          include: {
            departamento: { select: { piso: true, numero: true } },
          },
        },
      },
    });
    if (!expensa) throw new NotFoundException('Expensa no encontrada');
    return serialize(expensa);
  }
  
    /** Paga una deuda completa: crea la factura y la pasa a estado "pagada". */
  async pagar(idPago: number, dto: PagarExpensaDto) {
    const pago = await this.prisma.pago_expensa.findUnique({
      where: { id: BigInt(idPago) },
    });
    if (!pago) throw new NotFoundException('Deuda no encontrada');
    if (pago.id_estado === ESTADO_PAGADA) {
      throw new ConflictException('Esta deuda ya está pagada');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: dto.id_usuario },
      select: { id: true },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const monto = pago.monto.plus(pago.monto_mora);
    // La deuda vence el día 1 del mes siguiente; el mes cubierto es el anterior
    const fechaCubierta = new Date(
      Date.UTC(
        pago.fecha_vencimiento.getUTCFullYear(),
        pago.fecha_vencimiento.getUTCMonth() - 1,
        1,
      ),
    );

    const factura = await this.prisma.$transaction(async (tx) => {
      // El filtro por estado evita doble pago si llegan dos requests a la vez
      const { count } = await tx.pago_expensa.updateMany({
        where: { id: pago.id, id_estado: { not: ESTADO_PAGADA } },
        data: { id_estado: ESTADO_PAGADA },
      });
      if (count === 0) throw new ConflictException('Esta deuda ya está pagada');

      return tx.factura_pago_expensa.create({
        data: {
          id_usuario: dto.id_usuario,
          id_pago_expensa: pago.id,
          fecha_pago: hoyLaPaz(),
          fecha_cubierta: fechaCubierta,
          monto,
        },
      });
    });

    return serialize(factura);
  }

    /** Paga por adelantado N meses de un departamento: crea las deudas ya pagadas y sus facturas. */
  async pagarAnticipado(dto: PagarAnticipadoDto) {
    const departamento = await this.prisma.departamento.findUnique({
      where: { id: BigInt(dto.id_departamento) },
      select: { id: true, tipo_departamento: true },
    });
    if (!departamento) throw new NotFoundException('Departamento no encontrado');
    if (departamento.tipo_departamento === null) {
      throw new BadRequestException('El departamento no tiene tipo asignado');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: dto.id_usuario },
      select: { id: true },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

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

    try {
      const facturas = await this.prisma.$transaction(
        async (tx) => {
          const pagos = await tx.pago_expensa.createManyAndReturn({
            data: mesesCubiertos.map((mes) => ({
              id_departamento: departamento.id,
              id_expensa: expensa.id,
              monto: expensa.monto_total,
              id_estado: ESTADO_PAGADA,
              fecha_vencimiento: calcularVencimiento(mes),
            })),
            select: { id: true, fecha_vencimiento: true },
          });

          await tx.factura_pago_expensa.createMany({
            data: pagos.map((p) => ({
              id_usuario: dto.id_usuario,
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
}