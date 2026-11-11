import { IsString, IsNumber, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class RegistrarPagoDto {
  @IsNumber()
  id_personal: number;

  @IsNumber()
  monto: number;

  @IsString()
  @IsNotEmpty()
  fecha: string;

  @IsString()
  @IsIn(['Sueldo', 'Anticipo', 'Bono', 'Descuento'])
  tipo_pago: string;

  @IsString()
  @IsIn(['Efectivo', 'Transferencia'])
  metodo: string;

  @IsOptional()
  @IsString()
  referencia?: string;
}