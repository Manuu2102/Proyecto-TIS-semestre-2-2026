import { describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { deudasQueCubre } from './saldo.js';

const deuda = (id: number, total: number) => ({ id, total: new Prisma.Decimal(total) });
const ids = (deudas: { id: number }[]) => deudas.map((d) => d.id);

describe('deudasQueCubre', () => {
  it('paga de la más antigua a la más nueva mientras alcance', () => {
    expect(ids(deudasQueCubre(new Prisma.Decimal(500), [deuda(1, 250), deuda(2, 250)]))).toEqual([1, 2]);
    expect(ids(deudasQueCubre(new Prisma.Decimal(300), [deuda(1, 250), deuda(2, 250)]))).toEqual([1]);
  });

  it('se detiene en la primera que no cubre, aunque una posterior sea menor', () => {
    expect(ids(deudasQueCubre(new Prisma.Decimal(100), [deuda(1, 250), deuda(2, 80)]))).toEqual([]);
  });

  it('sin saldo no cubre nada', () => {
    expect(deudasQueCubre(new Prisma.Decimal(0), [deuda(1, 250)])).toEqual([]);
  });
});
