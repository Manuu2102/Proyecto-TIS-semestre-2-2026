import {
  IsInt,
  IsString,
  IsBoolean,
  IsNumber,
  Min,
  MaxLength,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CrearDepartamentoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5)
  codigo: string; // <--- AGREGAR ESTO: Recibe "A", "B" o "C"

  @Type(() => Number)
  @IsInt()
  @Min(1)
  numero: number; // <--- Recibe 101

  @Type(() => Number)
  @IsInt()
  @Min(0)
  piso: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  habitaciones: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  banos: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  superficie_m2: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_tipo_departamento: number;

  @IsBoolean()
  amueblado: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;
}