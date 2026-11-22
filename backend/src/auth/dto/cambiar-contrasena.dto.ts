import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Paso 1: se comprueba la contraseña actual y se envía un código al correo. */
export class SolicitarCodigoDto {
  @IsString()
  @MinLength(1, { message: 'Escribe tu contraseña actual' })
  actual: string;
}

/** Paso 2: con el código recibido por correo se guarda la nueva contraseña. */
export class CambiarContrasenaDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código debe tener 6 dígitos' })
  codigo: string;

  // Mismo mínimo que pide el login
  @IsString()
  @MinLength(6, { message: 'La nueva contraseña debe tener al menos 6 caracteres' })
  @MaxLength(72, { message: 'La nueva contraseña no puede tener más de 72 caracteres' })
  nueva: string;
}
