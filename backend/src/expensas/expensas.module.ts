import { Module } from '@nestjs/common';
import { ExpensasController } from './expensas.controller.js';
import { ExpensasService } from './expensas.service.js';

@Module({
  controllers: [ExpensasController],
  providers: [ExpensasService],
})
export class ExpensasModule {}
