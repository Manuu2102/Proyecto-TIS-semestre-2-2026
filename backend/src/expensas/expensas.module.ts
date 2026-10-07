import { Module } from '@nestjs/common';
import { ExpensasController } from './expensas.controller.js';
import { ExpensasCron } from './expensas.cron.js';
import { ExpensasService } from './expensas.service.js';

// Si tu PrismaModule no es global, impórtalo aquí:
// imports: [PrismaModule],
@Module({
  controllers: [ExpensasController],
  providers: [ExpensasService, ExpensasCron],
})
export class ExpensasModule {}