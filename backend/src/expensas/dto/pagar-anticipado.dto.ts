import { IsInt, IsOptional, IsPositive, IsUUID, Max, Min } from 'class-validator';

export class PagarAnticipadoDto {
  @IsUUID()
  id_usuario: string;

  @IsInt()
  @IsPositive()
  id_departamento: number;

  // Cuántos meses a futuro se pagan
  @IsInt()
  @Min(1)
  @Max(12)
  meses: number;

  // Solo necesario si el tipo del departamento tiene más de una expensa
  @IsOptional()
  @IsInt()
  @IsPositive()
  id_expensa?: number;
}