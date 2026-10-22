import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

/**
 * Ayudas compartidas por copropietarios e inquilinos para manejar la ocupación
 * de un departamento (tabla departamento_usuario) dentro de una transacción.
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
    await tx.departamento_usuario.update({
      where: {
        id_departamento_id_usuario: {
          id_departamento: o.id_departamento,
          id_usuario: idUsuario,
        },
      },
      data: { estatus: false, fecha_fin_ocupacion: new Date() },
    });

    const quedan = await tx.departamento_usuario.count({
      where: { id_departamento: o.id_departamento, estatus: true },
    });
    if (quedan === 0) {
      await tx.departamento.update({
        where: { id: o.id_departamento },
        data: { libre: true },
      });
    }
  }
}

/**
 * Asocia el usuario al departamento y lo marca como ocupado. Si el usuario ya
 * vivió ahí antes, se reactiva esa fila (la clave es departamento + usuario).
 */
export async function ocuparDepartamento(
  tx: Prisma.TransactionClient,
  idUsuario: string,
  idDepartamento: bigint,
  fecha: Date,
) {
  await tx.departamento_usuario.upsert({
    where: {
      id_departamento_id_usuario: {
        id_departamento: idDepartamento,
        id_usuario: idUsuario,
      },
    },
    create: {
      id_usuario: idUsuario,
      id_departamento: idDepartamento,
      fecha_ocupacion: fecha,
      estatus: true,
    },
    update: {
      fecha_ocupacion: fecha,
      fecha_fin_ocupacion: null,
      estatus: true,
    },
  });

  await tx.departamento.update({
    where: { id: idDepartamento },
    data: { libre: false },
  });
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
