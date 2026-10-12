import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CrearIngresoDto {
  @IsDateString()
  fecha: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_categoria: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @IsIn(['efectivo', 'transferencia', 'deposito'])
  metodo: 'efectivo' | 'transferencia' | 'deposito';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_cuenta?: number;
}