import { Allow } from 'class-validator';

/** El front envía `motivo`; también se acepta `motivo_anulacion` como en ingresos y gastos. */
export class AnularMovimientoDto {
  @Allow()
  motivo?: string;

  @Allow()
  motivo_anulacion?: string;
}
