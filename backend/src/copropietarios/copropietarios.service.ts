import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CrearCopropietarioDto } from './dto/crear-copropietarios.dto.js';

@Injectable()
export class CopropietariosService {
  private readonly ID_ROL_COPROPIETARIO = 4;

  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
  ) {}

  async crear(data: CrearCopropietarioDto) {
    // 1. Verificar que el CI no exista
    const existeCi = await this.prisma.usuario.findUnique({
      where: { ci: BigInt(data.ci) },
    });
    if (existeCi) {
      throw new ConflictException('El CI ya está registrado');
    }

    // 2. Verificar que el email no exista
    const existeEmail = await this.prisma.usuario.findUnique({
      where: { email: data.email },
    });
    if (existeEmail) {
      throw new ConflictException('El email ya está registrado');
    }

    // 3. Verificar que el rol COPROPIETARIO exista
    const rol = await this.prisma.rol.findUnique({
      where: { id: this.ID_ROL_COPROPIETARIO },
    });
    if (!rol) {
      throw new NotFoundException(
        `El rol COPROPIETARIO (id=${this.ID_ROL_COPROPIETARIO}) no existe en la BD`,
      );
    }

    // 4. Crear usuario en Supabase Auth
    const { data: authData, error } = await this.supabase.client.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (error || !authData.user) {
      throw new ConflictException(
        error?.message ?? 'No se pudo registrar el copropietario en Supabase Auth',
      );
    }

    // 5. Crear usuario en la BD + asignar rol (transacción manual)
    try {
      const copropietario = await this.prisma.usuario.create({
        data: {
          id: authData.user.id,
          ci: BigInt(data.ci),
          nombres: data.nombres,
          apellido_paterno: data.apellido_paterno,
          apellido_materno: data.apellido_materno,
          sexo: data.sexo,
          fecha_de_nacimiento: new Date(data.fecha_de_nacimiento),
          email: data.email,
          estatus: true,
          fecha_de_registro: new Date(),
          telefono: data.telefono,
          rol_usuario: {
            create: {
              id_rol: this.ID_ROL_COPROPIETARIO,
            },
          },
        },
        include: {
          rol_usuario: {
            include: {
              rol: { select: { nombre_rol: true } },
            },
          },
        },
      });

      return {
        message: 'Copropietario registrado correctamente',
        copropietario: {
          ...copropietario,
          ci: copropietario.ci.toString(),
          roles: copropietario.rol_usuario.map((ru) => ru.rol.nombre_rol),
        },
      };
    } catch (dbError) {
      // Si falla la creación en BD, eliminamos el usuario de Supabase Auth
      await this.supabase.adminClient.auth.admin.deleteUser(authData.user.id);
      throw dbError;
    }
  }

  async listar() {
    const copropietarios = await this.prisma.usuario.findMany({
      where: {
        rol_usuario: {
          some: { id_rol: this.ID_ROL_COPROPIETARIO },
        },
      },
      include: {
        rol_usuario: {
          include: {
            rol: { select: { nombre_rol: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      total: copropietarios.length,
      copropietarios: copropietarios.map((c) => ({
        ...c,
        ci: c.ci.toString(),
        roles: c.rol_usuario.map((ru) => ru.rol.nombre_rol),
        rol_usuario: undefined,
      })),
    };
  }

  async buscarPorId(id: string) {
    const copropietario = await this.prisma.usuario.findUnique({
      where: { id },
      include: {
        departamento_usuario: {
          include: {
            departamento: {
              select: { id: true, numero: true, piso: true },
            },
          },
        },
        rol_usuario: {
          include: {
            rol: { select: { nombre_rol: true } },
          },
        },
      },
    });

    if (!copropietario) {
      throw new NotFoundException(`Copropietario con id ${id} no encontrado`);
    }

    return {
      ...copropietario,
      ci: copropietario.ci.toString(),
      roles: copropietario.rol_usuario.map((ru) => ru.rol.nombre_rol),
      departamento_usuario: copropietario.departamento_usuario.map((du) => ({
        ...du,
        id_departamento: du.id_departamento.toString(),
      })),
      rol_usuario: undefined,
    };
  }
}