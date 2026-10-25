import { IsOptional, IsInt, IsString, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ConsultarDocumentosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_tipo?: number;

  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return value;
  })
  restringido?: boolean;
}