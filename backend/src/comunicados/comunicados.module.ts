import { Module } from '@nestjs/common';
import { ComunicadosController } from './comunicados.controller.js';
import { ComunicadosService } from './comunicados.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ComunicadosController],
  providers: [ComunicadosService],
})
export class ComunicadosModule {}