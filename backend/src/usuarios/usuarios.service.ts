import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

  async crearUsuario(data: {
    user_name: string;
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

    // Verificar usuario
    const existeUsuario = await this.prisma.app_user.findUnique({
      where: {
        user_name: data.user_name,
      },
    });

    if (existeUsuario) {
      throw new ConflictException('El nombre de usuario ya existe');
    }

    // Verificar CI
    const existeCi = await this.prisma.usuario.findUnique({
      where: {
        ci: data.ci,
      },
    });

    if (existeCi) {
      throw new ConflictException('El CI ya está registrado');
    }

    // Verificar email
    const existeEmail = await this.prisma.usuario.findUnique({
      where: {
        email: data.email,
      },
    });

    if (existeEmail) {
      throw new ConflictException('El email ya está registrado');
    }

    // Encriptar contraseña
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Crear ambos registros
    const resultado = await this.prisma.$transaction(async (tx) => {

      const appUser = await tx.app_user.create({
        data: {
          user_name: data.user_name,
          password: passwordHash,
        },
      });

      const usuario = await tx.usuario.create({
        data: {
          ci: data.ci,
          nombres: data.nombres,
          apellido_paterno: data.apellido_paterno,
          apellido_materno: data.apellido_materno,
          sexo: data.sexo,
          fecha_de_nacimiento: data.fecha_de_nacimiento,
          id_user: appUser.id,
          email: data.email,
          estatus: true,
          fecha_de_registro: new Date(),
          telefono: data.telefono,
        },
      });

      return usuario;
    });

        return {
            message: 'Usuario registrado correctamente',
            usuario: {
                ...resultado,
                id: resultado.id.toString(),
                ci: resultado.ci.toString(),
                id_user: resultado.id_user.toString(),
            },
        };
    }
}