import { describe, expect, it } from 'vitest';
import { leerFecha, leerId, leerMonto, leerOpcional, leerTexto } from './validacion.js';

const mensaje = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as Error).message;
  }
  return null;
};

describe('leerMonto', () => {
  it('acepta montos positivos con hasta 2 decimales (también con coma)', () => {
    expect(leerMonto('150.5', 'monto').toNumber()).toBe(150.5);
    expect(leerMonto('150,25', 'monto').toNumber()).toBe(150.25);
    expect(leerMonto(80, 'monto').toNumber()).toBe(80);
  });

  it('rechaza con el mensaje de la HU', () => {
    expect(mensaje(() => leerMonto(undefined, 'monto'))).toBe('El campo monto es obligatorio.');
    expect(mensaje(() => leerMonto('', 'monto'))).toBe('El campo monto es obligatorio.');
    expect(mensaje(() => leerMonto('0', 'monto'))).toBe('El monto debe ser mayor a 0.');
    expect(mensaje(() => leerMonto('-5', 'monto'))).toBe('El monto debe ser mayor a 0.');
    expect(mensaje(() => leerMonto('10.123', 'monto'))).toBe('El monto admite como máximo 2 decimales.');
    expect(mensaje(() => leerMonto('abc', 'monto'))).toBe('El monto debe ser un número válido.');
  });

  it('permite cero cuando se indica (monto inicial de caja)', () => {
    expect(leerMonto('0', 'monto inicial', true).toNumber()).toBe(0);
    expect(mensaje(() => leerMonto('-1', 'monto inicial', true))).toBe('El monto inicial no puede ser negativo.');
  });
});

describe('leerFecha, leerId, leerTexto, leerOpcional', () => {
  it('valida fechas', () => {
    expect(leerFecha('2026-10-09T00:00:00.000Z', 'fecha')).toBe('2026-10-09');
    expect(mensaje(() => leerFecha(undefined, 'fecha'))).toBe('El campo fecha es obligatorio.');
    expect(mensaje(() => leerFecha('09/10/2026', 'fecha'))).toBe('La fecha no tiene un formato válido (AAAA-MM-DD).');
  });

  it('valida ids', () => {
    expect(leerId('12', 'categoría')).toBe(12n);
    expect(mensaje(() => leerId('', 'categoría'))).toBe('El campo categoría es obligatorio.');
    expect(mensaje(() => leerId('0', 'categoría'))).toBe('El campo categoría no es válido.');
  });

  it('valida textos de 10 a 255 caracteres', () => {
    expect(leerTexto('  Error de registro  ', 'motivo', 'largo')).toBe('Error de registro');
    expect(mensaje(() => leerTexto('', 'motivo', 'largo'))).toBe('El campo motivo es obligatorio.');
    expect(mensaje(() => leerTexto('corto', 'motivo', 'largo'))).toBe('largo');
  });

  it('los opcionales vacíos quedan en null', () => {
    expect(leerOpcional('   ', 'descripción')).toBeNull();
    expect(leerOpcional(' Pago ', 'descripción')).toBe('Pago');
    expect(mensaje(() => leerOpcional('x'.repeat(256), 'descripción'))).toBe(
      'El campo descripción admite como máximo 255 caracteres.',
    );
  });
});
