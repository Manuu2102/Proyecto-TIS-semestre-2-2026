import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsInt,
  IsOptional,
  MaxLength,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CrearDocumentoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  descripcion: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_tipo: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return value;
  })
  restringido?: boolean;
}