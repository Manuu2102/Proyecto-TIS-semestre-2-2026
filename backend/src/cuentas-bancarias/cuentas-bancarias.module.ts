import { Module } from '@nestjs/common';
import { CuentasBancariasController } from './cuentas-bancarias.controller.js';
import { CuentasBancariasService } from './cuentas-bancarias.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [CuentasBancariasController],
  providers: [CuentasBancariasService],
})
export class CuentasBancariasModule {}