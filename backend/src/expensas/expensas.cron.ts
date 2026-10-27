import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExpensasService } from './expensas.service.js';

@Injectable()
export class ExpensasCron {
  private readonly logger = new Logger(ExpensasCron.name);

  constructor(private readonly expensas: ExpensasService) {}

  // Corre todos los días y solo revisa moras: la mora puede ser diaria. Es idempotente.
  // Las expensas no se generan aquí: el administrador las genera a mano desde el front.
  @Cron('5 0 * * *', { name: 'mora', timeZone: 'America/La_Paz' })
  async ejecutarDiario() {
    try {
      const v = await this.expensas.aplicarVencimientos();
      this.logger.log(`Vencimientos: ${v.actualizadas} deudas actualizadas`);
    } catch (e) {
      this.logger.error(`Error aplicando vencimientos: ${e instanceof Error ? e.message : e}`);
    }
  }
}
