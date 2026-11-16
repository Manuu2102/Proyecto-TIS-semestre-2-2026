import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const CARGOS_COMUNICADO = ['Copropietario', 'Inquilino', 'Personal'] as const;

/** A quién se envía el correo (lo mismo que se elige en la pantalla). */
export class DestinatariosComunicadoDto {
  @IsIn(['todos', 'cargo', 'especificas'])
  modo: 'todos' | 'cargo' | 'especificas';

  @IsOptional()
  @IsArray()
  @IsIn(CARGOS_COMUNICADO, { each: true })
  cargos?: (typeof CARGOS_COMUNICADO)[number][];

  // ids (uuid) de los usuarios elegidos uno por uno
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  personas?: string[];
}

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

  // Si es true, se envía por correo a los destinatarios (copropietarios e inquilinos activos)
  @IsOptional()
  @IsBoolean()
  enviar_correo?: boolean;

  // Asunto del correo; si no llega se usa el título
  @IsOptional()
  @IsString()
  @MaxLength(255)
  asunto?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DestinatariosComunicadoDto)
  destinatarios?: DestinatariosComunicadoDto;
}
