import { IsInt, IsDateString, IsOptional, Min } from 'class-validator';

export class CrearOcupacionDto {
  @IsInt()
  @Min(1)
  id_copropietario: number;

  @IsInt()
  @Min(1)
  id_departamento: number;

  @IsDateString()
  fecha_ocupacion: string;

  @IsOptional()
  @IsDateString()
  fecha_fin_ocupacion?: string;
}