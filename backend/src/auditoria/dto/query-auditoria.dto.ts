import { IsOptional, IsUUID, IsIn, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAuditoriaDto {
  @IsOptional()
  @IsUUID()
  usuario_id?: string;

  @IsOptional()
  @IsIn(['INSERT', 'UPDATE', 'DELETE'])
  accion?: string;

  @IsOptional()
  tabla_afectada?: string;

  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}