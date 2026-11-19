import type { Correo } from '../mail/mail.service.js';

// El nombre viene de la base, pero igual no debe interpretarse como HTML
const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Correo con el código para confirmar el cambio de contraseña. */
export const correoCodigoContrasena = (nombre: string, codigo: string, minutos: number): Correo => {
  const n = escapar(nombre);
  return {
    asunto: `Tu código para cambiar la contraseña: ${codigo}`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#222">
  <h2 style="color:#C83232;margin-bottom:4px">Código de verificación</h2>
  <p>Hola, ${n}:</p>
  <p>Recibimos una solicitud para cambiar la contraseña de tu cuenta. Escribe este código en la pantalla para confirmar que eres tú:</p>
  <p style="font-size:32px;letter-spacing:8px;font-weight:bold;text-align:center;background:#FFF0E9;color:#C83232;padding:16px;border-radius:10px;margin:20px 0">${codigo}</p>
  <p>El código vence en <b>${minutos} minutos</b> y solo se puede usar una vez.</p>
  <p>Si no fuiste tú, ignora este correo: tu contraseña no cambiará. Te recomendamos cambiarla si crees que alguien más la conoce.</p>
  <p style="color:#888;font-size:12px">Este es un correo automático, por favor no respondas a este mensaje.</p>
</div>`,
    texto:
      `Hola, ${nombre}:\n\n` +
      `Tu código para cambiar la contraseña es: ${codigo}\n` +
      `Vence en ${minutos} minutos y solo se puede usar una vez.\n\n` +
      'Si no fuiste tú, ignora este correo: tu contraseña no cambiará.',
  };
};
