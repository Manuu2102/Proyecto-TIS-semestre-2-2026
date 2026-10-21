import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ExtraItemDto {
  // Número del departamento (el que muestra el front)
  @IsInt()
  @IsPositive()
  departamento: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  concepto: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto: number;
}

export class CrearExtrasDto {
  // YYYY-MM
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'periodo debe tener el formato YYYY-MM' })
  periodo: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExtraItemDto)
  extras: ExtraItemDto[];
}