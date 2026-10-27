import { Allow } from 'class-validator';

/**
 * Nombre y tipo son obligatorios; la descripción es opcional (HU-17 #2). Se validan en
 * el servicio para responder un solo mensaje claro por campo.
 */
export class CrearCategoriaDto {
  @Allow()
  nombre?: string;

  // ingreso | gasto
  @Allow()
  tipo?: string;

  @Allow()
  descripcion?: string;

  @Allow()
  activa?: boolean;
}
