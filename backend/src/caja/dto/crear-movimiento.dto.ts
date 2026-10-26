import { Allow } from 'class-validator';

/**
 * Movimiento manual de caja. Los campos se validan en el servicio para responder
 * con los mensajes exactos de la HU-20 ("El campo {campo} es obligatorio.", etc.).
 */
export class CrearMovimientoDto {
  @Allow()
  fecha?: string;

  @Allow()
  tipo?: string;

  @Allow()
  monto?: number | string;

  @Allow()
  concepto?: string;
}
