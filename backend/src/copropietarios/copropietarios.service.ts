import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
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

    // NUEVO: Validar que el departamento exista y esté libre antes de crear el usuario en Auth
    let idDepartamento: bigint | null = null;
    if (data.id_departamento) {
      idDepartamento = BigInt(data.id_departamento);
      const depto = await this.prisma.departamento.findUnique({
        where: { id: idDepartamento },
      });
      if (!depto) {
        throw new BadRequestException('El departamento seleccionado no existe.');
      }
      if (!depto.libre) {
        throw new BadRequestException('El departamento seleccionado ya está ocupado.');
      }
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
      const copropietario = await this.prisma.conUsuario(adminId, async (tx) => {
        // 1. Crear el usuario
        const nuevoUsuario = await tx.usuario.create({
          data: {
            id: userId,
            ci: BigInt(data.ci),
            nombres: data.nombres,
            apellido_paterno: data.apellido_paterno,
            apellido_materno: data.apellido_materno,
            sexo: data.sexo,
            fecha_de_nacimiento: new Date(data.fecha_de_nacimiento),
            email: data.email,
            estatus: true, // FIX: Forzado a true, ignorando lo que venga del front
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

        // 2. NUEVO: Asociar al departamento si se envió
        if (idDepartamento) {
          await tx.departamento_usuario.create({
            data: {
              id_usuario: nuevoUsuario.id,
              id_departamento: idDepartamento,
              fecha_ocupacion: new Date(),
              estatus: true,
            },
          });
          // Marcar departamento como ocupado
          await tx.departamento.update({
            where: { id: idDepartamento },
            data: { libre: false },
          });
        }

        return nuevoUsuario;
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
      // Si falla la BD, eliminamos el usuario de Supabase Auth para no dejar basura
      await this.supabase.adminClient.auth.admin.deleteUser(authData.user.id);
      throw dbError;
    }
  }

  async actualizar(
    id: string,
    data: ActualizarCopropietarioDto,
    adminId: string,
  ) {
    const existe = await this.prisma.usuario.findUnique({ where: { id } });
    if (!existe) {
      throw new NotFoundException(`Copropietario con id ${id} no encontrado`);
    }

    if (data.ci && BigInt(data.ci) !== existe.ci) {
      const ciDuplicado = await this.prisma.usuario.findUnique({
        where: { ci: BigInt(data.ci) },
      });
      if (ciDuplicado) {
        throw new ConflictException('El CI ya está registrado');
      }
    }

    if (data.email && data.email !== existe.email) {
      const emailDuplicado = await this.prisma.usuario.findUnique({
        where: { email: data.email },
      });
      if (emailDuplicado) {
        throw new ConflictException('El email ya está registrado');
      }
    }

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

  // FIX: Ahora incluye el departamento en la lista
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
        departamento_usuario: {
          where: { estatus: true }, // Solo la ocupación actual
          include: {
            departamento: {
              select: { id: true, numero: true, piso: true },
            },
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
        // NUEVO: Formateamos el departamento para que el front lo muestre
        departamento: c.departamento_usuario[0]?.departamento
          ? `${c.departamento_usuario[0].departamento.numero} - Piso ${c.departamento_usuario[0].departamento.piso}`
          : null,
        rol_usuario: undefined,
        departamento_usuario: undefined,
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
        // La API sigue respondiendo id_copropietario (en la base es id_usuario)
        id_copropietario: du.id_usuario,
        id_usuario: undefined,
      })),
      rol_usuario: undefined,
    };
  }
}