import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CreateExpensaDto } from './dto/create-expensa.dto.js';
import { GenerarDeudasDto } from './dto/generar-deudas.dto.js';
import { ExpensasService } from './expensas.service.js';
import { PagarExpensaDto } from './dto/pagar-expensa.dto.js';
import { PagarAnticipadoDto } from './dto/pagar-anticipado.dto.js';
import { CrearExtrasDto } from './dto/crear-extras.dto.js';
import { DepositarFondosDto } from './dto/depositar-fondos.dto.js';
import { ReglaMoraDto } from './dto/regla-mora.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('expensas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class ExpensasController {
  constructor(private readonly expensas: ExpensasService) {}

  /** Calcula el reparto por departamento sin guardar nada. */
  @Post('previsualizar')
  previsualizar(@Body() dto: CreateExpensaDto) {
    return this.expensas.previsualizar(dto);
  }

  /** Crea la expensa y genera las deudas del mes actual. */
  @Post()
  create(@Body() dto: CreateExpensaDto) {
    return this.expensas.create(dto);
  }

  /** Hace lo mismo que el cron mensual, a demanda. Útil para probar. */
  @Post('generar-deudas-mensuales')
  generarDeudasMensuales() {
    return this.expensas.generarDeudasMensuales();
  }

  /** Genera las deudas de un mes para una expensa existente. */
  @Post(':id/generar-deudas')
  generarDeudas(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GenerarDeudasDto,
  ) {
    return this.expensas.generarDeudas(id, dto);
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

  @Post('pagos/anticipado')
  pagarAnticipado(@Body() dto: PagarAnticipadoDto, @CurrentUser('id') idUsuario: string) {
    return this.expensas.pagarAnticipado(dto, idUsuario);
  }

  @Post('aplicar-vencimientos')
  aplicarVencimientos() {
    return this.expensas.aplicarVencimientos();
  }

  /** Regla de mora vigente. */
  @Get('mora/regla')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  obtenerReglaMora() {
    return this.expensas.obtenerReglaMora();
  }

  /** Cambia la regla de mora; el nuevo día solo aplica a las deudas futuras. */
  @Put('mora/regla')
  guardarReglaMora(@Body() dto: ReglaMoraDto) {
    return this.expensas.guardarReglaMora(dto);
  }

  @Get('mensuales')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  listarMensuales(@Query('periodo') periodo?: string) {
    return this.expensas.listarMensuales(periodo);
  }

  @Get('departamentos')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  listarDepartamentos() {
    return this.expensas.listarDepartamentos();
  }
  /** Añade deudas extra a departamentos específicos. */
  @Post('extras')
  crearExtras(@Body() dto: CrearExtrasDto) {
    return this.expensas.crearExtras(dto);
  }

  /** Registra fondos para un departamento. */
  @Post('fondos')
  depositarFondos(@Body() dto: DepositarFondosDto, @CurrentUser('id') idUsuario: string) {
    return this.expensas.depositarFondos(dto, idUsuario);
  }

  /** Saldo de fondos de un departamento. */
  @Get('fondos/:id')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  obtenerSaldo(@Param('id', ParseIntPipe) id: number) {
    return this.expensas.obtenerSaldo(id);
  }
  // Las rutas con parámetro van al final
  @Get(':id')
  @Roles('ADMINISTRADOR', 'CONSULTA', 'DIRECTORIO')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.expensas.findOne(id);
  }
}
