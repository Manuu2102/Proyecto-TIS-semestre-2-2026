import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CategoriasService } from './categorias.service.js';
import { CrearCategoriaDto } from './dto/crear-categoria.dto.js';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto.js';
import { ConsultarCategoriasDto } from './dto/consultar-categorias.dto.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('categorias')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class CategoriasController {
  constructor(private readonly categorias: CategoriasService) {}

  @Post()
  crear(
    @Body() dto: CrearCategoriaDto,
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.categorias.crear(dto, idUsuario);
  }

  @Get()
  listar(@Query() filtros: ConsultarCategoriasDto) {
    return this.categorias.listar(filtros);
  }

  @Get(':id')
  buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.categorias.buscarPorId(BigInt(id));
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCategoriaDto,
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.categorias.actualizar(BigInt(id), dto, idUsuario);
  }

  @Delete(':id')
  desactivar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.categorias.desactivar(BigInt(id), idUsuario);
  }
}