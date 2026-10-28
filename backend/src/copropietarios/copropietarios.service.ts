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
import { Prisma } from '../generated/prisma/client.js';
import { cifrarCi, cifrarEmail, cifrarTelefono, descifrar, descifrarUsuario } from '../lib/cifrado.js';
import {
  cerrarOcupaciones,
  codigoDepartamento,
  departamentoValido,
  ocupacionActiva,
  ocuparDepartamento,
  validarSinOtroConRol,
} from '../ocupaciones/asignacion.js';

@Injectable()
export class CopropietariosService {
  private readonly ID_ROL_COPROPIETARIO = 4;

  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
  ) {}

  /**
   * El departamento debe existir y no tener otro copropietario activo. Puede tener
   * un inquilino viviendo ahí.
   */
  private async validarDepartamento(idDepartamento: bigint, excluirUsuario?: string) {
    await departamentoValido(this.prisma, idDepartamento);
    await validarSinOtroConRol(
      this.prisma,
      idDepartamento,
      this.ID_ROL_COPROPIETARIO,
      'El departamento seleccionado ya tiene un copropietario.',
      excluirUsuario,
    );
  }

  async crear(data: CrearCopropietarioDto, adminId: string) {
    // ci, email y telefono se guardan cifrados (lib/cifrado.ts)
    const existeCi = await this.prisma.usuario.findUnique({
      where: { ci: cifrarCi(data.ci) },
    });
    if (existeCi) {
      throw new ConflictException('El CI ya está registrado');
    }

    const existeEmail = await this.prisma.usuario.findUnique({
      where: { email: cifrarEmail(data.email) },
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
      await this.validarDepartamento(idDepartamento);
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
            ci: cifrarCi(data.ci),
            nombres: data.nombres,
            apellido_paterno: data.apellido_paterno,
            apellido_materno: data.apellido_materno,
            sexo: data.sexo,
            fecha_de_nacimiento: new Date(data.fecha_de_nacimiento),
            email: cifrarEmail(data.email),
            estatus: true, // FIX: Forzado a true, ignorando lo que venga del front
            fecha_de_registro: new Date(),
            telefono: cifrarTelefono(data.telefono),
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
          ...descifrarUsuario(copropietario),
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

    // Se compara con los datos descifrados; las búsquedas van con el valor cifrado
    const cambiaCi = !!data.ci && String(data.ci).trim() !== descifrar(existe.ci);
    const cambiaEmail =
      !!data.email && data.email.trim().toLowerCase() !== descifrar(existe.email).toLowerCase();

    if (cambiaCi) {
      const ciDuplicado = await this.prisma.usuario.findUnique({
        where: { ci: cifrarCi(data.ci!) },
      });
      if (ciDuplicado) {
        throw new ConflictException('El CI ya está registrado');
      }
    }

    if (cambiaEmail) {
      const emailDuplicado = await this.prisma.usuario.findUnique({
        where: { email: cifrarEmail(data.email!) },
      });
      if (emailDuplicado) {
        throw new ConflictException('El email ya está registrado');
      }
    }

    // Supabase Auth guarda el email sin cifrar: lo necesita para el login
    if (cambiaEmail) {
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

    // Cambio de departamento (si es el mismo, no se toca la ocupación)
    const actual = await ocupacionActiva(this.prisma, id);
    const nuevoDepto =
      data.id_departamento !== undefined &&
      BigInt(data.id_departamento) !== actual?.id_departamento
        ? BigInt(data.id_departamento)
        : null;
    if (nuevoDepto) {
      await this.validarDepartamento(nuevoDepto, id);
    }

    const actualizado = await this.prisma.conUsuario(adminId, async (tx) => {
      // Al darlo de baja (o moverlo) se cierra su ocupación y se conserva el historial
      if (data.estatus === false || nuevoDepto) {
        await cerrarOcupaciones(tx, id);
      }
      if (nuevoDepto && data.estatus !== false) {
        await ocuparDepartamento(tx, id, nuevoDepto, new Date());
      }

      return tx.usuario.update({
        where: { id },
        data: {
          ...(data.ci && { ci: cifrarCi(data.ci) }),
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
          ...(data.email && { email: cifrarEmail(data.email) }),
          ...(data.telefono && { telefono: cifrarTelefono(data.telefono) }),
          ...(data.estatus !== undefined && { estatus: data.estatus }),
        },
      });
    });

    return {
      message: 'Copropietario actualizado correctamente',
      copropietario: descifrarUsuario(actualizado),
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
              select: { id: true, numero: true, piso: true, codigo: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      total: copropietarios.length,
      copropietarios: copropietarios.map((c) => {
        const ocupacion = c.departamento_usuario[0];
        return {
          ...descifrarUsuario(c),
          roles: c.rol_usuario.map((ru) => ru.rol.nombre_rol),
          // "A-101", y su id para poder editarlo desde el front
          departamento: ocupacion ? codigoDepartamento(ocupacion.departamento) : null,
          id_departamento: ocupacion?.departamento.id.toString() ?? null,
          fecha_ocupacion: ocupacion?.fecha_ocupacion ?? null,
          // Todos los departamentos que ocupa (desde Asociaciones puede tener más de uno)
          departamentos: c.departamento_usuario.map((du) => ({
            id: du.departamento.id.toString(),
            codigo: codigoDepartamento(du.departamento),
          })),
          rol_usuario: undefined,
          departamento_usuario: undefined,
        };
      }),
    };
  }

  /**
   * Borra el copropietario de forma permanente. Solo si ya estaba dado de baja y no
   * tiene movimientos (pagos, documentos, etc.) que lo referencien.
   */
  async eliminar(id: string, adminId: string) {
    const existe = await this.prisma.usuario.findUnique({ where: { id } });
    if (!existe) {
      throw new NotFoundException(`Copropietario con id ${id} no encontrado`);
    }
    if (existe.estatus) {
      throw new BadRequestException('Primero marca al copropietario como inactivo.');
    }

    try {
      await this.prisma.conUsuario(adminId, async (tx) => {
        await tx.departamento_usuario.deleteMany({ where: { id_usuario: id } });
        await tx.rol_usuario.deleteMany({ where: { id_usuario: id } });
        await tx.usuario.delete({ where: { id } });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'No se puede eliminar: el copropietario tiene pagos u otros registros asociados.',
        );
      }
      throw e;
    }

    // Por último la cuenta de acceso en Supabase Auth
    await this.supabase.adminClient.auth.admin.deleteUser(id);

    return { message: 'Copropietario eliminado correctamente' };
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
      ...descifrarUsuario(copropietario),
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