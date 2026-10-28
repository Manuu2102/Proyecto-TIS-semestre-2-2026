import { Matches } from 'class-validator';

export class GenerarMesDto {
  // YYYY-MM
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'periodo debe tener el formato YYYY-MM' })
  periodo: string;
}
