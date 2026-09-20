import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service.js';
import { QueryAuditoriaDto } from './dto/query-auditoria.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class AuditoriaController {
  constructor(private auditoriaService: AuditoriaService) {}
  @Get()
  buscar(@Query() query: QueryAuditoriaDto) {
    return this.auditoriaService.buscar(query);
  }
}