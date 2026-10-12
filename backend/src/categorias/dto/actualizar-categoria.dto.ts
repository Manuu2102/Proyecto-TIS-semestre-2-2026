import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ActualizarCategoriaDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}