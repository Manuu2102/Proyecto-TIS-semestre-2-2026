import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'; // <-- IMPORT AGREGADO
import { APP_GUARD } from '@nestjs/core'; // <-- IMPORT AGREGADO
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
import { CajaModule } from './caja/caja.module.js';
import { RolesModule } from './roles/roles.module.js';
import { PersonalModule } from './personal/personal.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // 🚨 CONFIGURACIÓN DEL RATE LIMITING
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minuto
      limit: 100, // Límite global de 100 peticiones por minuto por IP
    }]),
    
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
    CajaModule,
    RolesModule,
    PersonalModule,
    ScheduleModule.forRoot(),
  ],

  controllers: [AppController],
  providers: [
    AppService,
    {
      // Aplicamos el Guard del límite a TODA la aplicación
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}