import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { ExpensasCron } from './expensas.cron.js';
import { momentoLaPaz } from './hora-la-paz.js';
import {
  ahora,
  avanzarHora,
  desfaseActual,
  duracionMs,
  fijarHora,
  reiniciarHora,
  relojSimuladoActivo,
} from './reloj.js';

/**
 * Solo para pruebas: mueve la hora que usan las expensas y el cron de mora.
 * Si RELOJ_SIMULADO no es "true" en el .env, todas las rutas responden 404.
 */
@Controller('dev/reloj')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class RelojController {
  constructor(private readonly cron: ExpensasCron) {}

  /** Hora simulada y hora real, en La Paz. */
  @Get()
  ver() {
    this.exigirActivo();
    return this.estado();
  }

  /**
   * Fija la hora con { "fecha": "2026-12-15T10:00" } (hora de La Paz)
   * o la adelanta con { "avanzar": "3d" | "2h" | "30m" } (negativo para atrasar).
   * Después corre la revisión de moras y reprograma el cron.
   */
  @Post()
  async cambiar(@Body() body: { fecha?: string; avanzar?: string }) {
    this.exigirActivo();
    if (body?.fecha) {
      const instante = new Date(`${body.fecha}${/[zZ]|[+-]\d\d:\d\d$/.test(body.fecha) ? '' : '-04:00'}`);
      if (Number.isNaN(instante.getTime())) throw new BadRequestException('fecha inválida, use "YYYY-MM-DDTHH:mm"');
      fijarHora(instante);
    } else if (body?.avanzar) {
      const ms = duracionMs(body.avanzar);
      if (ms === null) throw new BadRequestException('avanzar inválido, use por ejemplo "3d", "2h" o "30m"');
      avanzarHora(ms);
    } else {
      throw new BadRequestException('Envíe "fecha" o "avanzar"');
    }
    return { ...this.estado(), revision: await this.cron.revisarAhora('cambio de reloj') };
  }

  /** Vuelve a la hora real y reprograma el cron. */
  @Delete()
  async reiniciar() {
    this.exigirActivo();
    reiniciarHora();
    return { ...this.estado(), revision: await this.cron.revisarAhora('reloj reiniciado') };
  }

  /** Corre la revisión de moras ahora mismo, con la hora simulada. */
  @Post('ejecutar')
  async ejecutar() {
    this.exigirActivo();
    return { ...this.estado(), revision: await this.cron.revisarAhora('manual') };
  }

  private exigirActivo() {
    if (!relojSimuladoActivo()) throw new NotFoundException();
  }

  private estado() {
    return {
      horaSimulada: momentoLaPaz(ahora()).replace('T', ' '),
      horaReal: momentoLaPaz(new Date()).replace('T', ' '),
      desfaseMinutos: Math.round(desfaseActual() / 60_000),
      // Para que el front haga correr el reloj por su cuenta
      instanteSimuladoMs: ahora().getTime(),
    };
  }
}
