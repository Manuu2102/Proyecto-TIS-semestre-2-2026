import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
    private config: ConfigService,
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

  /**
   * Cambia la contraseña del usuario. Primero comprueba la actual iniciando sesión con un
   * cliente aparte (sin guardar la sesión), y luego guarda la nueva con el cliente admin.
   */
  async cambiarContrasena(idUsuario: string, actual: string, nueva: string) {
    if (actual === nueva) {
      throw new BadRequestException('La nueva contraseña debe ser distinta de la actual');
    }

    const { data: encontrado, error: errorUsuario } =
      await this.supabase.adminClient.auth.admin.getUserById(idUsuario);
    const email = encontrado?.user?.email;
    if (errorUsuario || !email) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Cliente temporal: no toca la sesión del cliente compartido del servidor
    const verificador = createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_ANON_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: errorActual } = await verificador.auth.signInWithPassword({ email, password: actual });
    if (errorActual) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    await verificador.auth.signOut().catch(() => undefined);

    const { error } = await this.supabase.adminClient.auth.admin.updateUserById(idUsuario, {
      password: nueva,
    });
    if (error) {
      throw new InternalServerErrorException(`No se pudo cambiar la contraseña: ${error.message}`);
    }

    return { message: 'Contraseña actualizada correctamente' };
  }
}