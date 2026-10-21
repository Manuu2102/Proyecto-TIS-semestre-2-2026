import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class DepositarFondosDto {
  @IsInt()
  @IsPositive()
  id_departamento: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  metodo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia?: string;

  // Obsoleto: se acepta para no romper clientes anteriores, pero se ignora.
  // El usuario que registra el depósito sale del token.
  @IsOptional()
  @IsUUID()
  id_usuario?: string;
}