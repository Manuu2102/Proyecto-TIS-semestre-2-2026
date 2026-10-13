import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IngresosService } from './ingresos.service.js';
import { CrearIngresoDto } from './dto/crear-ingreso.dto.js';
import { ConsultarIngresosDto } from './dto/consultar-ingresos.dto.js';
import { AnularIngresoDto } from './dto/anular-ingreso.dto.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('ingresos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class IngresosController {
  constructor(private readonly ingresos: IngresosService) {}

  @Post()
  @UseInterceptors(FileInterceptor('comprobante'))
  crear(
    @Body() dto: CrearIngresoDto,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.ingresos.crear(dto, archivo, idUsuario);
  }

  @Get()
  listar(@Query() filtros: ConsultarIngresosDto) {
    return this.ingresos.listar(filtros);
  }

  @Post(':id/anular')
  anular(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnularIngresoDto,
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.ingresos.anular(BigInt(id), dto, idUsuario);
  }
}