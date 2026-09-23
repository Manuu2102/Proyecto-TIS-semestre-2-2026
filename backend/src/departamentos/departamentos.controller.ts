import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { DepartamentosService } from './departamentos.service.js';
import { CrearDepartamentoDto } from './dto/crear-departamento.dto.js';
import { ActualizarDepartamentoDto } from './dto/actualizar-departamento.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('departamentos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartamentosController {
  constructor(private departamentosService: DepartamentosService) {}

  @Post()
  @Roles('ADMINISTRADOR')
  crear(@Body() dto: CrearDepartamentoDto) {
    return this.departamentosService.crear(dto);
  }

  @Get()
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  listar() {
    return this.departamentosService.listar();
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.departamentosService.buscarPorId(BigInt(id));
  }

  @Patch(':id')
  @Roles('ADMINISTRADOR')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarDepartamentoDto,
  ) {
    return this.departamentosService.actualizar(BigInt(id), dto);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.departamentosService.eliminar(BigInt(id));
  }
}