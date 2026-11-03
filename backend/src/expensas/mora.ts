import { Prisma } from '../generated/prisma/client.js';
import { enLaPaz } from './hora-la-paz.js';

export type ReglaMora = {
  dia: number;
  // Hora del vencimiento (columna TIME, en hora de La Paz)
  hora: Date;
  tipo: string; // 'porcentaje' | 'fijo'
  valor: Prisma.Decimal;
  tope: Prisma.Decimal | null;
  frecuencia: string; // 'mes' | 'dia'
  // false: no hay regla guardada y se usa el mora_valor de cada expensa
  configurada: boolean;
};

export type DeudaMora = {
  monto: Prisma.Decimal;
  fecha_vencimiento: Date;
  id_expensa: bigint | null;
  mora_valor_expensa: Prisma.Decimal | null;
};

const UN_DIA = 86_400_000;

// Tiempo transcurrido desde el inicio del mes (día y hora)
const dentroDelMes = (d: Date) => d.getTime() - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);

/**
 * Cuántas veces se cobra la mora a una deuda vencida (fecha y hora exactas).
 *  - por mes: una al llegar el vencimiento y otra cada mes al llegar el mismo día y hora
 *  - por día: una al llegar el vencimiento y otra cada 24 horas
 * Antes del vencimiento es 0.
 */
export function unidadesMora(vencimiento: Date, ahora: Date, frecuencia: string): number {
  if (ahora < vencimiento) return 0;

  if (frecuencia === 'dia') {
    return Math.floor((ahora.getTime() - vencimiento.getTime()) / UN_DIA) + 1;
  }

  // Los meses se cuentan con el calendario de La Paz
  const v = enLaPaz(vencimiento);
  const a = enLaPaz(ahora);
  return (
    (a.getUTCFullYear() - v.getUTCFullYear()) * 12 +
    (a.getUTCMonth() - v.getUTCMonth()) +
    (dentroDelMes(a) >= dentroDelMes(v) ? 1 : 0)
  );
}

/**
 * Mora total de una deuda en el momento `ahora`:
 *   por unidad = % del monto o monto fijo (sin pasar el tope, si hay)
 *   mora       = por unidad × unidades
 * Las deudas sin expensa (extras) no generan mora.
 */
export function calcularMora(deuda: DeudaMora, regla: ReglaMora, ahora: Date): Prisma.Decimal {
  if (deuda.id_expensa === null) return new Prisma.Decimal(0);

  const unidades = unidadesMora(deuda.fecha_vencimiento, ahora, regla.frecuencia);
  if (unidades <= 0) return new Prisma.Decimal(0);

  let porUnidad: Prisma.Decimal;
  if (!regla.configurada) {
    porUnidad = deuda.mora_valor_expensa ?? new Prisma.Decimal(0);
  } else if (regla.tipo === 'porcentaje') {
    porUnidad = deuda.monto.mul(regla.valor).div(100);
  } else {
    porUnidad = regla.valor;
  }
  if (regla.tope && porUnidad.gt(regla.tope)) porUnidad = regla.tope;

  return porUnidad.mul(unidades).toDecimalPlaces(2);
}
