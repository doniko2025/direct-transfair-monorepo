//apps/backend/src/common/prisma/prisma-client.manager.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

type ManagedPrisma = {
  client: PrismaClient;
  databaseUrl: string;
  lastUsedAt: number;
};

@Injectable()
export class PrismaClientManager implements OnModuleDestroy {
  private readonly clients = new Map<string, ManagedPrisma>();

  /**
   * Retourne un PrismaClient dédié au tenant.
   * - cache par tenantCode
   * - recrée le client si l’URL DB change
   */
  getClient(params: { tenantCode: string; databaseUrl: string }): PrismaClient {
    const now = Date.now();
    const key = params.tenantCode.toUpperCase().trim();
    if (!key) {
      throw new Error('PrismaClientManager: tenantCode is required');
    }

    const existing = this.clients.get(key);

    // Si pas de client ou url modifiée -> nouveau client
    if (!existing || existing.databaseUrl !== params.databaseUrl) {
      if (existing) {
        // cleanup de l’ancien client
        void existing.client.$disconnect();
        this.clients.delete(key);
      }

      const client = new PrismaClient({
        datasources: {
          db: { url: params.databaseUrl },
        },
      });

      this.clients.set(key, {
        client,
        databaseUrl: params.databaseUrl,
        lastUsedAt: now,
      });

      return client;
    }

    existing.lastUsedAt = now;
    return existing.client;
  }

  /**
   * Optionnel: éviction simple (ex: à appeler sur un cron interne)
   */
  evictIdleClients(maxIdleMs: number): void {
    const now = Date.now();
    for (const [key, value] of this.clients.entries()) {
      if (now - value.lastUsedAt > maxIdleMs) {
        void value.client.$disconnect();
        this.clients.delete(key);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    const disconnects: Promise<unknown>[] = [];
    for (const value of this.clients.values()) {
      disconnects.push(value.client.$disconnect());
    }
    await Promise.allSettled(disconnects);
    this.clients.clear();
  }
}
