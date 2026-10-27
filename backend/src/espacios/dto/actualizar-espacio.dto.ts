import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class ActualizarEspacioDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  numero?: number;

  @IsOptional()
  @IsInt()
  piso?: number;

  @IsOptional()
  @IsBoolean()
  discapacitados?: boolean;

  // Ausente = no cambia; null = quitar la asignación; número = reasignar
  @IsOptional()
  @IsInt()
  @Min(1)
  id_departamento?: number | null;
}
