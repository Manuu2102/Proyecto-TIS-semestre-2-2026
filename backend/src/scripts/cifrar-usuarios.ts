import 'dotenv/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { cifrar, cifrarCi, cifrarEmail, estaCifrado } from '../lib/cifrado.js';

/**
 * Cifra una sola vez el ci, email y telefono de los usuarios que todavía están en texto plano.
 * Los que ya están cifrados se saltan, así que se puede volver a correr sin problema.
 *
 *   npx nest build
 *   node dist/scripts/cifrar-usuarios.js             → solo muestra qué cambiaría
 *   node dist/scripts/cifrar-usuarios.js --aplicar   → guarda los cambios
 */

const aplicar = process.argv.includes('--aplicar');

async function main() {
  const prisma = new PrismaService();
  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nombres: true, ci: true, email: true, telefono: true },
  });

  const pendientes = usuarios
    .map((u) => ({
      u,
      datos: {
        ...(!estaCifrado(u.ci) && { ci: cifrarCi(u.ci) }),
        ...(!estaCifrado(u.email) && { email: cifrarEmail(u.email) }),
        ...(!estaCifrado(u.telefono) && { telefono: cifrar(u.telefono.trim()) }),
      },
    }))
    .filter(({ datos }) => Object.keys(datos).length > 0);

  console.log(`${usuarios.length} usuarios; ${pendientes.length} con datos sin cifrar.`);
  for (const { u, datos } of pendientes) {
    console.log(`- ${u.nombres} (${u.id}): ${Object.keys(datos).join(', ')}`);
  }

  if (!aplicar) {
    console.log('\nNo se guardó nada. Para cifrarlos, vuelve a correrlo con --aplicar.');
  } else if (pendientes.length > 0) {
    // Todo o nada: si uno falla, no queda ningún usuario a medias
    await prisma.$transaction(
      pendientes.map(({ u, datos }) => prisma.usuario.update({ where: { id: u.id }, data: datos })),
    );
    console.log(`\nListo: ${pendientes.length} usuarios cifrados.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
