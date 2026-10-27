import { Module } from '@nestjs/common';
import { GastosController } from './gastos.controller.js';
import { GastosService } from './gastos.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { CajaModule } from '../caja/caja.module.js';

@Module({
  imports: [AuthModule, CajaModule],
  controllers: [GastosController],
  providers: [GastosService],
})
export class GastosModule {}