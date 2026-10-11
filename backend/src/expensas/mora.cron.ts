import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MoraService } from './mora.service.js';

@Injectable()
export class MoraCron {
  private readonly logger = new Logger(MoraCron.name);

  constructor(private readonly moraService: MoraService) {}

  /**
   * Corre el día 1 de cada mes a las 00:00 (hora Bolivia).
   * Aplica mora a todas las deudas vencidas.
   */
  @Cron('0 0 1 * *', {
    name: 'aplicar-mora-mensual',
    timeZone: 'America/La_Paz',
  })
  async aplicarMoraMensual() {
    this.logger.log('Iniciando cron de mora mensual...');
    try {
      const resultado = await this.moraService.aplicarMoraMensual();
      this.logger.log(`Cron de mora completado: ${JSON.stringify(resultado)}`);
    } catch (error) {
      this.logger.error(`Error en cron de mora: ${error}`);
    }
  }
}