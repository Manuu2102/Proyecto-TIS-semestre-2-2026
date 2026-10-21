import { Module } from '@nestjs/common';
import { ExpensasController } from './expensas.controller.js';
import { ExpensasCron } from './expensas.cron.js';
import { ExpensasService } from './expensas.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [ExpensasController],
  providers: [ExpensasService, ExpensasCron],
})
export class ExpensasModule {}