import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ){}

  async login(identificador: string, password: string) {
    const user = await this.prisma.app_user.findFirst({
      where: {
        OR: [
          { user_name: identificador },
          { usuario: { email: identificador } },
        ],
      },
      include: {
        usuario: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const passwordCorrect = await bcrypt.compare(password, user.password);

    if (!passwordCorrect) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const payload = {
      sub: user.id.toString(),
      user_name: user.user_name,
    };

    const token = await this.jwtService.signAsync(payload);

    return {
      access_token: token,
      usuario: {
        nombre: user.usuario?.nombres,
        // rol: pendiente — ver nota abajo
      },
    };
  }
}