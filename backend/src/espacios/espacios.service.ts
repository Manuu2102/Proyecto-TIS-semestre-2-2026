import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { CrearEspacioDto } from './dto/crear-espacio.dto.js';
import { ActualizarEspacioDto } from './dto/actualizar-espacio.dto.js';
import { codigoDepartamento, departamentoValido } from '../ocupaciones/asignacion.js';

export type TipoEspacio = 'parqueos' | 'bauleras';

const NOMBRE: Record<TipoEspacio, string> = { parqueos: 'parqueo', bauleras: 'baulera' };
const PREFIJO: Record<TipoEspacio, string> = { parqueos: 'P', bauleras: 'B' };

type DepartamentoAsignado = { id: bigint; codigo: string; numero: number } | null;

/**
 * Parqueos y bauleras. Cada espacio se asigna a lo sumo a un departamento
 * (tablas departamento_parqueo / departamento_baulera); un departamento puede
 * tener varios espacios.
 */
@Injectable()
export class EspaciosService {
  constructor(private prisma: PrismaService) {}

  private formatear(
    tipo: TipoEspacio,
    e: { id: bigint; numero: number; piso: number; discapacitados?: boolean },
    depto: DepartamentoAsignado,
  ) {
    return {
      id: e.id.toString(),
      tipo: NOMBRE[tipo],
      numero: e.numero,
      piso: e.piso,
      ...(tipo === 'parqueos' && { discapacitados: e.discapacitados ?? false }),
      // "P-14" / "B-08", como lo muestra el front
      identificador: `${PREFIJO[tipo]}-${String(e.numero).padStart(2, '0')}`,
      id_departamento: depto?.id.toString() ?? null,
      departamento: depto ? codigoDepartamento(depto) : null,
    };
  }

  async listar() {
    const deptoSelect = { select: { id: true, codigo: true, numero: true } } as const;

    const parqueos = await this.prisma.parqueo.findMany({
      include: { departamento_parqueo: { take: 1, include: { departamento: deptoSelect } } },
      orderBy: { numero: 'asc' },
    });
    const bauleras = await this.prisma.baulera.findMany({
      include: { departamento_baulera: { take: 1, include: { departamento: deptoSelect } } },
      orderBy: { numero: 'asc' },
    });

    const espacios = [
      ...parqueos.map((p) =>
        this.formatear('parqueos', p, p.departamento_parqueo[0]?.departamento ?? null),
      ),
      ...bauleras.map((b) =>
        this.formatear('bauleras', b, b.departamento_baulera[0]?.departamento ?? null),
      ),
    ];

    return {
      total: espacios.length,
      asignados: espacios.filter((e) => e.id_departamento).length,
      espacios,
    };
  }

  /** El número identifica al espacio dentro de su tipo (P-14, B-08). */
  private async validarNumero(tipo: TipoEspacio, numero: number, excluirId?: bigint) {
    const where = { numero, ...(excluirId && { id: { not: excluirId } }) };
    const existe =
      tipo === 'parqueos'
        ? await this.prisma.parqueo.findFirst({ where })
        : await this.prisma.baulera.findFirst({ where });
    if (existe) {
      throw new ConflictException(`Ya existe el ${NOMBRE[tipo]} ${PREFIJO[tipo]}-${numero}`);
    }
  }

  private async buscar(tipo: TipoEspacio, id: bigint) {
    const espacio =
      tipo === 'parqueos'
        ? await this.prisma.parqueo.findUnique({ where: { id } })
        : await this.prisma.baulera.findUnique({ where: { id } });
    if (!espacio) {
      throw new NotFoundException(`No existe el ${NOMBRE[tipo]} con id ${id}`);
    }
    return espacio;
  }

  /** Reemplaza la asignación del espacio (null = queda sin asignar). */
  private async asignar(
    tx: Prisma.TransactionClient,
    tipo: TipoEspacio,
    idEspacio: bigint,
    idDepartamento: bigint | null,
  ) {
    if (tipo === 'parqueos') {
      await tx.departamento_parqueo.deleteMany({ where: { id_parqueo: idEspacio } });
      if (idDepartamento) {
        await tx.departamento_parqueo.create({
          data: { id_parqueo: idEspacio, id_departamento: idDepartamento },
        });
      }
    } else {
      await tx.departamento_baulera.deleteMany({ where: { id_baulera: idEspacio } });
      if (idDepartamento) {
        await tx.departamento_baulera.create({
          data: { id_baulera: idEspacio, id_departamento: idDepartamento },
        });
      }
    }
  }

  async crear(tipo: TipoEspacio, data: CrearEspacioDto, adminId: string) {
    if (tipo === 'bauleras' && data.discapacitados !== undefined) {
      throw new BadRequestException('Solo los parqueos tienen la opción de discapacitados.');
    }
    await this.validarNumero(tipo, data.numero);

    const idDepartamento = data.id_departamento ? BigInt(data.id_departamento) : null;
    if (idDepartamento) await departamentoValido(this.prisma, idDepartamento);

    const id = await this.prisma.conUsuario(adminId, async (tx) => {
      const espacio =
        tipo === 'parqueos'
          ? await tx.parqueo.create({
              data: {
                numero: data.numero,
                piso: data.piso,
                discapacitados: data.discapacitados ?? false,
              },
            })
          : await tx.baulera.create({ data: { numero: data.numero, piso: data.piso } });

      await this.asignar(tx, tipo, espacio.id, idDepartamento);
      return espacio.id;
    });

    return {
      message: `${NOMBRE[tipo][0].toUpperCase()}${NOMBRE[tipo].slice(1)} registrado correctamente`,
      espacio: await this.uno(tipo, id),
    };
  }

  async actualizar(tipo: TipoEspacio, id: bigint, data: ActualizarEspacioDto, adminId: string) {
    await this.buscar(tipo, id);
    if (tipo === 'bauleras' && data.discapacitados !== undefined) {
      throw new BadRequestException('Solo los parqueos tienen la opción de discapacitados.');
    }
    if (data.numero !== undefined) await this.validarNumero(tipo, data.numero, id);

    const cambiaAsignacion = data.id_departamento !== undefined;
    const idDepartamento = data.id_departamento ? BigInt(data.id_departamento) : null;
    if (idDepartamento) await departamentoValido(this.prisma, idDepartamento);

    const cambios = {
      ...(data.numero !== undefined && { numero: data.numero }),
      ...(data.piso !== undefined && { piso: data.piso }),
    };

    await this.prisma.conUsuario(adminId, async (tx) => {
      if (tipo === 'parqueos') {
        await tx.parqueo.update({
          where: { id },
          data: {
            ...cambios,
            ...(data.discapacitados !== undefined && { discapacitados: data.discapacitados }),
          },
        });
      } else {
        await tx.baulera.update({ where: { id }, data: cambios });
      }

      if (cambiaAsignacion) await this.asignar(tx, tipo, id, idDepartamento);
    });

    return {
      message: `${NOMBRE[tipo][0].toUpperCase()}${NOMBRE[tipo].slice(1)} actualizado correctamente`,
      espacio: await this.uno(tipo, id),
    };
  }

  /** Borra el espacio; su asignación se borra en cascada. */
  async eliminar(tipo: TipoEspacio, id: bigint, adminId: string) {
    await this.buscar(tipo, id);

    await this.prisma.conUsuario(adminId, (tx) =>
      tipo === 'parqueos'
        ? tx.parqueo.delete({ where: { id } })
        : tx.baulera.delete({ where: { id } }),
    );

    return { message: `${NOMBRE[tipo][0].toUpperCase()}${NOMBRE[tipo].slice(1)} eliminado correctamente` };
  }

  private async uno(tipo: TipoEspacio, id: bigint) {
    const deptoSelect = { select: { id: true, codigo: true, numero: true } } as const;

    if (tipo === 'parqueos') {
      const p = await this.prisma.parqueo.findUniqueOrThrow({
        where: { id },
        include: { departamento_parqueo: { take: 1, include: { departamento: deptoSelect } } },
      });
      return this.formatear(tipo, p, p.departamento_parqueo[0]?.departamento ?? null);
    }

    const b = await this.prisma.baulera.findUniqueOrThrow({
      where: { id },
      include: { departamento_baulera: { take: 1, include: { departamento: deptoSelect } } },
    });
    return this.formatear(tipo, b, b.departamento_baulera[0]?.departamento ?? null);
  }
}
