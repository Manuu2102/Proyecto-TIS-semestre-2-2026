import { IsIn, IsOptional, Matches } from 'class-validator';

export class GenerarMesDto {
  // YYYY-MM
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'periodo debe tener el formato YYYY-MM' })
  periodo: string;

  // Solo los departamentos de esa categoría; si no se envía, se generan todas
  @IsOptional()
  @IsIn(['A', 'B', 'C'], { message: 'La categoría debe ser A, B o C' })
  categoria?: 'A' | 'B' | 'C';
}
