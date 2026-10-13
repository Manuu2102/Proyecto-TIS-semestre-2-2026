import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CrearCuentaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  banco: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  numero_cuenta: string;

  @IsIn(['ahorro', 'corriente'])
  tipo_cuenta: 'ahorro' | 'corriente';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  saldo?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}