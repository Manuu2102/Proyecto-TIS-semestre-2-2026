import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, Max, Min } from 'class-validator';

export class ReglaMoraDto {
  // Día del mes en que se cobra la mora y se generan las deudas nuevas
  @IsInt()
  @Min(1)
  @Max(28)
  dia: number;

  @IsIn(['porcentaje', 'fijo'])
  tipo: 'porcentaje' | 'fijo';

  // Porcentaje de la deuda o monto fijo en Bs., según `tipo`
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valor: number;

  // Límite en Bs. por cada mes/día de mora (opcional)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  tope?: number | null;

  @IsIn(['mes', 'dia'])
  frecuencia: 'mes' | 'dia';
}
