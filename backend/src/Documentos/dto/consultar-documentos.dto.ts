import { IsOptional, IsInt, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class ConsultarDocumentosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_tipo?: number;

  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  restringido?: boolean;
}