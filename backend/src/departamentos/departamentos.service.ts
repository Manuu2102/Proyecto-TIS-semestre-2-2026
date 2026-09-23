import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearDepartamentoDto } from './dto/crear-departamento.dto.js';
import { ActualizarDepartamentoDto } from './dto/actualizar-departamento.dto.js';

@Injectable()
export class DepartamentosService {
  constructor(private prisma: PrismaService) {}

  async crear(data: CrearDepartamentoDto) {
    const existe = await this.prisma.departamento.findFirst({
      where: { numero: data.numero, piso: data.piso },
    });

    if (existe) {
      throw new ConflictException(
        `Ya existe un departamento con número ${data.numero} en el piso ${data.piso}`,
      );
    }

    const departamento = await this.prisma.departamento.create({
      data: {
        numero: data.numero,
        piso: data.piso,
        habitaciones: data.habitaciones,
        banos: data.banos,
        superficie_m2: data.superficie_m2,
        precio: data.precio,
        estatus: true,
        amueblado: data.amueblado,
        descripcion: data.descripcion,
        libre: data.libre,
      },
    });

    return {
      message: 'Departamento creado correctamente',
      departamento: this.formatearDepartamento(departamento),
    };
  }

  async listar() {
    const departamentos = await this.prisma.departamento.findMany({
      orderBy: [{ piso: 'asc' }, { numero: 'asc' }],
    });

    return {
      total: departamentos.length,
      departamentos: departamentos.map((d) => this.formatearDepartamento(d)),
    };
  }

  async buscarPorId(id: bigint) {
    const departamento = await this.prisma.departamento.findUnique({
      where: { id },
      include: {
        departamento_usuario: {
          include: { usuario: true },
        },
        departamento_baulera: { include: { baulera: true } },
        departamento_parqueo: { include: { parqueo: true } },
      },
    });

    if (!departamento) {
      throw new NotFoundException(`Departamento con id ${id} no encontrado`);
    }

    return this.formatearDepartamentoConRelaciones(departamento);
  }

  async actualizar(id: bigint, data: ActualizarDepartamentoDto) {
    const existe = await this.prisma.departamento.findUnique({
      where: { id },
    });

    if (!existe) {
      throw new NotFoundException(`Departamento con id ${id} no encontrado`);
    }

    const departamento = await this.prisma.departamento.update({
      where: { id },
      data,
    });

    return {
      message: 'Departamento actualizado correctamente',
      departamento: this.formatearDepartamento(departamento),
    };
  }

  async eliminar(id: bigint) {
    const existe = await this.prisma.departamento.findUnique({
      where: { id },
    });

    if (!existe) {
      throw new NotFoundException(`Departamento con id ${id} no encontrado`);
    }

    await this.prisma.departamento.update({
      where: { id },
      data: { estatus: false, libre: false },
    });

    return { message: 'Departamento desactivado correctamente' };
  }

  private formatearDepartamento(d: any) {
    return {
      ...d,
      id: d.id.toString(),
      precio: d.precio.toString(),
    };
  }

  private formatearDepartamentoConRelaciones(d: any) {
    return {
      ...this.formatearDepartamento(d),
      departamento_usuario: d.departamento_usuario?.map((du: any) => ({
        ...du,
        id_departamento: du.id_departamento.toString(),
        usuario: {
          ...du.usuario,
          ci: du.usuario.ci.toString(),
        },
      })),
    };
  }
}