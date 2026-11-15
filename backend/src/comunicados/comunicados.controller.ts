import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete, 
  Body, 
  Param, 
  UseGuards, 
  ParseIntPipe 
} from '@nestjs/common';
import { ComunicadosService } from './comunicados.service.js';
import { CrearComunicadoDto } from './dto/crear-comunicado.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('comunicados')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComunicadosController {
  constructor(private comunicadosService: ComunicadosService) {}

  @Post()
  @Roles('ADMINISTRADOR')
  crear(@Body() dto: CrearComunicadoDto, @CurrentUser('id') adminId: string) {
    return this.comunicadosService.crear(dto, adminId);
  }

  @Get()
  @Roles('ADMINISTRADOR') // <-- Cumple SAE-389: Solo el admin puede ver el historial
  listar(@CurrentUser('id') adminId: string) {
    return this.comunicadosService.listar(adminId);
  }

  @Patch(':id')
  @Roles('ADMINISTRADOR')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @CurrentUser('id') adminId: string
  ) {
    return this.comunicadosService.actualizar(BigInt(id), body, adminId);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR')
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: string
  ) {
    return this.comunicadosService.eliminar(BigInt(id), adminId);
  }
}