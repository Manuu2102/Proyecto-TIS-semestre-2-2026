import { Controller, Get, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { ReportesService } from './reportes.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import {
  BalanceMensualDto,
  ExportarBalanceDto,
  ExportarReporteDto,
  FiltrosReporteDto,
} from './dto/reporte.dto.js';

const descarga = (archivo: { contenido: Buffer; nombre: string; tipo: string }) =>
  new StreamableFile(archivo.contenido, {
    type: archivo.tipo,
    disposition: `attachment; filename="${archivo.nombre}"`,
  });

/** HU-23 y HU-24: solo lectura. */
@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR', 'DIRECTORIO', 'CONSULTA')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  /** ?desde=&hasta=&tipo=ingreso|gasto&id_categoria=&monto_min=&monto_max= */
  @Get('ingresos-gastos')
  reporte(@Query() filtros: FiltrosReporteDto) {
    return this.reportes.reporte(filtros);
  }

  /** Mismos filtros + formato=pdf|excel */
  @Get('ingresos-gastos/exportar')
  async exportarReporte(@Query() q: ExportarReporteDto, @CurrentUser('id') idUsuario: string) {
    const { formato, ...filtros } = q;
    return descarga(await this.reportes.exportarReporte(formato, filtros, idUsuario));
  }

  /** ?anio=2026&mes=10 */
  @Get('balance-mensual')
  balance(@Query() q: BalanceMensualDto) {
    return this.reportes.balanceMensual(q.anio, q.mes);
  }

  /** ?anio=2026&mes=10&formato=pdf|excel */
  @Get('balance-mensual/exportar')
  async exportarBalance(@Query() q: ExportarBalanceDto, @CurrentUser('id') idUsuario: string) {
    return descarga(await this.reportes.exportarBalance(q.formato, q.anio, q.mes, idUsuario));
  }
}
