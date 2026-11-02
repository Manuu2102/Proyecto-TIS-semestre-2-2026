import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { ActualizarPermisosDto } from './dto/actualizar-permisos.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { Request } from 'express';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR') // Solo el admin puede tocar los permisos
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get('permisos')
  async obtenerMatriz() {
    return this.rolesService.obtenerMatriz();
  }

  @Post('permisos')
  async actualizarPermisos(
    @Body() dto: ActualizarPermisosDto,
    @CurrentUser('id') idAdmin: string,
    @Req() req: Request,
  ) {
    const ip = req.socket.remoteAddress || 'IP Desconocida';
    return this.rolesService.actualizarPermisos(dto, idAdmin, ip);
  }
}