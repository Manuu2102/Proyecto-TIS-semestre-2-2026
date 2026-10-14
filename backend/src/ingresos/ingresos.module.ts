import { Module } from '@nestjs/common';
import { IngresosController } from './ingresos.controller.js';
import { IngresosService } from './ingresos.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [IngresosController],
  providers: [IngresosService],
})
export class IngresosModule {}