import { Module } from '@nestjs/common';
import { GastosController } from './gastos.controller.js';
import { GastosService } from './gastos.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [GastosController],
  providers: [GastosService],
})
export class GastosModule {}