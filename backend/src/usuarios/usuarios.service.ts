import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class UsuariosService {
  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
  ) {}

  async crearUsuario(data: {
    password: string;
    ci: bigint;
    nombres: string;
    apellido_paterno: string;
    apellido_materno?: string;
    sexo: string;
    fecha_de_nacimiento: Date;
    email: string;
    telefono: string;
  }) {
    const existeCi = await this.prisma.usuario.findUnique({
      where: { ci: data.ci },
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

    // 1. Crear el usuario en Supabase Auth
    const { data: authData, error } = await this.supabase.client.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (error || !authData.user) {
      throw new ConflictException(error?.message ?? 'No se pudo registrar el usuario');
    }

    // 2. Crear el registro en tu tabla `usuario`, usando el mismo UUID
    try {
      const usuario = await this.prisma.usuario.create({
        data: {
          id: authData.user.id,
          ci: data.ci,
          nombres: data.nombres,
          apellido_paterno: data.apellido_paterno,
          apellido_materno: data.apellido_materno,
          sexo: data.sexo,
          fecha_de_nacimiento: data.fecha_de_nacimiento,
          email: data.email,
          estatus: true,
          fecha_de_registro: new Date(),
          telefono: data.telefono,
        },
      });

      return {
        message: 'Usuario registrado correctamente',
        usuario: {
          ...usuario,
          ci: usuario.ci.toString(),
        },
      };
    } catch (dbError) {
      await this.supabase.client.auth.admin.deleteUser(authData.user.id);
      throw dbError;
    }
  }

  async assignRole(adminId: string, idUsuario: string, idRol: number) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: idUsuario } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const rol = await this.prisma.rol.findUnique({ where: { id: idRol } });
    if (!rol) throw new NotFoundException('Rol no encontrado');

    const yaAsignado = await this.prisma.rol_usuario.findUnique({
      where: { id_rol_id_usuario: { id_rol: idRol, id_usuario: idUsuario } },
    });
    if (yaAsignado) throw new ConflictException('El usuario ya tiene ese rol asignado');

    const resultado = await this.prisma.conUsuario(adminId, (tx) =>
      tx.rol_usuario.create({
        data: { id_rol: idRol, id_usuario: idUsuario },
      }),
    );

    return {
      message: 'Rol asignado correctamente',
      asignacion: {
        id_rol: resultado.id_rol.toString(),
        id_usuario: resultado.id_usuario,
      },
    };
  }
}