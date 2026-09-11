import { Controller, Post, Body } from '@nestjs/common';
import { UsuariosService } from './usuarios.service.js';

@Controller('usuarios')
export class UsuariosController {
  constructor(private usuariosService: UsuariosService) {}

  @Post()
  crearUsuario(
    @Body()
    body: {
      user_name: string;
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
}