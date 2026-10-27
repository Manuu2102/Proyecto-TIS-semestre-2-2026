import { BadRequestException, HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { CajaService } from '../caja/caja.service.js';
import { hoyISO } from './formato.js';
import { leerId, leerMonto, leerOpcional } from './validacion.js';

/**
 * Lógica común de ingresos (HU-15) y gastos (HU-16): validar los datos del registro y
 * mover el dinero en caja dentro de la misma transacción que guarda el ingreso o el gasto.
 */

export type TipoRegistro = 'ingreso' | 'gasto';
export type Metodo = 'efectivo' | 'transferencia' | 'deposito';

// Los mismos valores que acepta la BD (chk_ingreso_metodo / chk_gasto_metodo)
const METODOS: Metodo[] = ['efectivo', 'transferencia', 'deposito'];

export type DatosRegistro = {
  fecha: string;
  monto: Prisma.Decimal;
  idCategoria: bigint;
  categoria: string;
  descripcion: string | null;
  proveedor: string | null;
  metodo: Metodo;
};

/** Valida el formulario con un mensaje claro por campo (HU-15 #2-#6, HU-16 #2-#6). */
export async function leerRegistro(
  prisma: PrismaService,
  dto: Record<string, unknown>,
  tipo: TipoRegistro,
): Promise<DatosRegistro> {
  // Siempre la fecha de hoy en Bolivia: se ignora la que mande el front
  const fecha = hoyISO();
  const monto = leerMonto(dto.monto, 'monto');
  const idCategoria = leerId(dto.id_categoria, 'categoría');

  const categoria = await prisma.categoria_movimiento.findUnique({ where: { id: idCategoria } });
  if (!categoria) throw new BadRequestException('La categoría seleccionada no existe.');
  if (categoria.tipo !== tipo) {
    throw new BadRequestException(`La categoría seleccionada no es de tipo "${tipo}".`);
  }
  if (!categoria.activa) throw new BadRequestException('La categoría seleccionada está inactiva.');

  // El método de pago queda como dato del registro; el dinero siempre pasa por caja.
  // Si no se indica, se toma efectivo (los obligatorios son fecha, monto y categoría).
  const metodo = (String(dto.metodo ?? '').trim().toLowerCase() || 'efectivo') as Metodo;
  if (!METODOS.includes(metodo)) {
    throw new BadRequestException('El método debe ser efectivo, transferencia o depósito.');
  }

  return {
    fecha,
    monto,
    idCategoria,
    categoria: categoria.nombre,
    descripcion: leerOpcional(dto.descripcion, 'descripción'),
    proveedor: tipo === 'gasto' ? leerOpcional(dto.proveedor, 'proveedor o beneficiario') : null,
    metodo,
  };
}

/**
 * Genera el movimiento de caja del registro: ENTRADA para ingresos, SALIDA para gastos.
 * Si falla (caja sin abrir, saldo insuficiente), lanza el error y la transacción
 * completa se revierte.
 */
export async function registrarFlujoEnTx(
  tx: Prisma.TransactionClient,
  caja: CajaService,
  d: { tipo: TipoRegistro; id: bigint; datos: DatosRegistro; idUsuario: string },
) {
  const esIngreso = d.tipo === 'ingreso';
  const detalle = [d.datos.proveedor, d.datos.descripcion].filter(Boolean).join(' - ');
  const concepto = `${esIngreso ? 'Ingreso' : 'Gasto'} #${d.id}: ${d.datos.categoria}${detalle ? ` - ${detalle}` : ''}`;

  const { movimiento } = await caja.registrarEnTx(tx, {
    tipo: esIngreso ? 'ENTRADA' : 'SALIDA',
    monto: d.datos.monto,
    fecha: d.datos.fecha,
    concepto,
    origen: esIngreso ? 'Ingreso' : 'Gasto',
    idUsuario: d.idUsuario,
    ...(esIngreso ? { idIngreso: d.id } : { idGasto: d.id }),
  });
  return { numero: movimiento.numero };
}

/**
 * Agrega el contexto al error ("El ingreso no pudo registrarse: …") conservando el
 * código HTTP, para que el front informe que el registro no se guardó (HU-15 #7 front).
 */
export function conContexto(error: unknown, prefijo: string): never {
  if (error instanceof HttpException) {
    const respuesta = error.getResponse();
    const mensaje =
      typeof respuesta === 'object' && respuesta && 'message' in respuesta
        ? [respuesta.message].flat().join(' ')
        : error.message;
    throw new HttpException({ statusCode: error.getStatus(), message: `${prefijo}: ${mensaje}` }, error.getStatus());
  }
  throw error;
}
