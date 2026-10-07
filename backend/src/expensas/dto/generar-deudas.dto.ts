import { IsDateString, IsOptional } from 'class-validator';

export class GenerarDeudasDto {
  // Cualquier fecha del mes cuyas deudas se generan. Si se omite, es el mes actual.
  // Ej: "2026-11-01"
  @IsOptional()
  @IsDateString()
  mes?: string;
}
