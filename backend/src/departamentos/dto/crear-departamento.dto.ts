import {
  IsInt,
  IsString,
  IsNumber,
  Min,
  MaxLength,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

// El código (A, B o C) no se recibe: se toma del tipo de departamento.
// habitaciones, baños y amueblado se omiten porque esas columnas se van a eliminar.
export class CrearDepartamentoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numero: number; // 101 → se muestra como A-101

  @Type(() => Number)
  @IsInt()
  @Min(0)
  piso: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  superficie_m2: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_tipo_departamento: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;
}
