import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class ConsultarCategoriasDto {
  @IsOptional()
  @IsIn(['ingreso', 'gasto'], { message: 'El tipo debe ser ingreso o gasto.' })
  tipo?: 'ingreso' | 'gasto';

  // "false" debe quedar en false (Boolean("false") sería true)
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  activa?: boolean;
}
