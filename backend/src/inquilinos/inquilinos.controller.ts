import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { InquilinosService } from './inquilinos.service.js';
import { CrearInquilinoDto } from './dto/crear-inquilino.dto.js';
import { ActualizarInquilinoDto } from './dto/actualizar-inquilino.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('inquilinos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InquilinosController {
  constructor(private inquilinosService: InquilinosService) {}

  @Post()
  @Roles('ADMINISTRADOR')
  crear(@Body() dto: CrearInquilinoDto, @CurrentUser('id') adminId: string) {
    return this.inquilinosService.crear(dto, adminId);
  }

  @Get()
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  listar() {
    return this.inquilinosService.listar();
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  buscarPorId(@Param('id') id: string) {
    return this.inquilinosService.buscarPorId(id);
  }

  @Patch(':id')
  @Roles('ADMINISTRADOR')
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarInquilinoDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.inquilinosService.actualizar(id, dto, adminId);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR')
  eliminar(@Param('id') id: string, @CurrentUser('id') adminId: string) {
    return this.inquilinosService.eliminar(id, adminId);
  }
}
