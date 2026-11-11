import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Body, 
  Param, 
  UseGuards, 
  ParseIntPipe 
} from '@nestjs/common';
import { PersonalService } from './personal.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearPersonalDto } from './dto/crear-personal.dto.js';
import { RegistrarPagoDto } from './dto/registrar-pago.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('personal')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PersonalController {
  constructor(
    private personalService: PersonalService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @Roles('ADMINISTRADOR')
  listar() {
    return this.personalService.listar();
  }

  @Post()
  @Roles('ADMINISTRADOR')
  crear(@Body() dto: CrearPersonalDto) {
    return this.personalService.crear(dto);
  }

  // 🚨 NUEVA RUTA: Actualizar empleado
  @Patch(':id')
  @Roles('ADMINISTRADOR')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any
  ) {
    return this.personalService.actualizar(BigInt(id), body);
  }

  @Get('pagos')
  @Roles('ADMINISTRADOR')
  listarPagos() {
    return this.prisma.pago_personal.findMany({
      include: {
        tipo_pago: true,
        personal: { 
          select: { 
            nombre: true, 
            apellido_paterno: true 
          } 
        }
      },
      orderBy: { id: 'desc' }
    });
  }

  @Post('pagos')
  @Roles('ADMINISTRADOR')
  registrarPago(@Body() dto: RegistrarPagoDto) {
    return this.personalService.registrarPago(dto);
  }

  @Post(':id/historial')
  @Roles('ADMINISTRADOR')
  registrarHistorial(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { fecha_inicio: string, fecha_fin?: string }
  ) {
    return this.personalService.registrarHistorial(BigInt(id), body);
  }
}