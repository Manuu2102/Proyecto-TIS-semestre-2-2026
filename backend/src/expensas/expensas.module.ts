import { Module } from '@nestjs/common';
import { ExpensasController } from './expensas.controller.js';
import { ExpensasCron } from './expensas.cron.js';
import { RelojController } from './reloj.controller.js';
import { DatosPruebaController } from './datos-prueba.controller.js';
import { ExpensasService } from './expensas.service.js';
import { ExpensasExportarService } from './expensas-exportar.service.js';
import { PeticionesController } from './peticiones.controller.js';
import { PeticionesService } from './peticiones.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [ExpensasController, PeticionesController, RelojController, DatosPruebaController],
  providers: [ExpensasService, ExpensasCron, ExpensasExportarService, PeticionesService],
})
export class ExpensasModule {}