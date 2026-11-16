import { IsString, MaxLength, MinLength } from 'class-validator';

export class CambiarContrasenaDto {
  @IsString()
  @MinLength(1, { message: 'Escribe tu contraseña actual' })
  actual: string;

  // Mismo mínimo que pide el login
  @IsString()
  @MinLength(6, { message: 'La nueva contraseña debe tener al menos 6 caracteres' })
  @MaxLength(72, { message: 'La nueva contraseña no puede tener más de 72 caracteres' })
  nueva: string;
}
