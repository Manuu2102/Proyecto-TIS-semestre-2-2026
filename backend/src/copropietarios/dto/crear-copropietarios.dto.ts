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
  // Se ignora: la contraseña inicial siempre es el CI. Se deja para no romper clientes anteriores.
  @IsOptional()
  @IsString()
  password?: string;

  // También es la contraseña inicial: Supabase y el login piden al menos 6 caracteres
  @IsNumberString()
  @IsNotEmpty()
  @MinLength(6, { message: 'El CI debe tener al menos 6 dígitos (se usa como contraseña inicial)' })
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