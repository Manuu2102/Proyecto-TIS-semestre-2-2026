import { Allow } from 'class-validator';

/**
 * Llega como multipart (puede traer comprobante), así que todo viene como texto.
 * Se valida en el servicio para responder un mensaje claro por campo (HU-16 #2-#6).
 */
export class CrearGastoDto {
  @Allow()
  fecha?: string;

  @Allow()
  monto?: string | number;

  @Allow()
  id_categoria?: string | number;

  // Proveedor o beneficiario
  @Allow()
  proveedor?: string;

  @Allow()
  descripcion?: string;

  // efectivo | transferencia | deposito (si falta, efectivo); el dinero siempre pasa por caja
  @Allow()
  metodo?: string;
}
