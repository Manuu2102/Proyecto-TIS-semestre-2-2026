import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearOcupacionDto } from './dto/crear-ocupacion.dto.js';

@Injectable()
export class OcupacionesService {
  constructor(private prisma: PrismaService) {}

  async crear(data: CrearOcupacionDto) {
    // id_copropietario ahora es UUID (String)
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

    const existe = await this.prisma.departamento_usuario.findFirst({
      where: {
        id_copropietario: data.id_copropietario,
        id_departamento: BigInt(data.id_departamento),
        estatus: true,
      },
    });
    if (existe) {
      throw new ConflictException(
        'El copropietario ya está asociado a este departamento',
      );
    }

    const ocupacion = await this.prisma.departamento_usuario.create({
      data: {
        id_copropietario: data.id_copropietario,
        id_departamento: BigInt(data.id_departamento),
        fecha_ocupacion: new Date(data.fecha_ocupacion),
        fecha_fin_ocupacion: data.fecha_fin_ocupacion
          ? new Date(data.fecha_fin_ocupacion)
          : null,
        estatus: true,
      },
    });

    await this.prisma.departamento.update({
      where: { id: BigInt(data.id_departamento) },
      data: { libre: false },
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

  async cerrar(id_copropietario: string, id_departamento: bigint) {
    const ocupacion = await this.prisma.departamento_usuario.findFirst({
      where: {
        id_copropietario,
        id_departamento,
        estatus: true,
      },
    });

    if (!ocupacion) {
      throw new NotFoundException(
        'No se encontró una ocupación activa para este usuario en este departamento',
      );
    }

    await this.prisma.departamento_usuario.update({
      where: {
        id_departamento_id_copropietario: {
          id_departamento,
          id_copropietario,
        },
      },
      data: {
        estatus: false,
        fecha_fin_ocupacion: new Date(),
      },
    });

    const otrasOcupaciones = await this.prisma.departamento_usuario.count({
      where: { id_departamento, estatus: true },
    });

    if (otrasOcupaciones === 0) {
      await this.prisma.departamento.update({
        where: { id: id_departamento },
        data: { libre: true },
      });
    }

    return { message: 'Ocupación cerrada correctamente' };
  }

  private formatear(o: any) {
    return {
      ...o,
      id_departamento: o.id_departamento.toString(),
    };
  }
}