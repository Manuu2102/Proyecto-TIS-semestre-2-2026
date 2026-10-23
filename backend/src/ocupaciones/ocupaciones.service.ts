import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearOcupacionDto } from './dto/crear-ocupacion.dto.js';
import { cerrarOcupacion, codigoDepartamento, ocuparDepartamento } from './asignacion.js';

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

    // Estadía nueva: si ya vivió ahí antes, esa fila queda en el historial
    const ocupacion = await this.prisma.conUsuario(adminId, (tx) =>
      ocuparDepartamento(
        tx,
        data.id_copropietario,
        BigInt(data.id_departamento),
        new Date(data.fecha_ocupacion),
        data.fecha_fin_ocupacion ? new Date(data.fecha_fin_ocupacion) : null,
      ),
    );

    return {
      message: 'Copropietario asociado al departamento correctamente',
      ocupacion: this.formatear(ocupacion),
    };
  }

  async historialPorDepartamento(id_departamento: bigint) {
    const historial = await this.prisma.departamento_usuario.findMany({
      where: { id_departamento },
      include: {
        // Solo lo que muestra el historial, con sus roles para saber si fue dueño o inquilino
        usuario: {
          select: {
            nombres: true,
            apellido_paterno: true,
            apellido_materno: true,
            rol_usuario: { select: { rol: { select: { nombre_rol: true } } } },
          },
        },
        departamento: {
          select: {
            id: true,
            numero: true,
            piso: true,
            codigo: true,
          },
        },
      },
      // Más reciente primero; ante la misma fecha, la estadía creada después
      orderBy: [{ fecha_ocupacion: 'desc' }, { id: 'desc' }],
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
        codigo: codigoDepartamento(historial[0].departamento),
      },
      total: historial.length,
      historial: historial.map(({ departamento: _departamento, ...h }) => ({
        ...this.formatear(h),
        // El rol es el que el usuario tiene hoy (la base no guarda el de cada estadía)
        rol: this.rolOcupante(h.usuario.rol_usuario.map((ru) => ru.rol.nombre_rol)),
        usuario: {
          nombres: h.usuario.nombres,
          apellido_paterno: h.usuario.apellido_paterno,
          apellido_materno: h.usuario.apellido_materno,
        },
      })),
    };
  }

  private rolOcupante(roles: string[]) {
    const nombres = roles.map((r) => r.trim().toUpperCase());
    if (nombres.includes('COPROPIETARIO')) return 'Copropietario';
    if (nombres.includes('INQUILINO')) return 'Inquilino';
    return 'Ocupante';
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

    await this.prisma.conUsuario(adminId, (tx) => cerrarOcupacion(tx, ocupacion));

    return { message: 'Ocupación cerrada correctamente' };
  }

  private formatear(o: any) {
    return {
      ...o,
      id: o.id.toString(),
      id_departamento: o.id_departamento.toString(),
      // La API sigue respondiendo id_copropietario (en la base es id_usuario)
      id_copropietario: o.id_usuario,
      id_usuario: undefined,
    };
  }
}