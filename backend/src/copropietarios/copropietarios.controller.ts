import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CopropietariosService } from './copropietarios.service.js';
import { CrearCopropietarioDto } from './dto/crear-copropietarios.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('copropietarios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CopropietariosController {
  constructor(private copropietariosService: CopropietariosService) {}

  @Post()
  @Roles('ADMINISTRADOR')
  crear(@Body() dto: CrearCopropietarioDto) {
    return this.copropietariosService.crear(dto);
  }

  @Get()
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  listar() {
    return this.copropietariosService.listar();
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  buscarPorId(@Param('id') id: string) {
    return this.copropietariosService.buscarPorId(id);
  }
}