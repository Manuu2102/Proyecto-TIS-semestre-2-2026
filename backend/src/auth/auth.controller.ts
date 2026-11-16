import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js'; // <-- Deja el DTO, que es útil
import { CambiarContrasenaDto } from './dto/cambiar-contrasena.dto.js';
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

  /** El copropietario cambia su contraseña: { actual, nueva }. */
  @Post('cambiar-contrasena')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COPROPIETARIO')
  cambiarContrasena(@Body() dto: CambiarContrasenaDto, @CurrentUser('id') idUsuario: string) {
    return this.authService.cambiarContrasena(idUsuario, dto.actual, dto.nueva);
  }
}