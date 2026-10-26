import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { esFechaISO } from './formato.js';

/**
 * Validaciones con los mensajes de las HU de finanzas (caja, ingresos, gastos):
 * "El campo {campo} es obligatorio.", monto > 0 con hasta 2 decimales, etc.
 * Se usan en el servicio (no en el DTO) para responder un solo mensaje claro por campo.
 */

export const obligatorio = (campo: string) => `El campo ${campo} es obligatorio.`;

const vacio = (valor: unknown) => valor === undefined || valor === null || String(valor).trim() === '';

/** Monto obligatorio, numérico, mayor a 0 (o >= 0 si se permite cero) y con hasta 2 decimales. */
export function leerMonto(valor: unknown, campo: string, permitirCero = false): Prisma.Decimal {
  if (vacio(valor)) throw new BadRequestException(obligatorio(campo));
  const texto = String(valor).trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(texto)) throw new BadRequestException('El monto debe ser un número válido.');
  const monto = new Prisma.Decimal(texto);
  if (permitirCero ? monto.lt(0) : monto.lte(0)) {
    throw new BadRequestException(permitirCero ? 'El monto inicial no puede ser negativo.' : 'El monto debe ser mayor a 0.');
  }
  if (monto.decimalPlaces() > 2) throw new BadRequestException('El monto admite como máximo 2 decimales.');
  return monto;
}

/** Texto obligatorio de 10 a 255 caracteres (concepto, motivo de anulación). */
export function leerTexto(valor: unknown, campo: string, mensajeLongitud: string): string {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (!texto) throw new BadRequestException(obligatorio(campo));
  if (texto.length < 10 || texto.length > 255) throw new BadRequestException(mensajeLongitud);
  return texto;
}

/** Fecha obligatoria con formato AAAA-MM-DD (acepta también un ISO completo). */
export function leerFecha(valor: unknown, campo: string): string {
  const texto = typeof valor === 'string' ? valor.trim().slice(0, 10) : '';
  if (!texto) throw new BadRequestException(obligatorio(campo));
  if (!esFechaISO(texto)) throw new BadRequestException(`La ${campo} no tiene un formato válido (AAAA-MM-DD).`);
  return texto;
}

/** Id numérico obligatorio (categoría, cuenta). */
export function leerId(valor: unknown, campo: string): bigint {
  if (vacio(valor)) throw new BadRequestException(obligatorio(campo));
  const texto = String(valor).trim();
  if (!/^\d+$/.test(texto) || texto === '0') throw new BadRequestException(`El campo ${campo} no es válido.`);
  return BigInt(texto);
}

/** Texto opcional: recortado y con un largo máximo; vacío → null. */
export function leerOpcional(valor: unknown, campo: string, maximo = 255): string | null {
  if (vacio(valor)) return null;
  const texto = String(valor).trim();
  if (texto.length > maximo) throw new BadRequestException(`El campo ${campo} admite como máximo ${maximo} caracteres.`);
  return texto;
}
