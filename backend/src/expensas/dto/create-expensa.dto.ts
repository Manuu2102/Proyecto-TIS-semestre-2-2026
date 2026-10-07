import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
// Deja la ruta que ya te funciona
import { criterio_reparto } from '../../generated/prisma/client.js';

export class CreateExpensaDto {
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto_total: number;

  @IsOptional()
  @IsBoolean()
  pagos_anticipados?: boolean;

  // Mora fija en Bs que se suma por cada mes vencido
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mora_valor?: number;

  // Atributos de los departamentos por los que se reparte la expensa
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(criterio_reparto, { each: true })
  criterios: criterio_reparto[];
}
