import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UsuariosService } from './usuarios.service.js';
import { AssignRoleDto } from './dto/assign-role.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('usuarios')
export class UsuariosController {
  constructor(private usuariosService: UsuariosService) {}

  @Post()
  crearUsuario(
    @Body()
    body: {
      password: string;
      ci: string;
      nombres: string;
      apellido_paterno: string;
      apellido_materno?: string;
      sexo: string;
      fecha_de_nacimiento: string;
      email: string;
      telefono: string;
    },
  ) {
    return this.usuariosService.crearUsuario({
      ...body,
      ci: BigInt(body.ci),
      fecha_de_nacimiento: new Date(body.fecha_de_nacimiento),
    });
  }

  @Post('assign-role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR')
  assignRole(@Body() dto: AssignRoleDto) {
    return this.usuariosService.assignRole(dto.id_usuario, dto.id_rol);
  }
}