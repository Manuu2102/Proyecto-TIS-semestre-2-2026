import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    const supabaseUrl = config.get<string>('SUPABASE_URL');

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL no está definido en las variables de entorno');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
      }),
      algorithms: ['ES256', 'RS256'],
    });
  }

  async validate(payload: any) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        nombres: true,
        estatus: true,
        rol_usuario: {
          select: {
            rol: { select: { nombre_rol: true } },
          },
        },
      },
    });

    if (!usuario || !usuario.estatus) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return {
      id: usuario.id,
      nombres: usuario.nombres,
      roles: usuario.rol_usuario.map((ru) => ru.rol.nombre_rol),
    };
  }
}