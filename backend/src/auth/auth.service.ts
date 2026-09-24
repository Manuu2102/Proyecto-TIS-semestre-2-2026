import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
  ) {}

  async login(email: string, password: string) {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email,
      password,
    });

     if (error) {
      console.log('Error de Supabase:', error.message); 
    }
    
    if (error || !data.session) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: data.user.id },
      select: {
        nombres: true,
        estatus: true,
        rol_usuario: {
          select: {
            rol: { select: { nombre_rol: true } },
          },
        },
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado en el sistema');
    }

    if (!usuario.estatus) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    const roles = usuario.rol_usuario.map((ru) => ru.rol.nombre_rol);

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      usuario: {
        nombre: usuario.nombres,
        roles,
      },
    };
  }
}