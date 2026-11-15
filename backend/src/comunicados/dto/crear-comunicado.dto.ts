import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CrearComunicadoDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsString()
  @IsNotEmpty()
  contenido: string;

  @IsOptional()
  @IsString()
  tipo?: string; // Ej: 'Informativo', 'Urgente', 'Asamblea'
}