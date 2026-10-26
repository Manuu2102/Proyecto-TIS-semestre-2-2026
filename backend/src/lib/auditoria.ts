import { Prisma } from '../generated/prisma/client.js';

const aJson = (datos: unknown) =>
  datos === null || datos === undefined
    ? Prisma.DbNull
    : (JSON.parse(
        JSON.stringify(datos, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
      ) as Prisma.InputJsonValue);

/**
 * Registra una operación en la tabla auditoria dentro de la misma transacción,
 * así la auditoría y el cambio se guardan juntos o no se guarda ninguno.
 */
export async function registrarAuditoria(
  tx: Prisma.TransactionClient,
  datos: {
    tabla: string;
    registroId: bigint | string;
    accion: string;
    antes?: unknown;
    despues?: unknown;
    usuarioId: string;
  },
) {
  await tx.auditoria.create({
    data: {
      usuario_id: datos.usuarioId,
      tabla_afectada: datos.tabla,
      registro_id: datos.registroId.toString(),
      accion: datos.accion,
      datos_anteriores: aJson(datos.antes),
      datos_nuevos: aJson(datos.despues),
    },
  });
}
