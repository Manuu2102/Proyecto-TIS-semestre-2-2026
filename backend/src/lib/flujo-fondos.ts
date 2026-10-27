import { BadRequestException, HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { CajaService } from '../caja/caja.service.js';
import type { BancosService } from '../bancos/bancos.service.js';
import { hoyISO } from './formato.js';
import { leerFecha, leerId, leerMonto, leerOpcional } from './validacion.js';

/**
 * Lógica común de ingresos (HU-15) y gastos (HU-16): validar los datos del registro y
 * mover el dinero en caja (efectivo) o en la cuenta bancaria (transferencia o depósito)
 * dentro de la misma transacción que guarda el ingreso o el gasto.
 */

export type TipoRegistro = 'ingreso' | 'gasto';
export type Metodo = 'efectivo' | 'transferencia' | 'deposito';

const METODOS: Metodo[] = ['efectivo', 'transferencia', 'deposito'];

export type DatosRegistro = {
  fecha: string;
  monto: Prisma.Decimal;
  idCategoria: bigint;
  categoria: string;
  descripcion: string | null;
  proveedor: string | null;
  metodo: Metodo;
  idCuenta: bigint | null;
};

/** Valida el formulario con un mensaje claro por campo (HU-15 #2-#6, HU-16 #2-#6). */
export async function leerRegistro(
  prisma: PrismaService,
  bancos: BancosService,
  dto: Record<string, unknown>,
  tipo: TipoRegistro,
): Promise<DatosRegistro> {
  const fecha = leerFecha(dto.fecha, 'fecha');
  if (fecha > hoyISO()) throw new BadRequestException('La fecha no puede ser futura.');
  const monto = leerMonto(dto.monto, 'monto');
  const idCategoria = leerId(dto.id_categoria, 'categoría');

  const categoria = await prisma.categoria_movimiento.findUnique({ where: { id: idCategoria } });
  if (!categoria) throw new BadRequestException('La categoría seleccionada no existe.');
  if (categoria.tipo !== tipo) {
    throw new BadRequestException(`La categoría seleccionada no es de tipo "${tipo}".`);
  }
  if (!categoria.activa) throw new BadRequestException('La categoría seleccionada está inactiva.');

  // Si no se indica el método, se toma efectivo (los obligatorios son fecha, monto y categoría)
  const metodo = (String(dto.metodo ?? '').trim().toLowerCase() || 'efectivo') as Metodo;
  if (!METODOS.includes(metodo)) {
    throw new BadRequestException('El método debe ser efectivo, transferencia o depósito.');
  }

  let idCuenta: bigint | null = null;
  if (metodo !== 'efectivo') {
    idCuenta = leerId(dto.id_cuenta, 'cuenta bancaria');
    await bancos.cuentaActiva(prisma, idCuenta);
  }

  return {
    fecha,
    monto,
    idCategoria,
    categoria: categoria.nombre,
    descripcion: leerOpcional(dto.descripcion, 'descripción'),
    proveedor: tipo === 'gasto' ? leerOpcional(dto.proveedor, 'proveedor o beneficiario') : null,
    metodo,
    idCuenta,
  };
}

/**
 * Genera el movimiento de caja o banco del registro. Si falla (caja sin abrir, saldo
 * insuficiente, cuenta inválida), lanza el error y la transacción completa se revierte.
 */
export async function registrarFlujoEnTx(
  tx: Prisma.TransactionClient,
  servicios: { caja: CajaService; bancos: BancosService },
  d: { tipo: TipoRegistro; id: bigint; datos: DatosRegistro; idUsuario: string },
) {
  const esIngreso = d.tipo === 'ingreso';
  const detalle = [d.datos.proveedor, d.datos.descripcion].filter(Boolean).join(' - ');
  const concepto = `${esIngreso ? 'Ingreso' : 'Gasto'} #${d.id}: ${d.datos.categoria}${detalle ? ` - ${detalle}` : ''}`;
  const origen = esIngreso ? ('Ingreso' as const) : ('Gasto' as const);
  const vinculo = esIngreso ? { idIngreso: d.id } : { idGasto: d.id };

  if (d.datos.metodo === 'efectivo') {
    const { movimiento } = await servicios.caja.registrarEnTx(tx, {
      tipo: esIngreso ? 'ENTRADA' : 'SALIDA',
      monto: d.datos.monto,
      fecha: d.datos.fecha,
      concepto,
      origen,
      idUsuario: d.idUsuario,
      ...vinculo,
    });
    return { medio: 'caja' as const, numero: movimiento.numero };
  }

  const tipoBanco = esIngreso
    ? d.datos.metodo === 'transferencia'
      ? 'Transferencia recibida'
      : 'Depósito'
    : d.datos.metodo === 'transferencia'
      ? 'Transferencia enviada'
      : 'Retiro';
  const { movimiento } = await servicios.bancos.registrarEnTx(tx, {
    idCuenta: d.datos.idCuenta!,
    tipo: tipoBanco,
    signo: esIngreso ? 1 : -1,
    monto: d.datos.monto,
    fecha: d.datos.fecha,
    referencia: `${esIngreso ? 'ING' : 'GAS'}-${d.id}`,
    concepto,
    origen,
    idUsuario: d.idUsuario,
    ...vinculo,
  });
  return { medio: 'banco' as const, numero: movimiento.numero };
}

/** Revierte el movimiento de caja o banco del registro anulado (HU-15 #8). */
export async function anularFlujoEnTx(
  tx: Prisma.TransactionClient,
  servicios: { caja: CajaService; bancos: BancosService },
  d: { tipo: TipoRegistro; id: bigint; motivo: string; idUsuario: string },
) {
  const origen = d.tipo === 'ingreso' ? { idIngreso: d.id } : { idGasto: d.id };
  const motivo = `Anulación del ${d.tipo} #${d.id}: ${d.motivo}`;
  // Solo uno de los dos encuentra movimiento: el registro pasó por caja o por banco
  await servicios.caja.anularPorOrigenEnTx(tx, origen, motivo, d.idUsuario);
  await servicios.bancos.anularPorOrigenEnTx(tx, origen, motivo, d.idUsuario);
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
