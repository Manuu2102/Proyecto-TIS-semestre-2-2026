import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js'; // ver punto 3
import { Prisma, criterio_reparto } from '../generated/prisma/client.js';
import { CreateExpensaDto } from './dto/create-expensa.dto.js';

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

const serialize = <T>(data: T): T =>
  JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );

const primerDiaDelMes = (fecha: string) => {
  const d = new Date(fecha);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

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
  constructor(private readonly prisma: PrismaService) {}

  private validar(dto: CreateExpensaDto) {
    const bps = dto.componentes.map((c) => Math.round(c.porcentaje * 100));
    if (bps.reduce((a, b) => a + b, 0) !== 10000) {
      throw new BadRequestException('Los porcentajes de los componentes deben sumar 100');
    }
    const criterios = dto.componentes.map((c) => c.criterio);
    if (new Set(criterios).size !== criterios.length) {
      throw new BadRequestException('No se puede repetir un criterio en la misma expensa');
    }
    if (new Date(dto.fecha_vencimiento) < primerDiaDelMes(dto.periodo)) {
      throw new BadRequestException('La fecha de vencimiento no puede ser anterior al período');
    }
    if (dto.mora_tipo === 'porcentaje' && (dto.mora_valor ?? 0) > 100) {
      throw new BadRequestException('La mora en porcentaje no puede superar 100');
    }
  }

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

  async calcular(dto: CreateExpensaDto) {
    this.validar(dto);

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

    const totalCents = Math.round(dto.monto_total * 100);
    const bps = dto.componentes.map((c) => Math.round(c.porcentaje * 100));
    const centsPorComponente = distribute(totalCents, bps);

    const reparto: RepartoDepto[] = departamentos.map((d) => ({
      id_departamento: d.id,
      piso: d.piso,
      numero: d.numero,
      cents: 0,
      detalle: [],
    }));

    dto.componentes.forEach((comp, ci) => {
      const unidades = departamentos.map((d) => this.unidades(comp.criterio, d));
      if (unidades.reduce((a, b) => a + b, 0) === 0) {
        throw new BadRequestException(
          `Ningún departamento tiene unidades para el criterio "${comp.criterio}"`,
        );
      }
      const montos = distribute(centsPorComponente[ci], unidades);
      reparto.forEach((r, i) => {
        r.detalle.push({ criterio: comp.criterio, unidades: unidades[i], cents: montos[i] });
        r.cents += montos[i];
      });
    });

    return { totalCents, reparto };
  }

  async previsualizar(dto: CreateExpensaDto) {
    const { totalCents, reparto } = await this.calcular(dto);
    return {
      monto_total: money(totalCents),
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

  async create(dto: CreateExpensaDto) {
    const { totalCents, reparto } = await this.calcular(dto);

    const pendiente = await this.prisma.estado_deuda.findFirst({
      where: { nombre: 'pendiente' },
    });
    if (!pendiente) {
      throw new BadRequestException('Falta el estado "pendiente" en la tabla estado_deuda');
    }

    const periodo = primerDiaDelMes(dto.periodo);
    const vencimiento = new Date(dto.fecha_vencimiento);

    try {
      const expensaId = await this.prisma.$transaction(
        async (tx) => {
          const expensa = await tx.expensa.create({
            data: {
              nombre: dto.nombre,
              periodo,
              fecha_vencimiento: vencimiento,
              monto_total: money(totalCents),
              pagos_anticipados: dto.pagos_anticipados ?? false,
              mora_tipo: dto.mora_tipo ?? 'fijo',
              mora_valor: (dto.mora_valor ?? 0).toFixed(2),
              expensa_componente: {
                create: dto.componentes.map((c) => ({
                  criterio: c.criterio,
                  porcentaje: c.porcentaje.toFixed(2),
                })),
              },
            },
          });

          // Una deuda por departamento (requiere Prisma 5.14 o superior)
          const pagos = await tx.pago_expensa.createManyAndReturn({
            data: reparto.map((r) => ({
              id_departamento: r.id_departamento,
              id_expensa: expensa.id,
              monto: money(r.cents),
              id_estado: pendiente.id,
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

          return expensa.id;
        },
        { timeout: 30000 },
      );

      return this.findOne(Number(expensaId));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe una expensa con ese nombre en ese período');
      }
      throw e;
    }
  }

  async findOne(id: number) {
    const expensa = await this.prisma.expensa.findUnique({
      where: { id: BigInt(id) },
      include: {
        expensa_componente: true,
        pago_expensa: {
          orderBy: { id_departamento: 'asc' },
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
