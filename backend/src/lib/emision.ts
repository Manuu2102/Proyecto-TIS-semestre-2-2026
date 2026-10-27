import { PrismaService } from '../prisma/prisma.service.js';
import { ahoraTexto } from './formato.js';

/**
 * Datos que llevan todos los documentos exportados: nombre del edificio (o "Edificio"
 * si todavía no está cargado), quién lo emite y la fecha y hora de emisión.
 */
export async function datosEmision(prisma: PrismaService, idUsuario: string) {
  const edificio = (await prisma.edificio.findFirst({ select: { nombre: true } }))?.nombre ?? 'Edificio';
  const u = await prisma.usuario.findUnique({
    where: { id: idUsuario },
    select: { nombres: true, apellido_paterno: true },
  });
  return {
    edificio,
    emisor: u ? `${u.nombres} ${u.apellido_paterno}`.trim() : '—',
    emitido: ahoraTexto(),
  };
}
