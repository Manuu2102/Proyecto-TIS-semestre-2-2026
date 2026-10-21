import { IsInt, IsOptional, IsPositive, IsUUID, Max, Min } from 'class-validator';

export class PagarAnticipadoDto {
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

  // Obsoleto: se acepta para no romper clientes anteriores, pero se ignora.
  // El usuario que registra el pago sale del token.
  @IsOptional()
  @IsUUID()
  id_usuario?: string;
}
