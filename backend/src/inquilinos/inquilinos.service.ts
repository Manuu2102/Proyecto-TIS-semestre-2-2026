import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { CrearInquilinoDto } from './dto/crear-inquilino.dto.js';
import { ActualizarInquilinoDto } from './dto/actualizar-inquilino.dto.js';
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
export class InquilinosService {
  private readonly ID_ROL_INQUILINO = 5;

  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
  ) {}

  /**
   * El departamento debe existir y no tener otro inquilino activo. Puede estar
   * "ocupado" por su copropietario: el inquilino es quien vive ahí.
   */
  private async validarDepartamento(idDepartamento: bigint, excluirUsuario?: string) {
    await departamentoValido(this.prisma, idDepartamento);
    await validarSinOtroConRol(
      this.prisma,
      idDepartamento,
      this.ID_ROL_INQUILINO,
      'El departamento seleccionado ya tiene un inquilino activo.',
      excluirUsuario,
    );
  }

  private async buscarInquilino(id: string) {
    const inquilino = await this.prisma.usuario.findFirst({
      where: { id, rol_usuario: { some: { id_rol: this.ID_ROL_INQUILINO } } },
    });
    if (!inquilino) {
      throw new NotFoundException(`Inquilino con id ${id} no encontrado`);
    }
    return inquilino;
  }

  async crear(data: CrearInquilinoDto, adminId: string) {
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
      where: { id: this.ID_ROL_INQUILINO },
    });
    if (!rol) {
      throw new NotFoundException(
        `El rol INQUILINO (id=${this.ID_ROL_INQUILINO}) no existe en la BD`,
      );
    }

    // Validar el departamento antes de crear la cuenta en Auth
    const idDepartamento = BigInt(data.id_departamento);
    await this.validarDepartamento(idDepartamento);

    const { data: authData, error } = await this.supabase.client.auth.signUp({
      email: data.email,
      password: data.password ?? data.ci,
    });

    if (error || !authData.user) {
      throw new ConflictException(
        error?.message ?? 'No se pudo registrar el inquilino en Supabase Auth',
      );
    }

    const userId = authData.user.id;

    try {
      const inquilino = await this.prisma.conUsuario(adminId, async (tx) => {
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
            estatus: true,
            fecha_de_registro: new Date(),
            telefono: cifrarTelefono(data.telefono),
            rol_usuario: {
              create: { id_rol: this.ID_ROL_INQUILINO },
            },
          },
        });

        await ocuparDepartamento(
          tx,
          nuevoUsuario.id,
          idDepartamento,
          data.fecha_inicio ? new Date(data.fecha_inicio) : new Date(),
        );

        return nuevoUsuario;
      });

      return {
        message: 'Inquilino registrado correctamente',
        inquilino: descifrarUsuario(inquilino),
      };
    } catch (dbError) {
      // Si falla la BD, eliminamos el usuario de Supabase Auth para no dejar basura
      await this.supabase.adminClient.auth.admin.deleteUser(userId);
      throw dbError;
    }
  }

  async actualizar(id: string, data: ActualizarInquilinoDto, adminId: string) {
    const existe = await this.buscarInquilino(id);

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

    const actual = await ocupacionActiva(this.prisma, id);
    const nuevoDepto =
      data.id_departamento !== undefined &&
      BigInt(data.id_departamento) !== actual?.id_departamento
        ? BigInt(data.id_departamento)
        : null;
    if (nuevoDepto) {
      await this.validarDepartamento(nuevoDepto, id);
    }

    // Supabase Auth guarda el email sin cifrar: lo necesita para el login
    if (cambiaEmail) {
      const { error } = await this.supabase.adminClient.auth.admin.updateUserById(id, {
        email: data.email,
      });
      if (error) {
        throw new ConflictException(
          `No se pudo actualizar el email en Supabase Auth: ${error.message}`,
        );
      }
    }

    const fechaInicio = data.fecha_inicio ? new Date(data.fecha_inicio) : null;

    const actualizado = await this.prisma.conUsuario(adminId, async (tx) => {
      if (data.estatus === false || nuevoDepto) {
        await cerrarOcupaciones(tx, id);
      }
      if (nuevoDepto && data.estatus !== false) {
        await ocuparDepartamento(tx, id, nuevoDepto, fechaInicio ?? new Date());
      } else if (fechaInicio && actual && data.estatus !== false) {
        // Mismo departamento: solo se corrige la fecha de inicio
        await tx.departamento_usuario.update({
          where: { id: actual.id },
          data: { fecha_ocupacion: fechaInicio },
        });
      }

      return tx.usuario.update({
        where: { id },
        data: {
          ...(data.ci && { ci: cifrarCi(data.ci) }),
          ...(data.nombres && { nombres: data.nombres }),
          ...(data.apellido_paterno && { apellido_paterno: data.apellido_paterno }),
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
      message: 'Inquilino actualizado correctamente',
      inquilino: descifrarUsuario(actualizado),
    };
  }

  async listar() {
    const inquilinos = await this.prisma.usuario.findMany({
      where: {
        rol_usuario: { some: { id_rol: this.ID_ROL_INQUILINO } },
      },
      include: {
        // La ocupación más reciente: la actual, o la última si está dado de baja
        departamento_usuario: {
          orderBy: [{ estatus: 'desc' }, { fecha_ocupacion: 'desc' }],
          take: 1,
          include: {
            departamento: { select: { id: true, numero: true, piso: true, codigo: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      total: inquilinos.length,
      inquilinos: inquilinos.map((i) => {
        const ocupacion = i.departamento_usuario[0];
        return {
          ...descifrarUsuario(i),
          departamento: ocupacion ? codigoDepartamento(ocupacion.departamento) : null,
          id_departamento: ocupacion?.departamento.id.toString() ?? null,
          fecha_ocupacion: ocupacion?.fecha_ocupacion ?? null,
          fecha_fin_ocupacion: ocupacion?.fecha_fin_ocupacion ?? null,
          // false si se le quitó el departamento (p. ej. desde Asociaciones)
          ocupacion_activa: ocupacion?.estatus ?? false,
          departamento_usuario: undefined,
        };
      }),
    };
  }

  async buscarPorId(id: string) {
    await this.buscarInquilino(id);

    const inquilino = await this.prisma.usuario.findUniqueOrThrow({
      where: { id },
      include: {
        departamento_usuario: {
          orderBy: { fecha_ocupacion: 'desc' },
          include: {
            departamento: { select: { id: true, numero: true, piso: true, codigo: true } },
          },
        },
      },
    });

    return {
      ...descifrarUsuario(inquilino),
      // Historial de ocupaciones
      departamento_usuario: inquilino.departamento_usuario.map((du) => ({
        id_departamento: du.id_departamento.toString(),
        departamento: codigoDepartamento(du.departamento),
        piso: du.departamento.piso,
        fecha_ocupacion: du.fecha_ocupacion,
        fecha_fin_ocupacion: du.fecha_fin_ocupacion,
        estatus: du.estatus,
      })),
    };
  }

  /**
   * Borra el inquilino de forma permanente. Solo si ya estaba dado de baja y no
   * tiene movimientos (pagos, documentos, etc.) que lo referencien.
   */
  async eliminar(id: string, adminId: string) {
    const existe = await this.buscarInquilino(id);
    if (existe.estatus) {
      throw new BadRequestException('Primero marca al inquilino como inactivo.');
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
          'No se puede eliminar: el inquilino tiene pagos u otros registros asociados.',
        );
      }
      throw e;
    }

    // Por último la cuenta de acceso en Supabase Auth
    await this.supabase.adminClient.auth.admin.deleteUser(id);

    return { message: 'Inquilino eliminado correctamente' };
  }
}
