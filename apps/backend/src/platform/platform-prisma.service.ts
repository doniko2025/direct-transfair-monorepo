// apps/backend/src/platform/platform-prisma.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from './generated/platform-client';

@Injectable()
export class PlatformPrismaService extends PrismaClient implements OnModuleDestroy {
  private connected = false;
  private connecting: Promise<void> | null = null;

  /**
   * Connexion explicitement lazy :
   * - ne bloque pas le boot si la platform DB n'est pas prête
   * - appelée par le middleware ou le provisioning uniquement quand nécessaire
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    const url = process.env.DATABASE_URL_PLATFORM;
    if (!url || !String(url).trim()) {
      // Dev safe : platform DB non configurée => on ne connecte pas
      // (les routes platform/provisioning devront gérer ce cas)
      return;
    }

    if (!this.connecting) {
      this.connecting = this.$connect()
        .then(() => {
          this.connected = true;
        })
        .finally(() => {
          this.connecting = null;
        });
    }

    await this.connecting;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.connected) return;
    await this.$disconnect();
    this.connected = false;
  }
}
