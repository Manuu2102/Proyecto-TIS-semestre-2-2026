import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class PagarExpensaDto {
  // Si se envía, debe ser el total de la deuda (monto + mora): no hay pagos parciales.
  // Si no se envía, se paga el total.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto?: number;

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
  // El usuario que registra el pago sale del token.
  @IsOptional()
  @IsUUID()
  id_usuario?: string;
}
