import { Module } from '@nestjs/common';
import { InquilinosController } from './inquilinos.controller.js';
import { InquilinosService } from './inquilinos.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [InquilinosController],
  providers: [InquilinosService],
})
export class InquilinosModule {}
