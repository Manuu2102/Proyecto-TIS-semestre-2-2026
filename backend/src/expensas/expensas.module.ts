import { Module } from '@nestjs/common';
import { ExpensasController } from './expensas.controller.js';
import { ExpensasCron } from './expensas.cron.js';
import { ExpensasService } from './expensas.service.js';


@Module({
  controllers: [ExpensasController],
  providers: [ExpensasService, ExpensasCron],
})
export class ExpensasModule {}