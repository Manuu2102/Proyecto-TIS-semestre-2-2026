import { Module } from '@nestjs/common';
import { OcupacionesController } from './ocupaciones.controller.js';
import { OcupacionesService } from './ocupaciones.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [OcupacionesController],
  providers: [OcupacionesService],
})
export class OcupacionesModule {}