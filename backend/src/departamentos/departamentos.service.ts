import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { descifrarUsuario } from '../lib/cifrado.js';
import { CrearDepartamentoDto } from './dto/crear-departamento.dto.js';
import { ActualizarDepartamentoDto } from './dto/actualizar-departamento.dto.js';

@Injectable()
export class DepartamentosService {
  constructor(private prisma: PrismaService) {}

  // Los tipos son A, B y C (antes Pequeño, Mediano y Grande)
  private obtenerMontoCategoria(nombreTipo: string) {
    const MONTOS: Record<string, number> = {
      A: 100,
      B: 150,
      C: 200,
    };
    const monto = MONTOS[nombreTipo.trim().toUpperCase()];
    if (monto === undefined) {
      throw new BadRequestException('La categoría no tiene un monto configurado.');
    }
    return monto;
  }

  /** Tipo de departamento y su letra, que se guarda en `codigo` (A, B o C). */
  private async obtenerTipo(idTipo: number) {
    const tipo = await this.prisma.tipo_departamento.findUnique({
      where: { id: BigInt(idTipo) },
    });
    if (!tipo || !tipo.nombre) {
      throw new BadRequestException('La categoría seleccionada no existe.');
    }
    return { ...tipo, codigo: tipo.nombre.trim().toUpperCase() };
  }

  /** Tipos de departamento (A, B, C) para el formulario. */
  async listarTipos() {
    const tipos = await this.prisma.tipo_departamento.findMany({
      orderBy: { nombre: 'asc' },
    });
    return tipos.map((t) => ({ id: t.id.toString(), nombre: t.nombre?.trim() ?? '' }));
  }

  /** Un departamento se identifica por su código y número: A-101. */
  private async validarDuplicado(codigo: string, numero: number, excluirId?: bigint) {
    const duplicado = await this.prisma.departamento.findFirst({
      where: {
        codigo,
        numero,
        estatus: true,
        ...(excluirId !== undefined && { id: { not: excluirId } }),
      },
    });
    if (duplicado) {
      throw new ConflictException(`Ya existe el departamento ${codigo}-${numero}`);
    }
  }

  async crear(data: CrearDepartamentoDto, adminId: string) {
    const tipo = await this.obtenerTipo(data.id_tipo_departamento);
    await this.validarDuplicado(tipo.codigo, data.numero);

    const precioCalculado = 300 + this.obtenerMontoCategoria(tipo.codigo);

    const departamento = await this.prisma.conUsuario(adminId, (tx) =>
      tx.departamento.create({
        data: {
          codigo: tipo.codigo, // "A"
          numero: data.numero, // 101
          piso: data.piso,
          // Columnas que se eliminarán: se guardan con un valor fijo mientras existan
          habitaciones: 0,
          banos: 0,
          amueblado: false,
          superficie_m2: data.superficie_m2,
          precio: precioCalculado,
          estatus: true,
          descripcion: data.descripcion,
          libre: true,
          tipo_departamento: tipo.id,
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
        // Ocupante actual
        departamento_usuario: {
          where: { estatus: true, fecha_fin_ocupacion: null },
          orderBy: { fecha_ocupacion: 'desc' },
          take: 1,
          include: {
            usuario: { select: { nombres: true, apellido_paterno: true, apellido_materno: true } },
          },
        },
      },
      orderBy: [{ piso: 'asc' }, { codigo: 'asc' }, { numero: 'asc' }],
    });

    // Expensa mensual de cada tipo (la define finanzas en la tabla expensa)
    const expensas = await this.prisma.expensa.findMany({
      where: { tipo_departamento: { not: null } },
      select: { tipo_departamento: true, monto_total: true },
    });
    const expensaPorTipo = new Map<string, number>();
    for (const e of expensas) {
      const tipo = e.tipo_departamento!.toString();
      expensaPorTipo.set(tipo, (expensaPorTipo.get(tipo) ?? 0) + e.monto_total.toNumber());
    }

    return {
      total: departamentos.length,
      departamentos: departamentos.map((d) => {
        const u = d.departamento_usuario[0]?.usuario;
        return {
          ...this.formatearDepartamento(d),
          departamento_usuario: undefined,
          tipo:
            d.tipo_departamento_departamento_tipo_departamentoTotipo_departamento?.nombre?.trim() ??
            null,
          ocupante: u
            ? [u.nombres, u.apellido_paterno, u.apellido_materno].filter(Boolean).join(' ')
            : null,
          expensa: d.tipo_departamento !== null
            ? (expensaPorTipo.get(d.tipo_departamento.toString()) ?? 0)
            : 0,
        };
      }),
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

    // Si cambia el tipo, cambia también el código (A, B o C) y el precio
    const tipo = data.id_tipo_departamento
      ? await this.obtenerTipo(data.id_tipo_departamento)
      : null;
    const codigo = tipo?.codigo ?? existe.codigo;
    const numero = data.numero ?? existe.numero;

    if (codigo !== existe.codigo || numero !== existe.numero) {
      await this.validarDuplicado(codigo, numero, id);
    }

    // FIX para TypeScript: Tipamos como 'any' para evitar conflicto entre FK y relación
    const dataAActualizar: any = {
      ...(data.numero !== undefined && { numero: data.numero }),
      ...(data.piso !== undefined && { piso: data.piso }),
      ...(data.superficie_m2 !== undefined && { superficie_m2: data.superficie_m2 }),
      ...(data.descripcion !== undefined && { descripcion: data.descripcion }),

      ...(tipo && {
        codigo: tipo.codigo,
        tipo_departamento: tipo.id,
        precio: 300 + this.obtenerMontoCategoria(tipo.codigo),
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
        usuario: descifrarUsuario(du.usuario),
      })),
    };
  }

  /**
   * Departamentos que ocupa el usuario (copropietario o inquilino), con sus parqueos,
   * bauleras y los demás ocupantes, más un resumen de su actividad reciente (auditoría).
   */
  async misDepartamentos(idUsuario: string) {
    const ocupaciones = await this.prisma.departamento_usuario.findMany({
      where: { id_usuario: idUsuario, estatus: true },
      select: {
        fecha_ocupacion: true,
        departamento: {
          select: {
            id: true,
            numero: true,
            codigo: true,
            piso: true,
            superficie_m2: true,
            habitaciones: true,
            dormitorios: true,
            banos: true,
            salas: true,
            amueblado: true,
            descripcion: true,
            tipo_departamento_departamento_tipo_departamentoTotipo_departamento: { select: { nombre: true } },
            departamento_parqueo: { select: { parqueo: { select: { numero: true, piso: true, discapacitados: true } } } },
            departamento_baulera: { select: { baulera: { select: { numero: true, piso: true } } } },
            departamento_usuario: {
              where: { estatus: true, id_usuario: { not: idUsuario } },
              select: {
                fecha_ocupacion: true,
                usuario: {
                  select: {
                    nombres: true,
                    apellido_paterno: true,
                    rol_usuario: { select: { rol: { select: { nombre_rol: true } } } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    // Actividad del usuario en los últimos 30 días (lo registran los triggers de auditoría)
    const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [eventos30Dias, ultimos] = await Promise.all([
      this.prisma.auditoria.count({ where: { usuario_id: idUsuario, fecha_hora: { gte: hace30Dias } } }),
      this.prisma.auditoria.findMany({
        where: { usuario_id: idUsuario },
        select: { accion: true, tabla_afectada: true, fecha_hora: true },
        orderBy: { fecha_hora: 'desc' },
        take: 5,
      }),
    ]);

    return {
      departamentos: ocupaciones.map(({ fecha_ocupacion, departamento: d }) => ({
        id: d.id.toString(),
        numero: d.numero,
        codigo: d.codigo,
        piso: d.piso,
        tipo: d.tipo_departamento_departamento_tipo_departamentoTotipo_departamento?.nombre ?? null,
        superficie_m2: d.superficie_m2,
        habitaciones: d.habitaciones,
        dormitorios: d.dormitorios,
        banos: d.banos,
        salas: d.salas,
        amueblado: d.amueblado,
        descripcion: d.descripcion,
        desde: fecha_ocupacion.toISOString().slice(0, 10),
        parqueos: d.departamento_parqueo.map((x) => x.parqueo),
        bauleras: d.departamento_baulera.map((x) => x.baulera),
        ocupantes: d.departamento_usuario.map((o) => ({
          nombre: `${o.usuario.nombres} ${o.usuario.apellido_paterno}`.trim(),
          rol: o.usuario.rol_usuario[0]?.rol.nombre_rol ?? null,
          desde: o.fecha_ocupacion.toISOString().slice(0, 10),
        })),
      })),
      actividad: {
        eventos30Dias,
        ultimos: ultimos.map((a) => ({
          accion: a.accion,
          tabla: a.tabla_afectada,
          fecha: a.fecha_hora.toISOString(),
        })),
      },
    };
  }
}