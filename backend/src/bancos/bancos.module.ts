import { Module } from '@nestjs/common';
import { BancosController } from './bancos.controller.js';
import { BancosService } from './bancos.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [BancosController],
  providers: [BancosService],
  // Ingresos y gastos por transferencia o depósito registran su movimiento (HU-15, HU-16)
  exports: [BancosService],
})
export class BancosModule {}