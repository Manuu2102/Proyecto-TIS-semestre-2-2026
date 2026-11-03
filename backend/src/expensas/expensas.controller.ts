import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { ExpensasExportarService } from './expensas-exportar.service.js';
import { ExportarSaldosDto, FormatoDto } from './dto/exportar.dto.js';
import { ExpensasService } from './expensas.service.js';
import { ExpensasCron } from './expensas.cron.js';
import { PagarExpensaDto } from './dto/pagar-expensa.dto.js';
import { CrearExtrasDto } from './dto/crear-extras.dto.js';
import { DepositarFondosDto } from './dto/depositar-fondos.dto.js';
import { ReglaMoraDto } from './dto/regla-mora.dto.js';
import { ActualizarTarifaDto } from './dto/actualizar-tarifa.dto.js';
import { GenerarMesDto } from './dto/generar-mes.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

const descarga = (archivo: { contenido: Buffer; nombre: string; tipo: string }) =>
  new StreamableFile(archivo.contenido, {
    type: archivo.tipo,
    disposition: `attachment; filename="${archivo.nombre}"`,
  });

@Controller('expensas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class ExpensasController {
  constructor(
    private readonly expensas: ExpensasService,
    private readonly exportar: ExpensasExportarService,
    private readonly cron: ExpensasCron,
  ) {}

  /** Genera las expensas de un mes elegido; si ya estaban todas, responde 409. */
  @Post('generar-mes')
  generarMes(@Body() dto: GenerarMesDto) {
    return this.expensas.generarMes(dto.periodo);
  }

  /** Departamentos, deudas pendientes y saldo a favor, para la pantalla de pagos. */
  @Get('pagos/resumen')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  resumenPagos() {
    return this.expensas.resumenPagos();
  }

  /** Pagos de expensas y depósitos de fondos, del más nuevo al más antiguo. */
  @Get('pagos/historial')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  historialPagos() {
    return this.expensas.historialPagos();
  }

  @Post('pagos/:id/pagar')
  pagar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PagarExpensaDto,
    @CurrentUser('id') idUsuario: string,
  ) {
    return this.expensas.pagar(id, dto, idUsuario);
  }

  /** Regla de mora vigente. */
  @Get('mora/regla')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  obtenerReglaMora() {
    return this.expensas.obtenerReglaMora();
  }

  /**
   * Cambia la regla de mora; el nuevo día y la nueva hora solo aplican a las deudas futuras.
   * La revisión diaria de moras pasa a correr a la nueva hora.
   */
  @Put('mora/regla')
  async guardarReglaMora(@Body() dto: ReglaMoraDto) {
    const regla = await this.expensas.guardarReglaMora(dto);
    this.cron.programar(regla.hora);
    return regla;
  }

  @Get('mensuales')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  listarMensuales(@Query('periodo') periodo?: string) {
    return this.expensas.listarMensuales(periodo);
  }

  /** Meses que tienen deudas, del más nuevo al más antiguo. */
  @Get('periodos')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  listarPeriodos() {
    return this.expensas.listarPeriodos();
  }

  @Get('departamentos')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  listarDepartamentos() {
    return this.expensas.listarDepartamentos();
  }

  /** Conceptos y montos de expensa por categoría (A, B, C). */
  @Get('tarifas')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  listarTarifas() {
    return this.expensas.listarTarifas();
  }

  /** Cambia el monto de la expensa de una categoría. */
  @Put('tarifas')
  actualizarTarifa(@Body() dto: ActualizarTarifaDto) {
    return this.expensas.actualizarTarifa(dto);
  }

  /** Departamentos para el buscador del estado de cuenta. */
  @Get('estado-cuenta')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  departamentosEstadoCuenta() {
    return this.expensas.departamentosEstadoCuenta();
  }

  /** Estado de cuenta de un departamento, por su número. */
  @Get('estado-cuenta/:numero')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  estadoCuenta(@Param('numero', ParseIntPipe) numero: number) {
    return this.expensas.estadoCuenta(numero);
  }

  /** Estado de cuenta en PDF o Excel: ?formato=pdf|excel */
  @Get('estado-cuenta/:numero/exportar')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  async exportarEstadoCuenta(
    @Param('numero', ParseIntPipe) numero: number,
    @Query() q: FormatoDto,
    @CurrentUser('id') idUsuario: string,
  ) {
    return descarga(await this.exportar.exportarEstadoCuenta(numero, q.formato, idUsuario));
  }

  /** Saldos pendientes en PDF o Excel, con los filtros y el orden de la pantalla. */
  @Get('pagos/resumen/exportar')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  async exportarSaldos(@Query() q: ExportarSaldosDto, @CurrentUser('id') idUsuario: string) {
    return descarga(await this.exportar.exportarSaldos(q, idUsuario));
  }
  /** Añade extras a la deuda del mes actual o del siguiente de departamentos específicos. */
  @Post('extras')
  crearExtras(@Body() dto: CrearExtrasDto) {
    return this.expensas.crearExtras(dto);
  }

  /** Registra fondos para un departamento. */
  @Post('fondos')
  depositarFondos(@Body() dto: DepositarFondosDto, @CurrentUser('id') idUsuario: string) {
    return this.expensas.depositarFondos(dto, idUsuario);
  }
}
