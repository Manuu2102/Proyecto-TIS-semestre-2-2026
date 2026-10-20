import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CajaService } from './caja.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('caja')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class CajaController {
  constructor(private readonly caja: CajaService) {}

  @Get()
  getCaja() {
    return this.caja.obtenerCaja();
  }

  @Post('apertura')
  abrir(@Body() dto: { monto: number; fecha: string }) {
    return this.caja.abrirCaja(dto);
  }

  @Get('movimientos')
  listar() {
    return this.caja.listarMovimientos();
  }

  @Post('movimientos')
  crear(@Body() dto: any, @CurrentUser('id') idUsuario: string) {
    return this.caja.crearMovimiento(dto, idUsuario);
  }

  @Post('movimientos/:numero/anular')
  anular(
    @Param('numero') numero: string,
    @Body() dto: { motivo: string },
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.caja.anularMovimiento(numero, dto.motivo, idUsuario);
  }
}