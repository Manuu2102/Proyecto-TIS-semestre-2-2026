import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearPersonalDto } from './dto/crear-personal.dto.js';
import { RegistrarPagoDto } from './dto/registrar-pago.dto.js';

@Injectable()
export class PersonalService {
  constructor(private prisma: PrismaService) {}

  async listar() {
    return this.prisma.personal.findMany({
      include: {
        historial_personal: {
          orderBy: { fecha_inicio: 'desc' },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  async crear(data: CrearPersonalDto) {
    const existe = await this.prisma.personal.findUnique({ 
      where: { ci: BigInt(data.ci) } 
    });
    if (existe) throw new BadRequestException('El CI ya está registrado');

    return this.prisma.personal.create({
      data: {
        nombre: data.nombre,
        apellido_paterno: data.apellido_paterno,
        apellido_materno: data.apellido_materno ?? null,
        cargo: data.cargo, 
        ci: BigInt(data.ci),
        telefono: data.telefono,
        email: data.email,
        salario: data.sueldo, // Traducción de sueldo a salario
        fecha_inicio: new Date(data.fecha_inicio),
        fecha_nacimiento: new Date(data.fecha_nacimiento),
        sexo: data.sexo,
        estatus: true,
      },
    });
  }

  // 🚨 NUEVA FUNCIÓN: Actualizar empleado
  async actualizar(id: bigint, data: any) {
    const empleado = await this.prisma.personal.findUnique({ where: { id } });
    if (!empleado) throw new NotFoundException('Empleado no encontrado');

    return this.prisma.personal.update({
      where: { id },
      data: {
        nombre: data.nombre,
        apellido_paterno: data.apellido_paterno,
        apellido_materno: data.apellido_materno ?? null,
        cargo: data.cargo,
        telefono: data.telefono,
        email: data.email,
        salario: data.sueldo, // Traducción de sueldo a salario
      },
    });
  }

  async registrarPago(data: RegistrarPagoDto) {
    const empleado = await this.prisma.personal.findUnique({ 
      where: { id: BigInt(data.id_personal) } 
    });
    if (!empleado) throw new NotFoundException('Empleado no encontrado');

    if (data.tipo_pago === 'Anticipo') {
      const limite = empleado.salario.toNumber() * 0.5;
      if (data.monto > limite) {
        throw new BadRequestException(`El anticipo no puede superar el 50% del salario (${limite})`);
      }
    }

    let tipo = await this.prisma.tipo_pago.findFirst({ 
      where: { nombre: data.tipo_pago } 
    });
    
    if (!tipo) {
      tipo = await this.prisma.tipo_pago.create({ 
        data: { nombre: data.tipo_pago } 
      });
    }

    return this.prisma.pago_personal.create({
      data: {
        id_personal: empleado.id,
        monto: data.monto,
        id_tipo_pago: tipo.id,
      },
    });
  }

  async registrarHistorial(idPersonal: bigint, data: { fecha_inicio: string, fecha_fin?: string }) {
    const empleado = await this.prisma.personal.findUnique({
      where: { id: idPersonal },
    });
    if (!empleado) throw new NotFoundException('Empleado no encontrado');

    return this.prisma.historial_personal.create({
      data: {
        id_personal: idPersonal,
        fecha_inicio: new Date(data.fecha_inicio),
        fecha_fin: data.fecha_fin ? new Date(data.fecha_fin) : null,
      },
    });
  }
}