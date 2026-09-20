import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
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