import { Module } from '@nestjs/common';
import { OcupacionesController } from './ocupaciones.controller.js';
import { OcupacionesService } from './ocupaciones.service.js';

@Module({
  controllers: [OcupacionesController],
  providers: [OcupacionesService],
})
export class OcupacionesModule {}