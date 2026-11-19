import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { RespaldosService } from './services/respaldos.services.js';
import { BackupExecutorService } from './services/backup-executor.service.js';
import { ActualizarConfiguracionDto } from './dto/actualizar-configuracion.dto.js';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('respaldos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class RespaldosController {
  constructor(
    private readonly respaldosService: RespaldosService,
    private readonly backupExecutorService: BackupExecutorService,
  ) {}

  /**
   * Consulta la configuración actual de los respaldos automáticos.
   */
  @Get('configuracion')
  async obtenerConfiguracion() {
    return this.respaldosService.obtenerConfiguracion();
  }

  /**
   * Actualiza la configuración de los respaldos automáticos.
   *
   * El identificador del administrador se obtiene del JWT.
   */
  @Patch('configuracion')
  async actualizarConfiguracion(
    @Body() dto: ActualizarConfiguracionDto,
    @CurrentUser('id') idAdministrador: string,
  ) {
    return this.respaldosService.actualizarConfiguracion(
      dto,
      idAdministrador,
    );
  }

  /**
   * Genera un respaldo manual de la base de datos.
   *
   * El identificador del administrador se obtiene del JWT.
   */
  @Post('manual')
  async generarRespaldoManual(
    @CurrentUser('id') idAdministrador: string,
  ) {
    return this.backupExecutorService.generarRespaldo(
      'manual',
      idAdministrador,
    );
  }
}