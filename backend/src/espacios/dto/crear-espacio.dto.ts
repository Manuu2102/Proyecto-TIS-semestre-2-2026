import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/** Sirve para parqueos y bauleras; `discapacitados` solo aplica a parqueos. */
export class CrearEspacioDto {
  @IsInt()
  @Min(1)
  numero: number;

  // Puede ser negativo (subsuelos)
  @IsInt()
  piso: number;

  @IsOptional()
  @IsBoolean()
  discapacitados?: boolean;

  // Departamento al que se asigna; null o ausente = sin asignar
  @IsOptional()
  @IsInt()
  @Min(1)
  id_departamento?: number | null;
}
