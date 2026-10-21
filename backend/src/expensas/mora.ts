import { Prisma } from '../generated/prisma/client.js';

export type ReglaMora = {
  dia: number;
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

/**
 * Cuántas veces se cobra la mora a una deuda vencida (fechas a medianoche UTC).
 *  - por mes: una al llegar el día de vencimiento y otra cada mes en ese mismo día
 *  - por día: una por cada día desde el vencimiento, contando el propio día
 * Antes del vencimiento es 0.
 */
export function unidadesMora(vencimiento: Date, hoy: Date, frecuencia: string): number {
  if (hoy < vencimiento) return 0;

  if (frecuencia === 'dia') {
    return Math.floor((hoy.getTime() - vencimiento.getTime()) / UN_DIA) + 1;
  }

  return (
    (hoy.getUTCFullYear() - vencimiento.getUTCFullYear()) * 12 +
    (hoy.getUTCMonth() - vencimiento.getUTCMonth()) +
    (hoy.getUTCDate() >= vencimiento.getUTCDate() ? 1 : 0)
  );
}

/**
 * Mora total de una deuda a la fecha `hoy`:
 *   por unidad = % del monto o monto fijo (sin pasar el tope, si hay)
 *   mora       = por unidad × unidades
 * Las deudas sin expensa (extras) no generan mora.
 */
export function calcularMora(deuda: DeudaMora, regla: ReglaMora, hoy: Date): Prisma.Decimal {
  if (deuda.id_expensa === null) return new Prisma.Decimal(0);

  const unidades = unidadesMora(deuda.fecha_vencimiento, hoy, regla.frecuencia);
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
