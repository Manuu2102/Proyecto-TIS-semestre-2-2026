import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsNumberString,
  IsOptional,
  IsIn,
  IsDateString,
  MinLength,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CrearCopropietarioDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsNumberString()
  @IsNotEmpty()
  ci: string;

  @IsString()
  @IsNotEmpty()
  nombres: string;

  @IsString()
  @IsNotEmpty()
  apellido_paterno: string;

  @IsOptional()
  @IsString()
  apellido_materno?: string;

  @IsIn(['M', 'F'])
  sexo: string;

  @IsDateString()
  fecha_de_nacimiento: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  telefono: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_departamento?: number;
}