import { Module } from '@nestjs/common';
import { ExpensasController } from './expensas.controller.js';
import { ExpensasService } from './expensas.service.js';
import { MoraService } from './mora.service.js';
import { MoraCron } from './mora.cron.js';

@Module({
  controllers: [ExpensasController],
  providers: [ExpensasService, MoraService, MoraCron],
})
export class ExpensasModule {}