import { Prisma } from '../generated/prisma/client.js';

/**
 * Utilidades de formato para finanzas (caja, reportes). Las fechas "del día" se
 * calculan en la hora de Bolivia, no en la del servidor.
 */

const ZONA = 'America/La_Paz';

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

type Monto = Prisma.Decimal | number;

/** Tipo MIME de los archivos .xlsx */
export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** 1234.5 → "Bs 1.234,50" */
export const bs = (monto: Monto) =>
  `Bs ${Number(monto).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "2026-10-09" → "09/10/2026" */
export const fechaCorta = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

/** Fecha de una columna @db.Date → "2026-10-09" */
export const isoDia = (fecha: Date) => fecha.toISOString().slice(0, 10);

/** "2026-10-09" → Date a medianoche UTC, como guarda Prisma las columnas @db.Date */
export const aFecha = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Hoy en Bolivia: "2026-10-09" */
export const hoyISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());

/** Hora actual en Bolivia: "14:05:09" */
export const horaActual = () =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());

/** Hora actual para una columna @db.Time (Prisma la guarda como 1970-01-01T…Z) */
export const horaParaTime = () => new Date(`1970-01-01T${horaActual()}Z`);

/** Fecha y hora actual en Bolivia: "09/10/2026 14:05" */
export const ahoraTexto = () => `${fechaCorta(hoyISO())} ${horaActual().slice(0, 5)}`;

/** Día anterior a una fecha ISO */
export const diaAnterior = (iso: string) => {
  const d = aFecha(iso);
  d.setUTCDate(d.getUTCDate() - 1);
  return isoDia(d);
};

export const esFechaISO = (valor: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(aFecha(valor).getTime());
