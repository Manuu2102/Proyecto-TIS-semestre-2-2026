import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class AnularIngresoDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(255)
  motivo_anulacion: string;
}