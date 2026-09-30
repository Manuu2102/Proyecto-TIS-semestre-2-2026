import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsInt,
  IsOptional,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  restringido?: boolean;
}