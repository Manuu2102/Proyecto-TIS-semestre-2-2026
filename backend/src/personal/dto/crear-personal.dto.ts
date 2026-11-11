import { 
  IsString, 
  IsEmail, 
  IsNumber, 
  IsNotEmpty, 
  Min, 
  IsDateString, 
  IsOptional,
  IsIn
} from 'class-validator';

export class CrearPersonalDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  apellido_paterno: string;

  @IsString()
  @IsOptional()
  apellido_materno?: string;

  @IsString()
  @IsNotEmpty()
  cargo: string;

  @IsString()
  @IsNotEmpty()
  ci: string;

  @IsString()
  @IsNotEmpty()
  telefono: string;

  @IsEmail()
  email: string;

  @IsNumber()
  @Min(0)
  sueldo: number; // <-- AQUÍ ESTÁ SUELDO

  @IsDateString()
  fecha_inicio: string;

  @IsDateString()
  fecha_nacimiento: string;

  @IsString()
  @IsIn(['M', 'F']) 
  sexo: string;
}