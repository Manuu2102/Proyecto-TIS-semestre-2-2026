import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js'; // <-- Deja el DTO, que es útil
import { CambiarContrasenaDto, SolicitarCodigoDto } from './dto/cambiar-contrasena.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';
import { Roles } from './roles.decorator.js';
import { CurrentUser } from './current-user.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  /** Paso 1: comprueba la contraseña actual y envía un código al correo: { actual }. */
  @Post('cambiar-contrasena/codigo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COPROPIETARIO')
  solicitarCodigo(@Body() dto: SolicitarCodigoDto, @CurrentUser('id') idUsuario: string) {
    return this.authService.solicitarCodigoContrasena(idUsuario, dto.actual);
  }

  /** Paso 2: cambia la contraseña con el código recibido por correo: { codigo, nueva }. */
  @Post('cambiar-contrasena')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COPROPIETARIO')
  cambiarContrasena(@Body() dto: CambiarContrasenaDto, @CurrentUser('id') idUsuario: string) {
    return this.authService.cambiarContrasena(idUsuario, dto.codigo, dto.nueva);
  }
}