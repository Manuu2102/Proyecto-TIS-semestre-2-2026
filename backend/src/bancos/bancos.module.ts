import { Module } from '@nestjs/common';
import { BancosController } from './bancos.controller.js';
import { BancosService } from './bancos.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [BancosController],
  providers: [BancosService],
})
export class BancosModule {}