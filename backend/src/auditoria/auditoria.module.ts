import { Module } from '@nestjs/common';
import { AuditoriaController } from './auditoria.controller.js';
import { AuditoriaService } from './auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [AuditoriaController],
  providers: [AuditoriaService, PrismaService],
})
export class AuditoriaModule {}