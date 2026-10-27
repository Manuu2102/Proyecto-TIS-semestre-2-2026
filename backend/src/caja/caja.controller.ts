import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { CajaService } from './caja.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { AccesoDenegadoFilter } from './acceso-denegado.filter.js';
import { AbrirCajaDto } from './dto/abrir-caja.dto.js';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto.js';
import { AnularMovimientoDto } from './dto/anular-movimiento.dto.js';
import { ConsultarSaldoDto, ExportarSaldoDto } from './dto/consultar-saldo.dto.js';

/**
 * HU-20 / HU-22. Solo el administrador abre, registra y anula; Directorio y Consulta
 * únicamente consultan el saldo y los movimientos.
 */
@Controller('caja')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseFilters(AccesoDenegadoFilter)
export class CajaController {
  constructor(private readonly caja: CajaService) {}

  @Get()
  @Roles('ADMINISTRADOR', 'DIRECTORIO', 'CONSULTA')
  getCaja() {
    return this.caja.obtenerCaja();
  }

  @Post('apertura')
  @Roles('ADMINISTRADOR')
  abrir(@Body() dto: AbrirCajaDto, @CurrentUser('id') idUsuario: string) {
    return this.caja.abrirCaja(dto, idUsuario);
  }

  /** Saldo al corte (o de un período) con los últimos 10 movimientos. */
  @Get('saldo')
  @Roles('ADMINISTRADOR', 'DIRECTORIO', 'CONSULTA')
  saldo(@Query() q: ConsultarSaldoDto) {
    return this.caja.consultarSaldo(q.corte, q.desde);
  }

  /** ?formato=pdf|excel&corte=&desde= */
  @Get('saldo/exportar')
  @Roles('ADMINISTRADOR', 'DIRECTORIO', 'CONSULTA')
  async exportar(@Query() q: ExportarSaldoDto, @CurrentUser('id') idUsuario: string) {
    const archivo = await this.caja.exportarSaldo(q.formato, q.corte, q.desde, idUsuario);
    return new StreamableFile(archivo.contenido, {
      type: archivo.tipo,
      disposition: `attachment; filename="${archivo.nombre}"`,
    });
  }

  @Get('movimientos')
  @Roles('ADMINISTRADOR', 'DIRECTORIO', 'CONSULTA')
  listar() {
    return this.caja.listarMovimientos();
  }

  @Post('movimientos')
  @Roles('ADMINISTRADOR')
  crear(@Body() dto: CrearMovimientoDto, @CurrentUser('id') idUsuario: string) {
    return this.caja.crearMovimiento(dto, idUsuario);
  }

  @Post('movimientos/:numero/anular')
  @Roles('ADMINISTRADOR')
  anular(
    @Param('numero') numero: string,
    @Body() dto: AnularMovimientoDto,
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.caja.anularMovimiento(numero, dto.motivo ?? dto.motivo_anulacion, idUsuario);
  }
}
