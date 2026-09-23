import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { OcupacionesService } from './ocupaciones.service.js';
import { CrearOcupacionDto } from './dto/crear-ocupacion.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('ocupaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OcupacionesController {
  constructor(private ocupacionesService: OcupacionesService) {}

  @Post()
  @Roles('ADMINISTRADOR')
  crear(@Body() dto: CrearOcupacionDto) {
    return this.ocupacionesService.crear(dto);
  }

  @Get('departamento/:id')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  historialPorDepartamento(@Param('id', ParseIntPipe) id: number) {
    return this.ocupacionesService.historialPorDepartamento(BigInt(id));
  }

  @Patch('cerrar/:idCopropietario/:idDepartamento')
  @Roles('ADMINISTRADOR')
  cerrar(
    @Param('idCopropietario') idCopropietario: string,
    @Param('idDepartamento', ParseIntPipe) idDepartamento: number,
  ) {
    return this.ocupacionesService.cerrar(
      idCopropietario,
      BigInt(idDepartamento),
    );
  }
}