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

export class ActualizarInquilinoDto {
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

  // false = baja: se cierra su ocupación y se conserva el historial
  @IsOptional()
  @IsBoolean()
  estatus?: boolean;

  // Cambia el departamento (cierra la ocupación anterior)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_departamento?: number;

  // Corrige la fecha de inicio de la ocupación actual
  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;
}
