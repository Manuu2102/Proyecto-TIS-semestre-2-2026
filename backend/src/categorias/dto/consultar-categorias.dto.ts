import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ConsultarCategoriasDto {
  @IsOptional()
  @IsIn(['ingreso', 'gasto'])
  tipo?: 'ingreso' | 'gasto';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activa?: boolean;
}