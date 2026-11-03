import { Prisma } from '../generated/prisma/client.js';

/**
 * Deudas que paga el saldo a favor, de la más antigua a la más nueva (vienen ya en ese orden).
 * Cada deuda se paga completa o no se paga: se detiene en la primera que el saldo no cubre.
 */
export function deudasQueCubre<T extends { total: Prisma.Decimal }>(
  saldo: Prisma.Decimal,
  deudas: T[],
): T[] {
  const cubiertas: T[] = [];
  let restante = saldo;
  for (const deuda of deudas) {
    if (restante.lt(deuda.total)) break;
    cubiertas.push(deuda);
    restante = restante.minus(deuda.total);
  }
  return cubiertas;
}
