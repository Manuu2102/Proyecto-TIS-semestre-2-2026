import { Module } from '@nestjs/common';
import { DepartamentosController } from './departamentos.controller.js';
import { DepartamentosService } from './departamentos.service.js';

@Module({
  controllers: [DepartamentosController],
  providers: [DepartamentosService],
})
export class DepartamentosModule {}