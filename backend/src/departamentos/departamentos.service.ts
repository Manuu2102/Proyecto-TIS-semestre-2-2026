import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearDepartamentoDto } from './dto/crear-departamento.dto.js';
import { ActualizarDepartamentoDto } from './dto/actualizar-departamento.dto.js';

@Injectable()
export class DepartamentosService {
  constructor(private prisma: PrismaService) {}

  private obtenerMontoCategoria(nombreTipo: string) {
    const MONTOS: Record<string, number> = { 
      'Pequeño': 100, 
      'Mediano': 150, 
      'Grande': 200 
    };
    const monto = MONTOS[nombreTipo];
    if (monto === undefined) {
      throw new BadRequestException('La categoría no tiene un monto configurado.');
    }
    return monto;
  }

  async crear(data: CrearDepartamentoDto, adminId: string) {
    // 1. Validar duplicado (codigo + numero + piso)
    const existe = await this.prisma.departamento.findFirst({
      where: { 
        codigo: data.codigo, 
        numero: data.numero, 
        piso: data.piso 
      },
    });

    if (existe) {
      throw new ConflictException(
        `Ya existe un departamento con código ${data.codigo}-${data.numero} en el piso ${data.piso}`,
      );
    }

    // 2. Validar categoría y calcular precio
    if (!data.id_tipo_departamento) {
      throw new BadRequestException('Debe seleccionar una categoría de departamento.');
    }

    const tipo = await this.prisma.tipo_departamento.findUnique({
      where: { id: BigInt(data.id_tipo_departamento) },
    });

    if (!tipo) {
      throw new BadRequestException('La categoría seleccionada no existe.');
    }

    const monto = this.obtenerMontoCategoria(tipo.nombre ?? '');
    const precioCalculado = 300 + monto;

    // 3. Crear el departamento
    const departamento = await this.prisma.conUsuario(adminId, (tx) =>
      tx.departamento.create({
        data: {
          codigo: data.codigo,   // "A"
          numero: data.numero,   // 101
          piso: data.piso,
          habitaciones: data.habitaciones,
          banos: data.banos,
          superficie_m2: data.superficie_m2,
          precio: precioCalculado,
          estatus: true,
          amueblado: data.amueblado,
          descripcion: data.descripcion,
          libre: true, 
          tipo_departamento: BigInt(data.id_tipo_departamento),
        },
        include: {
          tipo_departamento_departamento_tipo_departamentoTotipo_departamento: {
            select: { id: true, nombre: true },
          },
        },
      }),
    );

    return {
      message: 'Departamento creado correctamente',
      departamento: this.formatearDepartamento(departamento),
    };
  }

  async listar() {
    const departamentos = await this.prisma.departamento.findMany({
      where: { estatus: true },
      include: {
        tipo_departamento_departamento_tipo_departamentoTotipo_departamento: {
          select: { id: true, nombre: true },
        },
      },
      orderBy: [{ piso: 'asc' }, { codigo: 'asc' }, { numero: 'asc' }],
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
        departamento_usuario: { include: { usuario: true } },
        departamento_baulera: { include: { baulera: true } },
        departamento_parqueo: { include: { parqueo: true } },
        tipo_departamento_departamento_tipo_departamentoTotipo_departamento: {
          select: { id: true, nombre: true },
        },
      },
    });

    if (!departamento) {
      throw new NotFoundException(`Departamento con id ${id} no encontrado`);
    }

    return this.formatearDepartamentoConRelaciones(departamento);
  }

  async actualizar(id: bigint, data: ActualizarDepartamentoDto, adminId: string) {
    const existe = await this.prisma.departamento.findUnique({ where: { id } });

    if (!existe) {
      throw new NotFoundException(`Departamento con id ${id} no encontrado`);
    }

    // Validar duplicado si cambia codigo, numero o piso
    if (data.codigo !== undefined || data.numero !== undefined || data.piso !== undefined) {
      const codigo = data.codigo ?? existe.codigo;
      const numero = data.numero ?? existe.numero;
      const piso = data.piso ?? existe.piso;
      
      const duplicado = await this.prisma.departamento.findFirst({
        where: { codigo, numero, piso, id: { not: id } },
      });
      
      if (duplicado) {
        throw new ConflictException(
          `Ya existe un departamento con código ${codigo}-${numero} en el piso ${piso}`,
        );
      }
    }

    // Si cambia la categoría, recalcular precio
    let nuevoPrecio: number | undefined;
    if (data.id_tipo_departamento) {
      const tipo = await this.prisma.tipo_departamento.findUnique({
        where: { id: BigInt(data.id_tipo_departamento) },
      });
      if (!tipo) throw new BadRequestException('La categoría no existe.');

      nuevoPrecio = 300 + this.obtenerMontoCategoria(tipo.nombre ?? '');
    }

    // FIX para TypeScript: Tipamos como 'any' para evitar conflicto entre FK y relación
    const dataAActualizar: any = {
      ...(data.codigo !== undefined && { codigo: data.codigo }),
      ...(data.numero !== undefined && { numero: data.numero }),
      ...(data.piso !== undefined && { piso: data.piso }),
      ...(data.habitaciones !== undefined && { habitaciones: data.habitaciones }),
      ...(data.banos !== undefined && { banos: data.banos }),
      ...(data.superficie_m2 !== undefined && { superficie_m2: data.superficie_m2 }),
      ...(data.amueblado !== undefined && { amueblado: data.amueblado }),
      ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
      
      ...(data.id_tipo_departamento !== undefined && {
        tipo_departamento: BigInt(data.id_tipo_departamento),
        precio: nuevoPrecio,
      }),
    };

    const departamento = await this.prisma.conUsuario(adminId, (tx) =>
      tx.departamento.update({
        where: { id },
        data: dataAActualizar,
      }),
    );

    return {
      message: 'Departamento actualizado correctamente',
      departamento: this.formatearDepartamento(departamento),
    };
  }

  async eliminar(id: bigint, adminId: string) {
    const existe = await this.prisma.departamento.findUnique({ where: { id } });

    if (!existe) {
      throw new NotFoundException(`Departamento con id ${id} no encontrado`);
    }

    const ocupado = await this.prisma.departamento_usuario.findFirst({
      where: { id_departamento: id, estatus: true },
    });

    if (ocupado) {
      throw new BadRequestException('No se puede eliminar un departamento que tiene ocupantes activos.');
    }

    await this.prisma.conUsuario(adminId, (tx) =>
      tx.departamento.update({
        where: { id },
        data: { estatus: false },
      }),
    );

    return { message: 'Departamento eliminado correctamente' };
  }

  private formatearDepartamento(d: any) {
    return {
      ...d,
      id: d.id.toString(),
      precio: d.precio.toString(),
      tipo_departamento: d.tipo_departamento?.toString() ?? null,
      // Concatenamos para que el frontend muestre "A-101"
      numeroCompleto: `${d.codigo}-${d.numero}`,
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