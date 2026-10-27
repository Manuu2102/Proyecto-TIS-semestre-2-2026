import { Prisma } from '../generated/prisma/client.js';

/** Operaciones que registran caja, ingresos, gastos y categorías. */
export type OperacionAuditoria = 'CREAR' | 'ACTUALIZAR' | 'DESACTIVAR' | 'ANULAR' | 'ABRIR';

// La tabla auditoria solo acepta INSERT, UPDATE o DELETE (CHECK auditoria_accion_check).
// Crear es un INSERT; anular, abrir, desactivar o editar modifican el registro (UPDATE).
const ACCION: Record<OperacionAuditoria, 'INSERT' | 'UPDATE'> = {
  CREAR: 'INSERT',
  ACTUALIZAR: 'UPDATE',
  DESACTIVAR: 'UPDATE',
  ANULAR: 'UPDATE',
  ABRIR: 'UPDATE',
};

const aJson = (datos: unknown) =>
  datos === null || datos === undefined
    ? Prisma.DbNull
    : (JSON.parse(
        JSON.stringify(datos, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
      ) as Prisma.InputJsonValue);

/**
 * Registra una operación en la tabla auditoria dentro de la misma transacción,
 * así la auditoría y el cambio se guardan juntos o no se guarda ninguno.
 * La operación concreta (p. ej. ANULAR) queda en datos_nuevos.operacion.
 */
export async function registrarAuditoria(
  tx: Prisma.TransactionClient,
  datos: {
    tabla: string;
    registroId: bigint | string;
    accion: OperacionAuditoria;
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
      accion: ACCION[datos.accion],
      datos_anteriores: aJson(datos.antes),
      datos_nuevos: aJson({ operacion: datos.accion, ...(datos.despues as object | undefined) }),
    },
  });
}
