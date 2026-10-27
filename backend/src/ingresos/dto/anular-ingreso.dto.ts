import { Allow } from 'class-validator';

/** El motivo es obligatorio (10 a 255 caracteres); se valida en el servicio. */
export class AnularIngresoDto {
  @Allow()
  motivo_anulacion?: string;

  @Allow()
  motivo?: string;
}
