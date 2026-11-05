import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      // La base está lejos (~300 ms por consulta, ~1,8 s por conexión nueva). Se
      // mantienen algunas conexiones abiertas para no reconectar en cada pantalla.
      max: 10,
      min: 2,
      idleTimeoutMillis: 5 * 60_000,
      keepAlive: true,
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    // Abre las conexiones mínimas al arrancar, sin bloquear el inicio si falla
    void Promise.all([this.$queryRaw`SELECT 1`, this.$queryRaw`SELECT 1`]).catch(() => {});
  }

  async conUsuario<T>(
    usuarioId: string | null,
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      const claims = JSON.stringify({ sub: usuarioId, role: 'authenticated' });
      await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, true)`;
      return callback(tx);
    });
  }
}