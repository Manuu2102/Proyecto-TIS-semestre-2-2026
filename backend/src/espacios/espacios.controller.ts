import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  ParseEnumPipe,
  UseGuards,
} from '@nestjs/common';
import { EspaciosService } from './espacios.service.js';
import type { TipoEspacio } from './espacios.service.js';
import { CrearEspacioDto } from './dto/crear-espacio.dto.js';
import { ActualizarEspacioDto } from './dto/actualizar-espacio.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

// /espacios/parqueos/... y /espacios/bauleras/...
const tipoPipe = new ParseEnumPipe({ parqueos: 'parqueos', bauleras: 'bauleras' });

@Controller('espacios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EspaciosController {
  constructor(private espaciosService: EspaciosService) {}

  /** Parqueos y bauleras juntos, con el departamento asignado. */
  @Get()
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  listar() {
    return this.espaciosService.listar();
  }

  @Post(':tipo')
  @Roles('ADMINISTRADOR')
  crear(
    @Param('tipo', tipoPipe) tipo: TipoEspacio,
    @Body() dto: CrearEspacioDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.espaciosService.crear(tipo, dto, adminId);
  }

  @Patch(':tipo/:id')
  @Roles('ADMINISTRADOR')
  actualizar(
    @Param('tipo', tipoPipe) tipo: TipoEspacio,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEspacioDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.espaciosService.actualizar(tipo, BigInt(id), dto, adminId);
  }

  @Delete(':tipo/:id')
  @Roles('ADMINISTRADOR')
  eliminar(
    @Param('tipo', tipoPipe) tipo: TipoEspacio,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: string,
  ) {
    return this.espaciosService.eliminar(tipo, BigInt(id), adminId);
  }
}
