import { IsIn, IsOptional, IsString } from 'class-validator';

export class ConsultarSaldoDto {
  // Fecha de corte (YYYY-MM-DD); si no llega, hoy
  @IsOptional()
  @IsString()
  corte?: string;

  // Inicio del período (YYYY-MM-DD); si no llega, la apertura de caja
  @IsOptional()
  @IsString()
  desde?: string;
}

export class ExportarSaldoDto extends ConsultarSaldoDto {
  @IsIn(['pdf', 'excel'], { message: 'El formato debe ser pdf o excel.' })
  formato: 'pdf' | 'excel';
}
