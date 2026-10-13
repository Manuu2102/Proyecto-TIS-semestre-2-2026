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
    const yaGeneradas = await this.prisma.pago_expensa.count({
      where: { id_expensa: expensa.id, fecha_vencimiento: vencimiento },
    });
    if (yaGeneradas > 0) {
      throw new ConflictException('Ya se generaron las deudas de ese mes para esta expensa');
    }

    const departamentos = await this.departamentosDelTipo(expensa.tipo_departamento);
    const pendiente = await this.estadoPendiente();

    try {
      await this.prisma.$transaction(
        (tx) =>
          this.insertarDeudas(
            tx,
            expensa.id,
            expensa.monto_total,
            departamentos,
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
      deudas_generadas: departamentos.length,
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
}