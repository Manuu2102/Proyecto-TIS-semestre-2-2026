import { describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { calcularMora, unidadesMora, type ReglaMora } from './mora.js';
import { desdeLaPaz, horaDesdeTexto, horaTexto, momentoLaPaz, proximaHoraLaPaz } from './hora-la-paz.js';

// 10 de diciembre de 2026 a las 18:30 en La Paz (22:30 UTC)
const vence = desdeLaPaz(2026, 11, 10, 18, 30);
const enLaPaz = (dia: number, hora: number, minuto: number, mes = 11, anio = 2026) =>
  desdeLaPaz(anio, mes, dia, hora, minuto);

describe('hora de La Paz', () => {
  it('convierte entre La Paz y UTC', () => {
    expect(vence.toISOString()).toBe('2026-12-10T22:30:00.000Z');
    expect(momentoLaPaz(vence)).toBe('2026-12-10T18:30');
    // 23:00 del 31 en La Paz ya es el 1 del mes siguiente en UTC
    expect(momentoLaPaz(enLaPaz(31, 23, 0, 11))).toBe('2026-12-31T23:00');
  });

  it('lee y escribe columnas TIME', () => {
    expect(horaTexto(horaDesdeTexto('18:30'))).toBe('18:30');
    expect(horaTexto(new Date(0))).toBe('00:00');
  });

  it('calcula la próxima vez que llega una hora', () => {
    expect(momentoLaPaz(proximaHoraLaPaz('18:30', enLaPaz(10, 9, 0)))).toBe('2026-12-10T18:30');
    expect(momentoLaPaz(proximaHoraLaPaz('18:30', enLaPaz(10, 18, 30)))).toBe('2026-12-11T18:30');
    expect(momentoLaPaz(proximaHoraLaPaz('00:00', enLaPaz(31, 23, 0)))).toBe('2027-01-01T00:00');
  });
});

describe('unidades de mora', () => {
  it('por día: una al vencer y otra cada 24 horas', () => {
    expect(unidadesMora(vence, enLaPaz(10, 18, 29), 'dia')).toBe(0);
    expect(unidadesMora(vence, enLaPaz(10, 18, 30), 'dia')).toBe(1);
    expect(unidadesMora(vence, enLaPaz(11, 18, 29), 'dia')).toBe(1);
    expect(unidadesMora(vence, enLaPaz(11, 18, 30), 'dia')).toBe(2);
  });

  it('por mes: una al vencer y otra al llegar el mismo día y hora', () => {
    expect(unidadesMora(vence, enLaPaz(10, 18, 29), 'mes')).toBe(0);
    expect(unidadesMora(vence, enLaPaz(10, 18, 30), 'mes')).toBe(1);
    expect(unidadesMora(vence, enLaPaz(10, 18, 29, 0, 2027), 'mes')).toBe(1);
    expect(unidadesMora(vence, enLaPaz(10, 18, 30, 0, 2027), 'mes')).toBe(2);
  });

  it('a las 00:00 se comporta como antes (vence al empezar el día)', () => {
    const medianoche = enLaPaz(10, 0, 0);
    expect(unidadesMora(medianoche, enLaPaz(9, 23, 59), 'mes')).toBe(0);
    expect(unidadesMora(medianoche, enLaPaz(10, 0, 5), 'mes')).toBe(1);
    expect(unidadesMora(medianoche, enLaPaz(10, 0, 5), 'dia')).toBe(1);
  });
});

describe('calcularMora', () => {
  const regla: ReglaMora = {
    dia: 10,
    hora: horaDesdeTexto('18:30'),
    tipo: 'fijo',
    valor: new Prisma.Decimal(5),
    tope: null,
    frecuencia: 'dia',
    configurada: true,
  };
  const deuda = {
    monto: new Prisma.Decimal(300),
    fecha_vencimiento: vence,
    id_expensa: BigInt(1),
    mora_valor_expensa: null,
  };

  it('cobra 5 Bs por cada día desde el vencimiento', () => {
    expect(calcularMora(deuda, regla, enLaPaz(10, 18, 29)).toNumber()).toBe(0);
    expect(calcularMora(deuda, regla, enLaPaz(10, 18, 32)).toNumber()).toBe(5);
    expect(calcularMora(deuda, regla, enLaPaz(12, 18, 30)).toNumber()).toBe(15);
  });

  it('los extras no generan mora', () => {
    expect(calcularMora({ ...deuda, id_expensa: null }, regla, enLaPaz(12, 18, 30)).toNumber()).toBe(0);
  });
});
