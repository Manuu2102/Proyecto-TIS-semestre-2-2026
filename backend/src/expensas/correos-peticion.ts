import type { Correo } from '../mail/mail.service.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2026-10" → "octubre 2026" */
export const nombrePeriodo = (periodo: string) => {
  const [anio, mes] = periodo.split('-').map(Number);
  return `${MESES[mes - 1]} ${anio}`;
};

const bs = (n: number) =>
  'Bs. ' + n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fecha = (d: Date) =>
  d.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz', day: '2-digit', month: '2-digit', year: 'numeric' });

// Los textos que escribe un usuario (nombre, motivo) no deben interpretarse como HTML
const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const plantilla = (titulo: string, color: string, saludo: string, cuerpo: string, filas: [string, string][]) => `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#222">
  <h2 style="color:${color};margin-bottom:4px">${titulo}</h2>
  <p>${saludo}</p>
  <p>${cuerpo}</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0">
    ${filas
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">${k}</td>` +
          `<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right"><b>${v}</b></td></tr>`,
      )
      .join('')}
  </table>
  <p style="color:#888;font-size:12px">Este es un correo automático, por favor no respondas a este mensaje.</p>
</div>`;

export type DatosCorreoPeticion = {
  nombre: string;
  departamento: number | null;
  periodo: string;
  enviada: Date;
  monto: number;
  mora: number;
  total: number;
};

export const correoPagoAprobado = (d: DatosCorreoPeticion, idFactura: string): Correo => {
  const filas: [string, string][] = [
    ['Departamento', String(d.departamento ?? '-')],
    ['Período', nombrePeriodo(d.periodo)],
    ['Expensa y extras', bs(d.monto)],
    ['Mora', bs(d.mora)],
    ['Total pagado', bs(d.total)],
    ['Fecha de pago', fecha(d.enviada)],
    ['N.º de factura', idFactura],
  ];
  const nombre = escapar(d.nombre);
  return {
    asunto: `Pago confirmado - Expensa de ${nombrePeriodo(d.periodo)}`,
    html: plantilla(
      'Pago confirmado',
      '#1a7f37',
      `Hola ${nombre},`,
      'La administración revisó tu comprobante y <b>confirmó tu pago</b> por QR.',
      filas,
    ),
    texto:
      `Hola ${d.nombre},\n\nLa administración revisó tu comprobante y confirmó tu pago por QR.\n\n` +
      filas.map(([k, v]) => `${k}: ${v}`).join('\n'),
  };
};

export const correoPagoRechazado = (d: DatosCorreoPeticion, motivo: string): Correo => {
  const filas: [string, string][] = [
    ['Departamento', String(d.departamento ?? '-')],
    ['Período', nombrePeriodo(d.periodo)],
    ['Monto de la deuda', bs(d.total)],
    ['Enviado el', fecha(d.enviada)],
  ];
  const nombre = escapar(d.nombre);
  return {
    asunto: `Comprobante rechazado - Expensa de ${nombrePeriodo(d.periodo)}`,
    html: plantilla(
      'Comprobante rechazado',
      '#cf222e',
      `Hola ${nombre},`,
      `La administración <b>rechazó</b> el comprobante que enviaste.<br><br>` +
        `<b>Motivo:</b> ${escapar(motivo)}<br><br>` +
        'La deuda vuelve a estar pendiente: puedes enviar un nuevo comprobante desde el sistema.',
      filas,
    ),
    texto:
      `Hola ${d.nombre},\n\nLa administración rechazó el comprobante que enviaste.\n` +
      `Motivo: ${motivo}\n\nLa deuda vuelve a estar pendiente: puedes enviar un nuevo comprobante desde el sistema.\n\n` +
      filas.map(([k, v]) => `${k}: ${v}`).join('\n'),
  };
};
