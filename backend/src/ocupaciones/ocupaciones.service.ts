import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearOcupacionDto } from './dto/crear-ocupacion.dto.js';
import { ocuparDepartamento } from './asignacion.js';

@Injectable()
export class OcupacionesService {
  constructor(private prisma: PrismaService) {}

  async crear(data: CrearOcupacionDto, adminId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: data.id_copropietario },
    });
    if (!usuario) {
      throw new NotFoundException(
        `Usuario con id ${data.id_copropietario} no encontrado`,
      );
    }

    const departamento = await this.prisma.departamento.findUnique({
      where: { id: BigInt(data.id_departamento) },
    });
    if (!departamento) {
      throw new NotFoundException(
        `Departamento con id ${data.id_departamento} no encontrado`,
      );
    }

    // En la base la columna se llama id_usuario; la API sigue usando id_copropietario
    const existe = await this.prisma.departamento_usuario.findFirst({
      where: {
        id_usuario: data.id_copropietario,
        id_departamento: BigInt(data.id_departamento),
        estatus: true,
      },
    });
    if (existe) {
      throw new ConflictException(
        'El copropietario ya está asociado a este departamento',
      );
    }

    const ocupacion = await this.prisma.conUsuario(adminId, async (tx) => {
      // Si ya vivió ahí antes se reactiva esa fila (la clave es departamento + usuario)
      await ocuparDepartamento(
        tx,
        data.id_copropietario,
        BigInt(data.id_departamento),
        new Date(data.fecha_ocupacion),
      );

      return tx.departamento_usuario.update({
        where: {
          id_departamento_id_usuario: {
            id_departamento: BigInt(data.id_departamento),
            id_usuario: data.id_copropietario,
          },
        },
        data: {
          fecha_fin_ocupacion: data.fecha_fin_ocupacion
            ? new Date(data.fecha_fin_ocupacion)
            : null,
        },
      });
    });

    return {
      message: 'Copropietario asociado al departamento correctamente',
      ocupacion: this.formatear(ocupacion),
    };
  }

  async historialPorDepartamento(id_departamento: bigint) {
    const historial = await this.prisma.departamento_usuario.findMany({
      where: { id_departamento },
      include: {
        usuario: true,
        departamento: {
          select: {
            id: true,
            numero: true,
            piso: true,
          },
        },
      },
      orderBy: { fecha_ocupacion: 'desc' },
    });

    if (historial.length === 0) {
      return {
        message: 'No hay historial de ocupantes para este departamento',
        historial: [],
      };
    }

    return {
      departamento: {
        id: historial[0].departamento.id.toString(),
        numero: historial[0].departamento.numero,
        piso: historial[0].departamento.piso,
      },
      total: historial.length,
      historial: historial.map((h) => ({
        ...this.formatear(h),
        usuario: {
          ...h.usuario,
          ci: h.usuario.ci.toString(),
        },
      })),
    };
  }

  async cerrar(id_copropietario: string, id_departamento: bigint, adminId: string) {
    const ocupacion = await this.prisma.departamento_usuario.findFirst({
      where: {
        id_usuario: id_copropietario,
        id_departamento,
        estatus: true,
      },
    });

    if (!ocupacion) {
      throw new NotFoundException(
        'No se encontró una ocupación activa para este usuario en este departamento',
      );
    }

    await this.prisma.conUsuario(adminId, async (tx) => {
      await tx.departamento_usuario.update({
        where: {
          id_departamento_id_usuario: {
            id_departamento,
            id_usuario: id_copropietario,
          },
        },
        data: {
          estatus: false,
          fecha_fin_ocupacion: new Date(),
        },
      });

      const otrasOcupaciones = await tx.departamento_usuario.count({
        where: { id_departamento, estatus: true },
      });

      if (otrasOcupaciones === 0) {
        await tx.departamento.update({
          where: { id: id_departamento },
          data: { libre: true },
        });
      }
    });

    return { message: 'Ocupación cerrada correctamente' };
  }

  private formatear(o: any) {
    return {
      ...o,
      id_departamento: o.id_departamento.toString(),
      // La API sigue respondiendo id_copropietario (en la base es id_usuario)
      id_copropietario: o.id_usuario,
      id_usuario: undefined,
    };
  }
}