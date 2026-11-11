import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const ESTADOS_PETICION = ['en_revision', 'aprobada', 'rechazada'] as const;

export class RechazarPeticionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  motivo!: string;
}

export class ListarPeticionesDto {
  @IsOptional()
  @IsIn(ESTADOS_PETICION)
  estado?: (typeof ESTADOS_PETICION)[number];
}
