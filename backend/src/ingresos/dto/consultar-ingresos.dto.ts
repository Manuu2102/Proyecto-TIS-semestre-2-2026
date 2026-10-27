import { IsBoolean, IsDateString, IsInt, IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';

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

  // "false" debe quedar en false (Boolean("false") sería true)
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  anulado?: boolean;
}
