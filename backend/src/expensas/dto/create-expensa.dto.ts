import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExpensaDto {
  @IsString()
  @MaxLength(100)
  nombre: string;

  // Monto que paga cada departamento del tipo
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto_total: number;

  @IsInt()
  @IsPositive()
  tipo_departamento: number;

  @IsOptional()
  @IsBoolean()
  pagos_anticipados?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mora_valor?: number;
}