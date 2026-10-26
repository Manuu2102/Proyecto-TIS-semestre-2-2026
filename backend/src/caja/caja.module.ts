import { Module } from '@nestjs/common';
import { CajaController } from './caja.controller.js';
import { CajaService } from './caja.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [CajaController],
  providers: [CajaService],
  // Ingresos y gastos en efectivo registran su movimiento de caja (HU-20 #10)
  exports: [CajaService],
})
export class CajaModule {}
