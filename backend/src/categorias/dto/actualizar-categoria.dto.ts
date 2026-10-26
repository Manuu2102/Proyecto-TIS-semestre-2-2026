import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

// El tipo no se edita: una categoría de ingreso no pasa a ser de gasto
export class ActualizarCategoriaDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto.' })
  @MaxLength(100, { message: 'El nombre admite como máximo 100 caracteres.' })
  nombre?: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto.' })
  @MaxLength(255, { message: 'La descripción admite como máximo 255 caracteres.' })
  descripcion?: string;

  @IsOptional()
  @IsBoolean({ message: 'El campo activa debe ser verdadero o falso.' })
  activa?: boolean;
}
