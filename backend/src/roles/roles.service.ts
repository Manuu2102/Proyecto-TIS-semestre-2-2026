import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ActualizarPermisosDto } from './dto/actualizar-permisos.dto.js';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  // 1. Obtener la matriz actual (ej. { "Administrador": ["Documentos"], ... })
  async obtenerMatriz() {
    const roles = await this.prisma.rol.findMany({
      include: {
        rol_funcion: {
          include: { funciones: true },
        },
      },
    });

    const matriz: Record<string, string[]> = {};

    for (const rol of roles) {
      matriz[rol.nombre_rol] = rol.rol_funcion.map((rf) => rf.funciones.nombre);
    }

    return matriz;
  }

  // 2. Guardar los cambios desde el Frontend
  async actualizarPermisos(dto: ActualizarPermisosDto, idAdmin: string, ip: string) {
    return this.prisma.$transaction(async (tx) => {
      for (const [nombreRol, funcionesPermitidas] of Object.entries(dto.matrix)) {
        // Buscar el ID del rol
        const rol = await tx.rol.findFirst({
          where: { nombre_rol: nombreRol },
        });
        if (!rol) continue;

        // Borrar los permisos actuales de ese rol
        await tx.rol_funcion.deleteMany({
          where: { id_rol: rol.id },
        });

        // Insertar los nuevos permisos
        for (const nombreFuncion of funcionesPermitidas) {
          const funcion = await tx.funciones.findFirst({
            where: { nombre: nombreFuncion },
          });
          if (funcion) {
            await tx.rol_funcion.create({
              data: {
                id_rol: rol.id,
                id_funcion: funcion.id,
              },
            });
          }
        }
      }

      // Registrar en auditoría que el admin cambió los permisos
      // (Importa tu función registrarAuditoria)
      // await registrarAuditoria(tx, { ... });

      return { message: 'Permisos actualizados correctamente' };
    });
  }
}