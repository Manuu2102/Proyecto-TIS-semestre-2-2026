import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueryAuditoriaDto } from './dto/query-auditoria.dto.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class AuditoriaService {
  constructor(private prisma: PrismaService) {}

  async buscar(query: QueryAuditoriaDto) {
    const {
      usuario_id,
      accion,
      tabla_afectada,
      fecha_desde,
      fecha_hasta,
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.auditoriaWhereInput = {};

    if (usuario_id) where.usuario_id = usuario_id;
    if (accion) where.accion = accion;
    if (tabla_afectada) where.tabla_afectada = tabla_afectada;

    if (fecha_desde || fecha_hasta) {
      where.fecha_hora = {};
      if (fecha_desde) where.fecha_hora.gte = new Date(fecha_desde);
      if (fecha_hasta) where.fecha_hora.lte = new Date(fecha_hasta);
    }

    const skip = (page - 1) * limit;

    const [registros, total] = await Promise.all([
      this.prisma.auditoria.findMany({
        where,
        orderBy: { fecha_hora: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditoria.count({ where }),
    ]);

    // Junta los UUIDs únicos de usuarios que aparecen en estos registros
    const usuarioIds = [
      ...new Set(registros.map((r) => r.usuario_id).filter((id): id is string => !!id)),
    ];

    const usuarios = usuarioIds.length
      ? await this.prisma.usuario.findMany({
          where: { id: { in: usuarioIds } },
          select: { id: true, nombres: true, apellido_paterno: true },
        })
      : [];

    const nombresPorId = new Map(
      usuarios.map((u) => [u.id, `${u.nombres} ${u.apellido_paterno}`]),
    );

    return {
      data: registros.map((r) => ({
        ...r,
        id: r.id.toString(),
        usuario_nombre: r.usuario_id
          ? (nombresPorId.get(r.usuario_id) ?? 'Usuario desconocido')
          : 'Sistema',
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}