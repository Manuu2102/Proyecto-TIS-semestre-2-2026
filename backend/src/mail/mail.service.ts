import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export type Correo = { asunto: string; html: string; texto: string };

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_TIMEOUT_MS = 15000;

/**
 * Envío de correos. Usa el primero que esté configurado en el .env:
 *  1. Brevo por API HTTP (BREVO_API_KEY): el recomendado en la nube, porque muchos
 *     proveedores bloquean los puertos SMTP y esto va por HTTPS (443).
 *  2. SMTP (MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS): por ejemplo Gmail con contraseña
 *     de aplicación, útil para probar en local.
 * El remitente sale de MAIL_FROM ("Nombre <correo@dominio>"); con Brevo debe ser un
 * remitente verificado en la cuenta.
 * Si no hay nada configurado, el backend funciona igual: no envía correos y lo avisa en el log.
 * Nunca lanza errores: un correo que falla no debe deshacer la operación que lo originó.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly brevoApiKey: string | null;
  private readonly transporter: Transporter | null;
  private readonly remitente: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('MAIL_HOST');
    const port = Number(config.get<string>('MAIL_PORT') ?? 465);
    const user = config.get<string>('MAIL_USER');
    const pass = config.get<string>('MAIL_PASS');
    this.remitente = config.get<string>('MAIL_FROM') ?? user ?? '';
    this.brevoApiKey = config.get<string>('BREVO_API_KEY') || null;
    this.transporter = null;

    if (this.brevoApiKey) {
      if (!this.remitente) {
        this.logger.warn('BREVO_API_KEY configurada pero falta MAIL_FROM: no se enviarán correos');
        this.brevoApiKey = null;
      }
      return;
    }

    if (!host || !user || !pass) {
      this.logger.warn(
        'Correo sin configurar (BREVO_API_KEY o MAIL_HOST, MAIL_USER, MAIL_PASS): no se enviarán correos',
      );
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
    try {
      if (this.brevoApiKey) {
        await this.enviarPorBrevo(this.brevoApiKey, para, correo);
        return true;
      }
      if (!this.transporter) return false;
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

  private async enviarPorBrevo(apiKey: string, para: string, correo: Correo) {
    const respuesta = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: separarRemitente(this.remitente),
        to: [{ email: para }],
        subject: correo.asunto,
        htmlContent: correo.html,
        textContent: correo.texto,
      }),
      signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
    });
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '');
      throw new Error(`Brevo respondió ${respuesta.status}: ${detalle}`);
    }
  }
}

/** "Edificio - Pagos <correo@gmail.com>" → { name: 'Edificio - Pagos', email: 'correo@gmail.com' } */
function separarRemitente(remitente: string): { email: string; name?: string } {
  const partes = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(remitente);
  if (!partes) return { email: remitente.trim() };
  const nombre = partes[1].trim();
  return nombre ? { name: nombre, email: partes[2].trim() } : { email: partes[2].trim() };
}
