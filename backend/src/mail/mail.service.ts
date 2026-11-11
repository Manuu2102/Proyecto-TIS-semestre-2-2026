import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export type Correo = { asunto: string; html: string; texto: string };

/**
 * Envío de correos por SMTP (Gmail con contraseña de aplicación u otro proveedor).
 * Se configura con MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS y MAIL_FROM en el .env.
 * Si faltan, el backend funciona igual: no envía correos y lo avisa en el log.
 * Nunca lanza errores: un correo que falla no debe deshacer la operación que lo originó.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly remitente: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('MAIL_HOST');
    const port = Number(config.get<string>('MAIL_PORT') ?? 465);
    const user = config.get<string>('MAIL_USER');
    const pass = config.get<string>('MAIL_PASS');
    this.remitente = config.get<string>('MAIL_FROM') ?? user ?? '';

    if (!host || !user || !pass) {
      this.logger.warn('Correo sin configurar (MAIL_HOST, MAIL_USER, MAIL_PASS): no se enviarán correos');
      this.transporter = null;
      return;
    }
    this.transporter = createTransport({
      host,
      port,
      secure: port === 465, // 465 = SSL; 587 = STARTTLS
      auth: { user, pass },
    });
  }

  /** Envía un correo. Devuelve si se envió; los errores solo se registran en el log. */
  async enviar(para: string, correo: Correo): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.sendMail({
        from: this.remitente,
        to: para,
        subject: correo.asunto,
        html: correo.html,
        text: correo.texto,
      });
      return true;
    } catch (e) {
      this.logger.error(`No se pudo enviar "${correo.asunto}" a ${para}: ${e instanceof Error ? e.message : e}`);
      return false;
    }
  }
}
