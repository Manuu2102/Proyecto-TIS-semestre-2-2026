import { Allow } from 'class-validator';

export class AbrirCajaDto {
  @Allow()
  monto?: number | string;

  @Allow()
  fecha?: string;
}
