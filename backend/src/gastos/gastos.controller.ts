import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GastosService } from './gastos.service.js';
import { CrearGastoDto } from './dto/crear-gasto.dto.js';
import { ConsultarGastosDto } from './dto/consultar-gastos.dto.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('gastos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class GastosController {
  constructor(private readonly gastos: GastosService) {}

  @Post()
  @UseInterceptors(FileInterceptor('comprobante'))
  crear(
    @Body() dto: CrearGastoDto,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.gastos.crear(dto, archivo, idUsuario);
  }

  @Get()
  listar(@Query() filtros: ConsultarGastosDto) {
    return this.gastos.listar(filtros);
  }
}