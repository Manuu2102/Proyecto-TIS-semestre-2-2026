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
import { CuentasBancariasService } from './cuentas-bancarias.service.js';
import { CrearCuentaDto } from './dto/crear-cuenta.dto.js';
import { ActualizarCuentaDto } from './dto/actualizar-cuenta.dto.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('cuentas-bancarias')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class CuentasBancariasController {
  constructor(private readonly cuentas: CuentasBancariasService) {}

  @Post()
  crear(
    @Body() dto: CrearCuentaDto,
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.cuentas.crear(dto, idUsuario);
  }

  @Get()
  listar(@Query('activa') activa?: string) {
    const filtros: { activa?: boolean } = {};
    if (activa !== undefined) filtros.activa = activa === 'true';
    return this.cuentas.listar(filtros);
  }

  @Get(':id')
  buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.cuentas.buscarPorId(BigInt(id));
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCuentaDto,
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.cuentas.actualizar(BigInt(id), dto, idUsuario);
  }

  @Delete(':id')
  desactivar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.cuentas.desactivar(BigInt(id), idUsuario);
  }
}