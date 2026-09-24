import { Module } from '@nestjs/common';
import { DocumentosController } from './documentos.controller.js';
import { DocumentosService } from './documentos.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [DocumentosController],
  providers: [DocumentosService],
})
export class DocumentosModule {}