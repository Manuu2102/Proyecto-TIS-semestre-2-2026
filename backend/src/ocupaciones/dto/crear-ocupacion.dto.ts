import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class CrearOcupacionDto {
  @IsUUID()
  id_copropietario: string;

  @IsInt()
  @Min(1)
  id_departamento: number;

  @IsDateString()
  fecha_ocupacion: string;

  @IsOptional()
  @IsDateString()
  fecha_fin_ocupacion?: string;
}