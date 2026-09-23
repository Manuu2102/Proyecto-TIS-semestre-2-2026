import { Module } from '@nestjs/common';
import { CopropietariosController } from './copropietarios.controller.js';
import { CopropietariosService } from './copropietarios.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [CopropietariosController],
  providers: [CopropietariosService],
})
export class CopropietariosModule {}