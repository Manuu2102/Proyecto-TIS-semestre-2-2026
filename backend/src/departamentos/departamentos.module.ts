import { Module } from '@nestjs/common';
import { DepartamentosController } from './departamentos.controller.js';
import { DepartamentosService } from './departamentos.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [DepartamentosController],
  providers: [DepartamentosService],
})
export class DepartamentosModule {}