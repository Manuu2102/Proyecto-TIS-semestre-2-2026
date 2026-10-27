import { Allow } from 'class-validator';

/**
 * Llega como multipart (puede traer comprobante), así que todo viene como texto.
 * Se valida en el servicio para responder un mensaje claro por campo (HU-15 #2-#6).
 */
export class CrearIngresoDto {
  @Allow()
  fecha?: string;

  @Allow()
  monto?: string | number;

  @Allow()
  id_categoria?: string | number;

  @Allow()
  descripcion?: string;

  // efectivo | transferencia | deposito (si falta, efectivo); el dinero siempre pasa por caja
  @Allow()
  metodo?: string;
}
