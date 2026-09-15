import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcrypt';

const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8gcT8G5J8t2p8g5W8x2b3F9C8k8k8O';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(identificador: string, password: string) {
    const user = await this.prisma.app_user.findFirst({
      where: {
        OR: [
          { user_name: identificador },
          { usuario: { email: identificador } },
        ],
      },
      include: {
        usuario: {
          select: {
            nombres: true,
            estatus: true,
            rol_usuario: {
              select: {
                rol: { select: { nombre_rol: true } },
              },
            },
          },
        },
      },
    });
    const hashToCompare = user?.password ?? DUMMY_HASH;
    const passwordCorrect = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordCorrect) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    if (user.usuario && !user.usuario.estatus) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    const roles = user.usuario?.rol_usuario.map(
      (rolUsuario) => rolUsuario.rol.nombre_rol,
    ) ?? [];

    const payload = {
      sub: user.id.toString(),
      user_name: user.user_name,
      roles: roles,
    };

    const token = await this.jwtService.signAsync(payload);

    return {
      access_token: token,
      usuario: {
        nombre: user.usuario?.nombres,
        roles: roles,
      },
    };
  }
}