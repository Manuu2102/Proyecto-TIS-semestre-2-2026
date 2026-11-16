import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Body, 
  Param, 
  UseGuards,
  ParseIntPipe,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PersonalService } from './personal.service.js';
import { CrearPersonalDto } from './dto/crear-personal.dto.js';
import { RegistrarPagoDto } from './dto/registrar-pago.dto.js';
import { ConsultarPagosDto } from './dto/consultar-pagos.dto.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('personal')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PersonalController {
  constructor(private personalService: PersonalService) {}

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

  /** ?id_personal=&tipo=Sueldo|Anticipo&desde=&hasta= */
  @Get('pagos')
  @Roles('ADMINISTRADOR')
  listarPagos(@Query() filtros: ConsultarPagosDto) {
    return this.personalService.listarPagos(filtros);
  }

  /** multipart/form-data: id_personal, tipo_pago, monto, fecha, metodo, referencia?, comprobante (archivo) */
  @Post('pagos')
  @Roles('ADMINISTRADOR')
  @UseInterceptors(FileInterceptor('comprobante'))
  registrarPago(
    @Body() dto: RegistrarPagoDto,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.personalService.registrarPago(dto, archivo, idUsuario);
  }

  @Get('pagos/:id/comprobante')
  @Roles('ADMINISTRADOR')
  async comprobante(@Param('id', ParseIntPipe) id: number) {
    const archivo = await this.personalService.obtenerComprobante(BigInt(id));
    return new StreamableFile(archivo.contenido, {
      type: archivo.tipo,
      disposition: `inline; filename="${encodeURIComponent(archivo.nombre)}"`,
    });
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