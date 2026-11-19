import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { MailService } from '../mail/mail.service.js';
import { correoCodigoContrasena } from './correo-codigo.js';

const PROPOSITO = 'cambio_contrasena';
const VIGENCIA_MIN = 10;
const MAX_INTENTOS = 5;
const ESPERA_REENVIO_S = 60;

/** "sal:hash" con scrypt; la sal hace que dos códigos iguales no den el mismo hash. */
function hashCodigo(codigo: string): string {
  const sal = randomBytes(16).toString('hex');
  return `${sal}:${scryptSync(codigo, sal, 32).toString('hex')}`;
}

function coincideCodigo(codigo: string, guardado: string): boolean {
  const [sal, hash] = guardado.split(':');
  if (!sal || !hash) return false;
  const esperado = Buffer.from(hash, 'hex');
  const calculado = scryptSync(codigo, sal, esperado.length);
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

/** "juan.perez@gmail.com" → "ju********@gmail.com" */
function enmascararCorreo(email: string): string {
  const [usuario, dominio] = email.split('@');
  const visible = usuario.slice(0, Math.min(2, usuario.length));
  return `${visible}${'*'.repeat(Math.max(3, usuario.length - visible.length))}@${dominio}`;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
    private config: ConfigService,
    private mail: MailService,
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
   * Paso 1 del cambio de contraseña: comprueba la contraseña actual y envía al correo del
   * usuario un código de 6 dígitos (vence en 10 minutos, un solo uso, máximo 5 intentos).
   * El código se guarda con hash (scrypt + sal), nunca en texto plano.
   */
  async solicitarCodigoContrasena(idUsuario: string, actual: string) {
    const email = await this.verificarContrasenaActual(idUsuario, actual);

    // No dejar pedir códigos seguidos (evita llenar el correo y abusar del envío)
    const ultimo = await this.prisma.codigo_verificacion.findFirst({
      where: { id_usuario: idUsuario, proposito: PROPOSITO },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });
    if (ultimo) {
      const espera = Math.ceil(ESPERA_REENVIO_S - (Date.now() - ultimo.created_at.getTime()) / 1000);
      if (espera > 0) {
        throw new BadRequestException(`Espera ${espera} segundos antes de pedir otro código`);
      }
    }

    const codigo = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const ahora = new Date();
    const nuevo = await this.prisma.$transaction(async (tx) => {
      // Solo vale el último código: los anteriores sin usar se vencen
      await tx.codigo_verificacion.updateMany({
        where: { id_usuario: idUsuario, proposito: PROPOSITO, usado_en: null, expira_en: { gt: ahora } },
        data: { expira_en: ahora },
      });
      return tx.codigo_verificacion.create({
        data: {
          id_usuario: idUsuario,
          proposito: PROPOSITO,
          codigo_hash: hashCodigo(codigo),
          expira_en: new Date(ahora.getTime() + VIGENCIA_MIN * 60_000),
        },
        select: { id: true },
      });
    });

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: idUsuario },
      select: { nombres: true },
    });
    const enviado = await this.mail.enviar(
      email,
      correoCodigoContrasena(usuario?.nombres ?? 'copropietario', codigo, VIGENCIA_MIN),
    );
    if (!enviado) {
      // Sin correo el código no sirve: se borra para que pueda pedir otro enseguida
      await this.prisma.codigo_verificacion.delete({ where: { id: nuevo.id } });
      throw new ServiceUnavailableException(
        'No se pudo enviar el correo con el código. Intenta nuevamente en unos minutos.',
      );
    }

    return {
      message: `Te enviamos un código de verificación a ${enmascararCorreo(email)}. Vence en ${VIGENCIA_MIN} minutos.`,
      correo: enmascararCorreo(email),
      vence_en_minutos: VIGENCIA_MIN,
      reenviar_en_segundos: ESPERA_REENVIO_S,
    };
  }

  /** Paso 2: valida el código del correo y guarda la nueva contraseña. */
  async cambiarContrasena(idUsuario: string, codigo: string, nueva: string) {
    const registro = await this.prisma.codigo_verificacion.findFirst({
      where: { id_usuario: idUsuario, proposito: PROPOSITO, usado_en: null },
      orderBy: { created_at: 'desc' },
    });
    if (!registro || registro.expira_en <= new Date()) {
      throw new BadRequestException('El código venció o no existe. Pide un código nuevo.');
    }
    if (registro.intentos >= MAX_INTENTOS) {
      throw new BadRequestException('Superaste el número de intentos. Pide un código nuevo.');
    }

    if (!coincideCodigo(codigo, registro.codigo_hash)) {
      const { intentos } = await this.prisma.codigo_verificacion.update({
        where: { id: registro.id },
        data: { intentos: { increment: 1 } },
        select: { intentos: true },
      });
      const quedan = MAX_INTENTOS - intentos;
      throw new BadRequestException(
        quedan > 0
          ? `El código no es correcto. Te ${quedan === 1 ? 'queda 1 intento' : `quedan ${quedan} intentos`}.`
          : 'El código no es correcto. Superaste el número de intentos: pide un código nuevo.',
      );
    }

    // Se marca como usado antes de cambiar la contraseña: si llegan dos pedidos a la vez, solo uno pasa
    const { count } = await this.prisma.codigo_verificacion.updateMany({
      where: { id: registro.id, usado_en: null },
      data: { usado_en: new Date() },
    });
    if (count === 0) throw new BadRequestException('Este código ya se usó. Pide un código nuevo.');

    const { error } = await this.supabase.adminClient.auth.admin.updateUserById(idUsuario, {
      password: nueva,
    });
    if (error) {
      throw new InternalServerErrorException(`No se pudo cambiar la contraseña: ${error.message}`);
    }

    return { message: 'Contraseña actualizada correctamente' };
  }

  /**
   * Comprueba la contraseña actual iniciando sesión con un cliente aparte (sin guardar la
   * sesión, no toca el cliente compartido del servidor). Devuelve el correo del usuario.
   */
  private async verificarContrasenaActual(idUsuario: string, actual: string): Promise<string> {
    const { data: encontrado, error: errorUsuario } =
      await this.supabase.adminClient.auth.admin.getUserById(idUsuario);
    const email = encontrado?.user?.email;
    if (errorUsuario || !email) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

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
    return email;
  }
}