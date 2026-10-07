import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExpensasService } from './expensas.service.js';

@Injectable()
export class ExpensasCron {
  private readonly logger = new Logger(ExpensasCron.name);

  constructor(private readonly expensas: ExpensasService) {}

  // Día 1 de cada mes a las 00:00, hora de Bolivia
  @Cron('0 0 1 * *', { name: 'deudas-mensuales', timeZone: 'America/La_Paz' })
  async generarDeudasMensuales() {
    this.logger.log('Generando deudas mensuales...');
    const r = await this.expensas.generarDeudasMensuales();
    this.logger.log(
      `Listo: ${r.generadas} generadas, ${r.omitidas} ya existían, ${r.errores} con error`,
    );
  }
}
