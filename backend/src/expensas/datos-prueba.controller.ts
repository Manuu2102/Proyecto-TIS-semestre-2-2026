import { BadRequestException, Body, Controller, Delete, NotFoundException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { relojSimuladoActivo } from './reloj.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { usuarioEnTransaccion } from '../lib/auditoria.js';

/**
 * Solo para pruebas: borra las deudas, pagos, peticiones de pago y movimientos de fondos de expensas.
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
  async borrar(@Body() body: { confirmar?: string }, @CurrentUser('id') idUsuario: string) {
    if (!relojSimuladoActivo()) throw new NotFoundException();
    if (body?.confirmar !== 'BORRAR') {
      throw new BadRequestException('Envíe { "confirmar": "BORRAR" } para borrar los datos');
    }

    // El orden respeta las claves foráneas
    // maxWait alto: con el pooler de Supabase lleno, espera una conexión libre en vez de fallar (P2028)
    const [movimientos, facturas, extras, peticiones, deudas] = await this.prisma.$transaction(
      async (tx) => [
        // Los triggers de auditoría registran cada fila borrada con este usuario
        await usuarioEnTransaccion(tx, idUsuario).then(() => tx.movimiento_fondo.deleteMany()),
        await tx.factura_pago_expensa.deleteMany(),
        await tx.pago_expensa_extra.deleteMany(),
        // peticion_pago apunta a pago_expensa: hay que borrarla antes que las deudas
        await tx.peticion_pago.deleteMany(),
        await tx.pago_expensa.deleteMany(),
      ],
      { maxWait: 15000, timeout: 30000 },
    );

    return {
      movimiento_fondo: movimientos.count,
      factura_pago_expensa: facturas.count,
      pago_expensa_extra: extras.count,
      peticion_pago: peticiones.count,
      pago_expensa: deudas.count,
    };
  }
}
