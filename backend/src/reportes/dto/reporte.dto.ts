import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** HU-23: filtros combinables del reporte de ingresos y gastos. */
export class FiltrosReporteDto {
  @IsOptional()
  @IsDateString({}, { message: 'La fecha inicial no tiene un formato válido (AAAA-MM-DD).' })
  desde?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha final no tiene un formato válido (AAAA-MM-DD).' })
  hasta?: string;

  @IsOptional()
  @IsIn(['ingreso', 'gasto'], { message: 'El tipo debe ser ingreso o gasto.' })
  tipo?: 'ingreso' | 'gasto';

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La categoría no es válida.' })
  @Min(1, { message: 'La categoría no es válida.' })
  id_categoria?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto mínimo debe ser un número con hasta 2 decimales.' })
  @Min(0, { message: 'El monto mínimo no puede ser negativo.' })
  monto_min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto máximo debe ser un número con hasta 2 decimales.' })
  @Min(0, { message: 'El monto máximo no puede ser negativo.' })
  monto_max?: number;
}

export class ExportarReporteDto extends FiltrosReporteDto {
  @IsIn(['pdf', 'excel'], { message: 'El formato debe ser pdf o excel.' })
  formato: 'pdf' | 'excel';
}

/** HU-24: mes y año del balance. */
export class BalanceMensualDto {
  @Type(() => Number)
  @IsInt({ message: 'El año no es válido.' })
  @Min(2000, { message: 'El año no es válido.' })
  @Max(2100, { message: 'El año no es válido.' })
  anio: number;

  @Type(() => Number)
  @IsInt({ message: 'El mes debe estar entre 1 y 12.' })
  @Min(1, { message: 'El mes debe estar entre 1 y 12.' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12.' })
  mes: number;
}

export class ExportarBalanceDto extends BalanceMensualDto {
  @IsIn(['pdf', 'excel'], { message: 'El formato debe ser pdf o excel.' })
  formato: 'pdf' | 'excel';
}
