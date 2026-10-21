import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExpensasService } from './expensas.service.js';

@Injectable()
export class ExpensasCron {
  private readonly logger = new Logger(ExpensasCron.name);

  constructor(private readonly expensas: ExpensasService) {}

  // Corre todos los días: la mora puede ser diaria y el día de cobro es configurable.
  // Ambos pasos son idempotentes, así que repetirlos no duplica nada.
  @Cron('5 0 * * *', { name: 'mora-y-deudas', timeZone: 'America/La_Paz' })
  async ejecutarDiario() {
    try {
      const v = await this.expensas.aplicarVencimientos();
      this.logger.log(`Vencimientos: ${v.actualizadas} deudas actualizadas`);
    } catch (e) {
      this.logger.error(`Error aplicando vencimientos: ${e instanceof Error ? e.message : e}`);
    }

    try {
      // Desde el día de cobro: así, si el día cambia a uno que ya pasó, el mes no queda sin deudas
      if (!(await this.expensas.tocaGenerarDeudas())) return;
      const r = await this.expensas.generarDeudasMensuales();
      if (r.generadas > 0 || r.errores > 0) {
        this.logger.log(`${r.generadas} generadas, ${r.omitidas} ya existían, ${r.errores} con error`);
      }
    } catch (e) {
      this.logger.error(`Error generando deudas: ${e instanceof Error ? e.message : e}`);
    }
  }
}
