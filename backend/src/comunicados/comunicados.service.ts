import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CrearComunicadoDto } from './dto/crear-comunicado.dto.js';
import { registrarAuditoria } from '../lib/auditoria.js'; // <-- IMPORTAMOS LA AUDITORÍA

@Injectable()
export class ComunicadosService {
  constructor(private prisma: PrismaService) {}

  async crear(data: CrearComunicadoDto, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Creamos el comunicado
      const comunicado = await tx.comunicado.create({
        data: {
          titulo: data.titulo,
          contenido: data.contenido,
          tipo: data.tipo ?? 'Informativo',
          id_usuario: adminId,
        },
      });

      // 2. Registramos en auditoría (Cumple SAE-385)
      await registrarAuditoria(tx, {
        tabla: 'comunicado',
        registroId: comunicado.id,
        accion: 'CREAR',
        usuarioId: adminId,
        despues: comunicado,
      });

      return comunicado;
    });
  }

  async listar(adminId: string) { // <-- Ahora recibe el adminId para la auditoría
    return this.prisma.$transaction(async (tx) => {
      const comunicados = await tx.comunicado.findMany({
        where: { estatus: true },
        include: {
          usuario: {
            select: { nombres: true, apellido_paterno: true },
          },
        },
        orderBy: { fecha_publicacion: 'desc' },
      });

      // 3. Registramos la consulta en auditoría (Cumple SAE-389)
      await registrarAuditoria(tx, {
        tabla: 'comunicado',
        registroId: '0', // No es un registro específico, es una consulta general
        accion: 'ACTUALIZAR', // Usamos ACTUALIZAR porque el tipo 'CONSULTAR' no existe en tu función
        usuarioId: adminId,
        despues: { mensaje: 'El administrador consultó el historial de comunicados' },
      });

      return comunicados;
    });
  }

  async actualizar(id: bigint, data: any, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const comunicado = await tx.comunicado.findUnique({ where: { id } });
      if (!comunicado) throw new NotFoundException('Comunicado no encontrado');

      const actualizado = await tx.comunicado.update({
        where: { id },
        data: {
          titulo: data.titulo,
          contenido: data.contenido,
          tipo: data.tipo,
        },
      });

      await registrarAuditoria(tx, {
        tabla: 'comunicado',
        registroId: actualizado.id,
        accion: 'ACTUALIZAR',
        usuarioId: adminId,
        antes: comunicado,
        despues: actualizado,
      });

      return actualizado;
    });
  }

  async eliminar(id: bigint, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const comunicado = await tx.comunicado.findUnique({ where: { id } });
      if (!comunicado) throw new NotFoundException('Comunicado no encontrado');

      const eliminado = await tx.comunicado.update({
        where: { id },
        data: { estatus: false },
      });

      await registrarAuditoria(tx, {
        tabla: 'comunicado',
        registroId: eliminado.id,
        accion: 'DESACTIVAR',
        usuarioId: adminId,
        antes: comunicado,
        despues: eliminado,
      });

      return eliminado;
    });
  }
}