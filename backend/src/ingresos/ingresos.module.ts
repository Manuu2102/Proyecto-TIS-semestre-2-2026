import { Module } from '@nestjs/common';
import { IngresosController } from './ingresos.controller.js';
import { IngresosService } from './ingresos.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { CajaModule } from '../caja/caja.module.js';
import { BancosModule } from '../bancos/bancos.module.js';

@Module({
  imports: [AuthModule, CajaModule, BancosModule],
  controllers: [IngresosController],
  providers: [IngresosService],
})
export class IngresosModule {}