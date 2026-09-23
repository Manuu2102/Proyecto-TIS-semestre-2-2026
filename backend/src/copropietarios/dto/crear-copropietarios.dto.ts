import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsNumberString,
  IsOptional,
  IsIn,
  IsDateString,
  MinLength,
} from 'class-validator';

export class CrearCopropietarioDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

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

  @IsString()
  @IsIn(['M', 'F'])
  sexo: string;

  @IsDateString()
  fecha_de_nacimiento: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  telefono: string;
}