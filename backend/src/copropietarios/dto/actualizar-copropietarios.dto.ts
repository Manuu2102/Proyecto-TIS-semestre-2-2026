import {
  IsString,
  IsEmail,
  IsOptional,
  IsIn,
  IsDateString,
  IsNumberString,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ActualizarCopropietarioDto {
  @IsOptional()
  @IsNumberString()
  ci?: string;

  @IsOptional()
  @IsString()
  nombres?: string;

  @IsOptional()
  @IsString()
  apellido_paterno?: string;

  @IsOptional()
  @IsString()
  apellido_materno?: string;

  @IsOptional()
  @IsIn(['M', 'F'])
  sexo?: string;

  @IsOptional()
  @IsDateString()
  fecha_de_nacimiento?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsBoolean()
  estatus?: boolean;

  // Cambia el departamento asignado (cierra la ocupación anterior)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_departamento?: number;
}
