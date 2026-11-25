import { BackupConfig } from '../interfaces/backup-config.interface.js';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { BackupExecutorService } from './backup-executor.service.js';
import { RespaldosService } from './respaldos.services.js';

@Injectable()
export class BackupSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BackupSchedulerService.name);
  private readonly nombreTarea = 'respaldo-automatico';

  private respaldoEnCurso = false;

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly respaldosService: RespaldosService,
    private readonly backupExecutorService: BackupExecutorService,
  ) {}

  /**
   * Carga la configuración persistida al iniciar el módulo.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.sincronizar();
    } catch (error) {
      this.logger.error(
        'No fue posible inicializar la programación de respaldos automáticos.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Detiene la tarea programada al apagar el módulo.
   */
  onModuleDestroy(): void {
    this.eliminarTareaExistente();
  }

  /**
   * Sincroniza la tarea cron con la configuración almacenada en Azure.
   *
   * Si los respaldos automáticos están desactivados, elimina
   * cualquier tarea existente.
   */
  async sincronizar(
  configuracionActualizada?: BackupConfig,
): Promise<void> {
  const configuracion =
    configuracionActualizada ??
    (await this.respaldosService.obtenerConfiguracion());

    this.eliminarTareaExistente();

    if (!configuracion.automatico) {
      this.logger.log(
        'Los respaldos automáticos están desactivados.',
      );
      return;
    }

    const [hora, minuto] = configuracion.hora
      .split(':')
      .map(Number);

    const expresionCron =
      configuracion.frecuencia === 'semanal'
        ? `${minuto} ${hora} * * 0`
        : `${minuto} ${hora} * * *`;

    const tarea = CronJob.from({
      cronTime: expresionCron,
      onTick: () => {
        void this.ejecutarRespaldoAutomatico();
      },
      start: false,
      timeZone: configuracion.zonaHoraria,
    });

    this.schedulerRegistry.addCronJob(
      this.nombreTarea,
      tarea,
    );

    tarea.start();

    this.logger.log(
      `Respaldo automático programado: frecuencia ${configuracion.frecuencia}, hora ${configuracion.hora}, zona horaria ${configuracion.zonaHoraria}.`,
    );
  }

  /**
 * Obtiene la fecha y hora de la próxima ejecución programada.
 *
 * Devuelve null si los respaldos automáticos están desactivados.
 */
async obtenerProximaEjecucion(): Promise<string | null> {
  const configuracion = await this.respaldosService.obtenerConfiguracion();

  if (!configuracion.automatico) {
    return null;
  }

  if (!this.schedulerRegistry.doesExist('cron', this.nombreTarea)) {
    throw new Error(
      'Los respaldos automáticos están habilitados, pero la tarea no está registrada.',
    );
  }

  const tarea = this.schedulerRegistry.getCronJob(this.nombreTarea);

  return tarea.nextDate().toISO();
}

  /**
   * Ejecuta el respaldo automático evitando ejecuciones simultáneas.
   */
  private async ejecutarRespaldoAutomatico(): Promise<void> {
    if (this.respaldoEnCurso) {
      this.logger.warn(
        'Se omitió una ejecución porque ya existe un respaldo en curso.',
      );
      return;
    }

    this.respaldoEnCurso = true;

    try {
      this.logger.log(
        'Iniciando ejecución programada del respaldo automático.',
      );

      await this.backupExecutorService.generarRespaldo(
        'automatico',
        null,
      );

      this.logger.log(
        'El respaldo automático finalizó correctamente.',
      );
    } catch (error) {
      this.logger.error(
        'Falló la ejecución programada del respaldo automático.',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.respaldoEnCurso = false;
    }
  }

  /**
   * Detiene y elimina la tarea cron anterior, si existe.
   */
  private eliminarTareaExistente(): void {
    if (
      !this.schedulerRegistry.doesExist(
        'cron',
        this.nombreTarea,
      )
    ) {
      return;
    }

    const tarea = this.schedulerRegistry.getCronJob(
      this.nombreTarea,
    );

    tarea.stop();

    this.schedulerRegistry.deleteCronJob(
      this.nombreTarea,
    );

    this.logger.log(
      'Se eliminó la programación anterior del respaldo automático.',
    );
  }
}