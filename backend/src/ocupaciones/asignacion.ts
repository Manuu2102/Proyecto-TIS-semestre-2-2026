import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

/**
 * Ayudas compartidas por copropietarios e inquilinos para manejar la ocupación
 * de un departamento (tabla departamento_usuario) dentro de una transacción.
 *
 * Cada estadía es una fila propia (clave `id`): al ocupar se crea una fila nueva y
 * al salir se cierra (estatus = false + fecha_fin), así queda el historial completo.
 * La base garantiza una sola fila ACTIVA por departamento y usuario.
 */

/** Ocupación activa de un usuario, con su departamento (o null si no tiene). */
export function ocupacionActiva(tx: Prisma.TransactionClient, idUsuario: string) {
  return tx.departamento_usuario.findFirst({
    where: { id_usuario: idUsuario, estatus: true },
    orderBy: { fecha_ocupacion: 'desc' },
  });
}

/** Cierra las ocupaciones activas del usuario y libera los departamentos que queden vacíos. */
export async function cerrarOcupaciones(tx: Prisma.TransactionClient, idUsuario: string) {
  const activas = await tx.departamento_usuario.findMany({
    where: { id_usuario: idUsuario, estatus: true },
  });

  for (const o of activas) {
    await cerrarOcupacion(tx, o);
  }
}

/** Cierra una estadía y libera el departamento si ya no queda nadie viviendo ahí. */
export async function cerrarOcupacion(
  tx: Prisma.TransactionClient,
  ocupacion: { id: bigint; id_departamento: bigint },
) {
  await tx.departamento_usuario.update({
    where: { id: ocupacion.id },
    data: { estatus: false, fecha_fin_ocupacion: new Date() },
  });

  const quedan = await tx.departamento_usuario.count({
    where: { id_departamento: ocupacion.id_departamento, estatus: true },
  });
  if (quedan === 0) {
    await tx.departamento.update({
      where: { id: ocupacion.id_departamento },
      data: { libre: true },
    });
  }
}

/**
 * Asocia el usuario al departamento con una estadía nueva y lo marca como ocupado.
 * Quien llama debe haber cerrado antes la ocupación activa que tuviera ahí.
 */
export async function ocuparDepartamento(
  tx: Prisma.TransactionClient,
  idUsuario: string,
  idDepartamento: bigint,
  fecha: Date,
  fechaFin: Date | null = null,
) {
  const ocupacion = await tx.departamento_usuario.create({
    data: {
      id_usuario: idUsuario,
      id_departamento: idDepartamento,
      fecha_ocupacion: fecha,
      fecha_fin_ocupacion: fechaFin,
      estatus: true,
    },
  });

  await tx.departamento.update({
    where: { id: idDepartamento },
    data: { libre: false },
  });

  return ocupacion;
}

/** Busca un departamento activo; lanza 400 si no existe. */
export async function departamentoValido(
  db: Prisma.TransactionClient,
  idDepartamento: bigint,
) {
  const depto = await db.departamento.findUnique({ where: { id: idDepartamento } });
  if (!depto || !depto.estatus) {
    throw new BadRequestException('El departamento seleccionado no existe.');
  }
  return depto;
}

/**
 * Lanza 400 si el departamento ya tiene otro ocupante activo con ese rol
 * (un solo copropietario y un solo inquilino por departamento).
 */
export async function validarSinOtroConRol(
  db: Prisma.TransactionClient,
  idDepartamento: bigint,
  idRol: number,
  mensaje: string,
  excluirUsuario?: string,
) {
  const otro = await db.departamento_usuario.findFirst({
    where: {
      id_departamento: idDepartamento,
      estatus: true,
      ...(excluirUsuario && { id_usuario: { not: excluirUsuario } }),
      usuario: { rol_usuario: { some: { id_rol: idRol } } },
    },
  });
  if (otro) {
    throw new BadRequestException(mensaje);
  }
}

/** "A-101", como lo muestra el front. */
export const codigoDepartamento = (d: { codigo: string; numero: number }) =>
  `${d.codigo}-${d.numero}`;
