import { IsObject } from 'class-validator';

export class ActualizarPermisosDto {
  @IsObject()
  matrix: Record<string, string[]>; // Ej: { "Administrador": ["Documentos", "Finanzas"] }
}