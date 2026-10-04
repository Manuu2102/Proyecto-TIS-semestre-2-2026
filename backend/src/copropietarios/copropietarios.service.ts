import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CrearCopropietarioDto } from './dto/crear-copropietarios.dto.js';
import { ActualizarCopropietarioDto } from './dto/actualizar-copropietarios.dto.js';

@Injectable()
export class CopropietariosService {
  private readonly ID_ROL_COPROPIETARIO = 4;

  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
  ) {}

  async crear(data: CrearCopropietarioDto, adminId: string) {
    const existeCi = await this.prisma.usuario.findUnique({
      where: { ci: BigInt(data.ci) },
    });
    if (existeCi) {
      throw new ConflictException('El CI ya está registrado');
    }

    const existeEmail = await this.prisma.usuario.findUnique({
      where: { email: data.email },
    });
    if (existeEmail) {
      throw new ConflictException('El email ya está registrado');
    }

    const rol = await this.prisma.rol.findUnique({
      where: { id: this.ID_ROL_COPROPIETARIO },
    });
    if (!rol) {
      throw new NotFoundException(
        `El rol COPROPIETARIO (id=${this.ID_ROL_COPROPIETARIO}) no existe en la BD`,
      );
    }

    const { data: authData, error } = await this.supabase.client.auth.signUp({
      email: data.email,
      password: data.password ?? data.ci,
    });

    if (error || !authData.user) {
      throw new ConflictException(
        error?.message ??
          'No se pudo registrar el copropietario en Supabase Auth',
      );
    }

    const userId = authData.user.id;

    try {
      const copropietario = await this.prisma.conUsuario(adminId, (tx) =>
        tx.usuario.create({
          data: {
            id: userId,
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
        }),
      );

      return {
        message: 'Copropietario registrado correctamente',
        copropietario: {
          ...copropietario,
          ci: copropietario.ci.toString(),
          roles: copropietario.rol_usuario.map((ru) => ru.rol.nombre_rol),
        },
      };
    } catch (dbError) {
      await this.supabase.adminClient.auth.admin.deleteUser(authData.user.id);
      throw dbError;
    }
  }

  async actualizar(
    id: string,
    data: ActualizarCopropietarioDto,
    adminId: string,
  ) {
    // 1. Verificar que exista
    const existe = await this.prisma.usuario.findUnique({ where: { id } });
    if (!existe) {
      throw new NotFoundException(`Copropietario con id ${id} no encontrado`);
    }

    // 2. Verificar CI duplicado (si lo están cambiando)
    if (data.ci && BigInt(data.ci) !== existe.ci) {
      const ciDuplicado = await this.prisma.usuario.findUnique({
        where: { ci: BigInt(data.ci) },
      });
      if (ciDuplicado) {
        throw new ConflictException('El CI ya está registrado');
      }
    }

    // 3. Verificar email duplicado (si lo están cambiando)
    if (data.email && data.email !== existe.email) {
      const emailDuplicado = await this.prisma.usuario.findUnique({
        where: { email: data.email },
      });
      if (emailDuplicado) {
        throw new ConflictException('El email ya está registrado');
      }
    }

    // 4. Si cambia el email, actualizar también en Supabase Auth
    if (data.email && data.email !== existe.email) {
      const { error } =
        await this.supabase.adminClient.auth.admin.updateUserById(id, {
          email: data.email,
        });
      if (error) {
        throw new ConflictException(
          `No se pudo actualizar el email en Supabase Auth: ${error.message}`,
        );
      }
    }

    // 5. Actualizar en la BD con RLS
    const actualizado = await this.prisma.conUsuario(adminId, (tx) =>
      tx.usuario.update({
        where: { id },
        data: {
          ...(data.ci && { ci: BigInt(data.ci) }),
          ...(data.nombres && { nombres: data.nombres }),
          ...(data.apellido_paterno && {
            apellido_paterno: data.apellido_paterno,
          }),
          ...(data.apellido_materno !== undefined && {
            apellido_materno: data.apellido_materno,
          }),
          ...(data.sexo && { sexo: data.sexo }),
          ...(data.fecha_de_nacimiento && {
            fecha_de_nacimiento: new Date(data.fecha_de_nacimiento),
          }),
          ...(data.email && { email: data.email }),
          ...(data.telefono && { telefono: data.telefono }),
          ...(data.estatus !== undefined && { estatus: data.estatus }),
        },
      }),
    );

    return {
      message: 'Copropietario actualizado correctamente',
      copropietario: {
        ...actualizado,
        ci: actualizado.ci.toString(),
      },
    };
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
