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
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  restringido?: boolean;
}