import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { OcupacionesService } from './ocupaciones.service.js';
import { CrearOcupacionDto } from './dto/crear-ocupacion.dto.js';

@Controller('ocupaciones')
export class OcupacionesController {
  constructor(private ocupacionesService: OcupacionesService) {}

  @Post()
  crear(@Body() dto: CrearOcupacionDto) {
    return this.ocupacionesService.crear(dto);
  }

  @Get('departamento/:id')
  historialPorDepartamento(@Param('id', ParseIntPipe) id: number) {
    return this.ocupacionesService.historialPorDepartamento(BigInt(id));
  }

  @Patch('cerrar/:idCopropietario/:idDepartamento')
  cerrar(
    @Param('idCopropietario', ParseIntPipe) idCopropietario: number,
    @Param('idDepartamento', ParseIntPipe) idDepartamento: number,
  ) {
    return this.ocupacionesService.cerrar(
      BigInt(idCopropietario),
      BigInt(idDepartamento),
    );
  }
}