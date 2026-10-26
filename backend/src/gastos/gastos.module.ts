import { Module } from '@nestjs/common';
import { GastosController } from './gastos.controller.js';
import { GastosService } from './gastos.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { CajaModule } from '../caja/caja.module.js';
import { BancosModule } from '../bancos/bancos.module.js';

@Module({
  imports: [AuthModule, CajaModule, BancosModule],
  controllers: [GastosController],
  providers: [GastosService],
})
export class GastosModule {}