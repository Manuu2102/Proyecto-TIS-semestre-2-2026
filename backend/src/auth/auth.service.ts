import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(user_name: string, password: string) {

    const user = await this.prisma.app_user.findUnique({
      where: {
        user_name,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Usuario o contraseña incorrectos',
      );
    }

    const passwordCorrect = await bcrypt.compare(
      password,
      user.password,
    );

    if (!passwordCorrect) {
      throw new UnauthorizedException(
        'Usuario o contraseña incorrectos',
      );
    }

    const payload = {
      sub: user.id.toString(),
      user_name: user.user_name,
    };

    const token = await this.jwtService.signAsync(payload);

    return {
      access_token: token,
    };
  }
}