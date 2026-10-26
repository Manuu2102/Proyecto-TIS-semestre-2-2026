import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BancosService } from './bancos.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('bancos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class BancosController {
  constructor(private readonly bancos: BancosService) {}

  @Get('movimientos')
  listar(@Query('cuentaId') cuentaId?: string) {
    return this.bancos.listarMovimientos(cuentaId ? BigInt(cuentaId) : undefined);
  }

  @Post('movimientos')
  crear(@Body() dto: Record<string, unknown>, @CurrentUser('id') idUsuario: string) {
    return this.bancos.crearMovimiento(dto, idUsuario);
  }

  @Post('movimientos/:numero/anular')
  anular(
    @Param('numero') numero: string,
    @Body() dto: { motivo?: string; motivo_anulacion?: string },
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.bancos.anularMovimiento(numero, dto.motivo ?? dto.motivo_anulacion, idUsuario);
  }

  @Post('movimientos/:numero/conciliar')
  conciliar(@Param('numero') numero: string) {
    return this.bancos.conciliarMovimiento(numero);
  }
}