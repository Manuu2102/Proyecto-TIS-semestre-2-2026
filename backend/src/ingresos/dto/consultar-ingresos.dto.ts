import { IsBoolean, IsDateString, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ConsultarIngresosDto {
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_categoria?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  anulado?: boolean;
}