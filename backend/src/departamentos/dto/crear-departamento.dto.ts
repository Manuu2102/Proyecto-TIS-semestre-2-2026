import {
  IsInt,
  IsString,
  IsBoolean,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';

export class CrearDepartamentoDto {
  @IsInt()
  @Min(1)
  numero: number;

  @IsInt()
  @Min(0)
  piso: number;

  @IsInt()
  @Min(0)
  habitaciones: number;

  @IsInt()
  @Min(0)
  banos: number;

  @IsInt()
  @Min(0)
  superficie_m2: number;

  @IsNumber()
  @Min(0)
  precio: number;

  @IsBoolean()
  amueblado: boolean;

  @IsBoolean()
  libre: boolean;

  @IsString()
  @MaxLength(255)
  descripcion: string;
}