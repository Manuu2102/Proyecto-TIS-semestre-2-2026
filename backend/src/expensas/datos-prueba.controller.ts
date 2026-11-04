import { BadRequestException, Body, Controller, Delete, NotFoundException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { relojSimuladoActivo } from './reloj.js';

/**
 * Solo para pruebas: borra las deudas, pagos y movimientos de fondos de expensas.
 * Usa el mismo interruptor que el reloj (RELOJ_SIMULADO=true); si no está activo responde 404.
 * No borra expensas, tarifas, departamentos ni la regla de mora.
 */
@Controller('dev/expensas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class DatosPruebaController {
  constructor(private readonly prisma: PrismaService) {}

  /** Requiere { "confirmar": "BORRAR" } para evitar borrados por accidente. */
  @Delete('datos')
  async borrar(@Body() body: { confirmar?: string }) {
    if (!relojSimuladoActivo()) throw new NotFoundException();
    if (body?.confirmar !== 'BORRAR') {
      throw new BadRequestException('Envíe { "confirmar": "BORRAR" } para borrar los datos');
    }

    // El orden respeta las claves foráneas
    const [movimientos, facturas, extras, deudas] = await this.prisma.$transaction([
      this.prisma.movimiento_fondo.deleteMany(),
      this.prisma.factura_pago_expensa.deleteMany(),
      this.prisma.pago_expensa_extra.deleteMany(),
      this.prisma.pago_expensa.deleteMany(),
    ]);

    return {
      movimiento_fondo: movimientos.count,
      factura_pago_expensa: facturas.count,
      pago_expensa_extra: extras.count,
      pago_expensa: deudas.count,
    };
  }
}
