import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { DepartamentosService } from './departamentos.service.js';
import { CrearDepartamentoDto } from './dto/crear-departamento.dto.js';
import { ActualizarDepartamentoDto } from './dto/actualizar-departamento.dto.js';

@Controller('departamentos')
export class DepartamentosController {
  constructor(private departamentosService: DepartamentosService) {}

  @Post()
  crear(@Body() dto: CrearDepartamentoDto) {
    return this.departamentosService.crear(dto);
  }

  @Get()
  listar() {
    return this.departamentosService.listar();
  }

  @Get(':id')
  buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.departamentosService.buscarPorId(BigInt(id));
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarDepartamentoDto,
  ) {
    return this.departamentosService.actualizar(BigInt(id), dto);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.departamentosService.eliminar(BigInt(id));
  }
}