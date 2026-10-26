import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuditoriaModule } from './auditoria/auditoria.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { DepartamentosModule } from './departamentos/departamentos.module.js';
import { OcupacionesModule } from './ocupaciones/ocupaciones.module.js';
import { CopropietariosModule } from './copropietarios/copropietarios.module.js';
import { InquilinosModule } from './inquilinos/inquilinos.module.js';
import { EspaciosModule } from './espacios/espacios.module.js';
import { ReportesModule } from './reportes/reportes.module.js';
import { DocumentosModule } from './Documentos/documentos.module.js';
import { ExpensasModule } from './expensas/expensas.module.js';
import { CategoriasModule } from './categorias/categorias.module.js';
import { IngresosModule } from './ingresos/ingresos.module.js';
import { GastosModule } from './gastos/gastos.module.js';
import { CuentasBancariasModule } from './cuentas-bancarias/cuentas-bancarias.module.js';
import { CajaModule } from './caja/caja.module.js';
import { BancosModule } from './bancos/bancos.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    PrismaModule,
    UsuariosModule,
    DepartamentosModule,
    OcupacionesModule,
    CopropietariosModule,
    InquilinosModule,
    EspaciosModule,
    ReportesModule,
    AuditoriaModule,
    DocumentosModule,
    ExpensasModule,
    CategoriasModule,
    IngresosModule,
    GastosModule,
    CuentasBancariasModule,
    CajaModule,
    ScheduleModule.forRoot(),
    BancosModule
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}