import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
// Deja tus imports que ya te funcionan (PrismaService y cliente generado)
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, criterio_reparto } from '../generated/prisma/client.js';
import { CreateExpensaDto } from './dto/create-expensa.dto.js';
import { GenerarDeudasDto } from './dto/generar-deudas.dto.js';

type DetalleCalculado = {
  criterio: criterio_reparto;
  unidades: number;
  cents: number;
};

type RepartoDepto = {
  id_departamento: bigint;
  piso: number;
  numero: number;
  cents: number;
  detalle: DetalleCalculado[];
};

const money = (cents: number) => (cents / 100).toFixed(2);

// Los BigInt de Prisma no se pueden convertir a JSON directamente
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

/**
 * Reparte `totalCents` proporcionalmente a `weights` sin perder centavos:
 * método del mayor resto. La suma del resultado es exactamente `totalCents`.
 */
function distribute(totalCents: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const base = weights.map((w) => Math.floor((totalCents * w) / sum));
  let resto = totalCents - base.reduce((a, b) => a + b, 0);
  const orden = weights
    .map((w, i) => ({ i, rem: (totalCents * w) % sum }))
    .sort((a, b) => b.rem - a.rem);
  for (let k = 0; resto > 0; k++, resto--) {
    base[orden[k % orden.length].i] += 1;
  }
  return base;
}

@Injectable()
export class ExpensasService {
  private readonly logger = new Logger(ExpensasService.name);

  constructor(private readonly prisma: PrismaService) {}

  private unidades(
    criterio: criterio_reparto,
    d: {
      banos: number;
      superficie_m2: number;
      cantidad_habitantes: number;
      _count: { departamento_parqueo: number; departamento_baulera: number };
    },
  ): number {
    switch (criterio) {
      case 'igual':
        return 1;
      case 'habitantes':
        return d.cantidad_habitantes;
      case 'banos':
        return d.banos;
      case 'parqueos':
        return d._count.departamento_parqueo;
      case 'bauleras':
        return d._count.departamento_baulera;
      case 'superficie':
        return d.superficie_m2;
    }
  }

  /**
   * Calcula cuánto le toca a cada departamento, sin guardar nada.
   * El monto total se divide en partes iguales entre los criterios,
   * y cada parte se reparte según las unidades de cada departamento.
   */
  private async calcular(montoTotal: number, criterios: criterio_reparto[]) {
    const departamentos = await this.prisma.departamento.findMany({
      where: { estatus: true },
      select: {
        id: true,
        piso: true,
        numero: true,
        banos: true,
        superficie_m2: true,
        cantidad_habitantes: true,
        _count: {
          select: { departamento_parqueo: true, departamento_baulera: true },
        },
      },
      orderBy: [{ piso: 'asc' }, { numero: 'asc' }],
    });
    if (departamentos.length === 0) {
      throw new BadRequestException('No hay departamentos activos para repartir la expensa');
    }

    const totalCents = Math.round(montoTotal * 100);
    const centsPorCriterio = distribute(
      totalCents,
      criterios.map(() => 1),
    );

    const reparto: RepartoDepto[] = departamentos.map((d) => ({
      id_departamento: d.id,
      piso: d.piso,
      numero: d.numero,
      cents: 0,
      detalle: [],
    }));

    criterios.forEach((criterio, ci) => {
      const unidades = departamentos.map((d) => this.unidades(criterio, d));
      if (unidades.reduce((a, b) => a + b, 0) === 0) {
        throw new BadRequestException(
          `Ningún departamento tiene unidades para el criterio "${criterio}"`,
        );
      }
      const montos = distribute(centsPorCriterio[ci], unidades);
      reparto.forEach((r, i) => {
        r.detalle.push({ criterio, unidades: unidades[i], cents: montos[i] });
        r.cents += montos[i];
      });
    });

    return { totalCents, reparto };
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

  /** Inserta una deuda por departamento y su detalle. Va dentro de una transacción. */
  private async insertarDeudas(
    tx: Prisma.TransactionClient,
    idExpensa: bigint,
    reparto: RepartoDepto[],
    vencimiento: Date,
    idEstado: bigint,
  ) {
    // createManyAndReturn requiere Prisma 5.14 o superior
    const pagos = await tx.pago_expensa.createManyAndReturn({
      data: reparto.map((r) => ({
        id_departamento: r.id_departamento,
        id_expensa: idExpensa,
        monto: money(r.cents),
        id_estado: idEstado,
        fecha_vencimiento: vencimiento,
      })),
      select: { id: true, id_departamento: true },
    });

    const porDepto = new Map(reparto.map((r) => [r.id_departamento, r]));
    await tx.pago_expensa_detalle.createMany({
      data: pagos.flatMap((p) =>
        porDepto.get(p.id_departamento)!.detalle.map((d) => ({
          id_pago_expensa: p.id,
          criterio: d.criterio,
          unidades: d.unidades.toFixed(2),
          monto: money(d.cents),
        })),
      ),
    });
  }

  /** Muestra el reparto de una expensa nueva para el mes actual, sin guardar nada. */
  async previsualizar(dto: CreateExpensaDto) {
    const { totalCents, reparto } = await this.calcular(dto.monto_total, dto.criterios);
    return {
      monto_total: money(totalCents),
      fecha_vencimiento: calcularVencimiento(mesActual()),
      departamentos: reparto.map((r) => ({
        id_departamento: r.id_departamento.toString(),
        piso: r.piso,
        numero: r.numero,
        monto: money(r.cents),
        detalle: r.detalle.map((d) => ({
          criterio: d.criterio,
          unidades: d.unidades,
          monto: money(d.cents),
        })),
      })),
    };
  }

  /** Crea la expensa con sus criterios y genera las deudas del mes actual. */
  async create(dto: CreateExpensaDto) {
    const { totalCents, reparto } = await this.calcular(dto.monto_total, dto.criterios);
    const pendiente = await this.estadoPendiente();
    const vencimiento = calcularVencimiento(mesActual());

    try {
      const expensaId = await this.prisma.$transaction(
        async (tx) => {
          const expensa = await tx.expensa.create({
            data: {
              nombre: dto.nombre,
              monto_total: money(totalCents),
              pagos_anticipados: dto.pagos_anticipados ?? false,
              mora_valor: (dto.mora_valor ?? 0).toFixed(2),
              expensa_componente: {
                create: dto.criterios.map((criterio) => ({ criterio })),
              },
            },
          });
          await this.insertarDeudas(tx, expensa.id, reparto, vencimiento, pendiente.id);
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
   * - Sin `mes`, usa el mes actual.
   * - El mes siguiente solo se permite si la expensa tiene pagos anticipados.
   */
  async generarDeudas(id: number | bigint, dto: GenerarDeudasDto) {
    const expensa = await this.prisma.expensa.findUnique({
      where: { id: BigInt(id) },
      include: { expensa_componente: true },
    });
    if (!expensa) throw new NotFoundException('Expensa no encontrada');

    const mes = dto.mes ? primerDiaDelMes(dto.mes) : mesActual();
    const actual = mesActual();
    const siguiente = calcularVencimiento(actual);
    if (mes > siguiente) {
      throw new BadRequestException(
        'Solo se pueden generar deudas del mes actual o, con pagos anticipados, del siguiente',
      );
    }
    if (mes > actual && !expensa.pagos_anticipados) {
      throw new BadRequestException(
        'Esta expensa no permite pagos anticipados: no se pueden generar deudas del mes siguiente',
      );
    }

    const vencimiento = calcularVencimiento(mes);
    const yaGeneradas = await this.prisma.pago_expensa.count({
      where: { id_expensa: expensa.id, fecha_vencimiento: vencimiento },
    });
    if (yaGeneradas > 0) {
      throw new ConflictException('Ya se generaron las deudas de ese mes para esta expensa');
    }

    const criterios = expensa.expensa_componente.map((c) => c.criterio);
    if (criterios.length === 0) {
      throw new BadRequestException('La expensa no tiene criterios de reparto');
    }

    const { reparto } = await this.calcular(expensa.monto_total.toNumber(), criterios);
    const pendiente = await this.estadoPendiente();

    try {
      await this.prisma.$transaction(
        (tx) => this.insertarDeudas(tx, expensa.id, reparto, vencimiento, pendiente.id),
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
      deudas_generadas: reparto.length,
    });
  }

  /**
   * Genera las deudas del mes actual para todas las expensas y, si la expensa
   * tiene pagos anticipados, también las del mes siguiente.
   * Es idempotente: lo que ya existe se omite, así que se puede correr varias veces.
   */
  async generarDeudasMensuales() {
    const expensas = await this.prisma.expensa.findMany({
      select: { id: true, nombre: true, pagos_anticipados: true },
      orderBy: { id: 'asc' },
    });

    const actual = mesActual();
    const siguiente = calcularVencimiento(actual);
    const resultado = { generadas: 0, omitidas: 0, errores: 0 };

    for (const expensa of expensas) {
      const meses = expensa.pagos_anticipados ? [actual, siguiente] : [actual];

      for (const mes of meses) {
        try {
          await this.generarDeudas(expensa.id, { mes: mes.toISOString() });
          resultado.generadas++;
        } catch (e) {
          if (e instanceof ConflictException) {
            resultado.omitidas++; // ya estaban generadas
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
    }

    return resultado;
  }

  async findOne(id: number) {
    const expensa = await this.prisma.expensa.findUnique({
      where: { id: BigInt(id) },
      include: {
        expensa_componente: true,
        pago_expensa: {
          orderBy: [{ fecha_vencimiento: 'desc' }, { id_departamento: 'asc' }],
          include: {
            departamento: { select: { piso: true, numero: true } },
            pago_expensa_detalle: true,
          },
        },
      },
    });
    if (!expensa) throw new NotFoundException('Expensa no encontrada');
    return serialize(expensa);
  }
}