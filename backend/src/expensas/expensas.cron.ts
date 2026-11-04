import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExpensasService } from './expensas.service.js';
import { momentoLaPaz, proximaHoraLaPaz } from './hora-la-paz.js';
import { ahora } from './reloj.js';

/**
 * Revisión de moras (aplicarVencimientos). Es idempotente, así que correr de más no duplica nada:
 *  - al encender el backend, para recuperar lo que pasó mientras estuvo apagado
 *  - todos los días a la hora de la regla de mora (se reprograma al cambiarla)
 *  - todos los días a las 00:05, como respaldo para las deudas creadas con otra hora
 * Las expensas no se generan aquí: el administrador las genera a mano desde el front.
 */
@Injectable()
export class ExpensasCron implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ExpensasCron.name);
  private siguiente?: NodeJS.Timeout;
  private horaRegla?: string;

  constructor(private readonly expensas: ExpensasService) {}

  // Sin await: el backend arranca sin esperar a la base
  onApplicationBootstrap() {
    void this.iniciar();
  }

  onModuleDestroy() {
    clearTimeout(this.siguiente);
  }

  private async iniciar() {
    await this.ejecutar('al arrancar');
    try {
      this.programar((await this.expensas.obtenerReglaMora()).hora);
    } catch (e) {
      this.logger.error(`No se pudo leer la hora de la regla de mora: ${e instanceof Error ? e.message : e}`);
    }
  }

  @Cron('5 0 * * *', { name: 'mora-respaldo', timeZone: 'America/La_Paz' })
  async respaldoDiario() {
    await this.ejecutar('respaldo 00:05');
  }

  /** Programa la revisión diaria a la hora "HH:mm" de La Paz. Reemplaza la anterior. */
  programar(hora: string) {
    clearTimeout(this.siguiente);
    this.horaRegla = hora;
    const proxima = proximaHoraLaPaz(hora, ahora());
    this.siguiente = setTimeout(async () => {
      await this.ejecutar(`regla ${hora}`);
      this.programar(hora);
    }, proxima.getTime() - ahora().getTime());
    this.logger.log(`Próxima revisión de moras: ${momentoLaPaz(proxima).replace('T', ' ')} (hora de La Paz)`);
  }

  /**
   * Para el reloj simulado: corre la revisión con la hora actual (simulada)
   * y reprograma la revisión diaria a partir de esa hora.
   */
  async revisarAhora(motivo: string) {
    const v = await this.expensas.aplicarVencimientos();
    this.logger.log(`Vencimientos (${motivo}): ${v.actualizadas} deudas actualizadas`);
    if (this.horaRegla) this.programar(this.horaRegla);
    return v;
  }

  private async ejecutar(motivo: string) {
    try {
      const v = await this.expensas.aplicarVencimientos();
      this.logger.log(`Vencimientos (${motivo}): ${v.actualizadas} deudas actualizadas`);
    } catch (e) {
      this.logger.error(`Error aplicando vencimientos (${motivo}): ${e instanceof Error ? e.message : e}`);
    }
  }
}
