import { Allow } from 'class-validator';

/**
 * Llega como multipart (trae el comprobante), así que todo viene como texto.
 * Se valida en el servicio para responder un mensaje claro por campo.
 */
export class RegistrarPagoDto {
  @Allow()
  id_personal?: string | number;

  // Sueldo | Anticipo ('Pago' se toma como Sueldo)
  @Allow()
  tipo_pago?: string;

  @Allow()
  monto?: string | number;

  // YYYY-MM-DD
  @Allow()
  fecha?: string;

  // Efectivo | Transferencia
  @Allow()
  metodo?: string;

  @Allow()
  referencia?: string;
}
