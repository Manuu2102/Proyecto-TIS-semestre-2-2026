import { BackupSchedulerService } from './services/backup-scheduler.service.js';
import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  ServiceUnavailableException,
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
    private readonly backupSchedulerService: BackupSchedulerService,
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
      const configuracion =
        await this.respaldosService.actualizarConfiguracion(
          dto,
          idAdministrador,
       );

      try {
         await this.backupSchedulerService.sincronizar(configuracion);
      } catch {
        throw new ServiceUnavailableException(
          'La configuración se guardó, pero no fue posible actualizar la programación de respaldos. Se requiere verificar el scheduler.',
        );
      }
   return configuracion;
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