// apps/backend/src/webhooks/webhooks.scheduler.ts
// =========================================================
// WEBHOOKS — tâche planifiée (chaque minute) : relève des changements d'état, puis envoi des envois dus.
// WEBHOOKS_CRON=false coupe la tâche sur une instance (ex. un worker dédié l'exécute ailleurs).
// =========================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';
import { flushDue, scanTransactions } from './webhooks.delivery';

const off = (v: string | undefined) => String(v ?? '').trim().toLowerCase() === 'false';

@Injectable()
export class WebhooksScheduler {
  private readonly logger = new Logger(WebhooksScheduler.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron('* * * * *')
  async tick(): Promise<{ queued: number; sent: number }> {
    if (off(process.env.WEBHOOKS_CRON) || this.running) return { queued: 0, sent: 0 };
    this.running = true;
    try {
      const queued = await scanTransactions(this.prisma);
      const sent = await flushDue(this.prisma);
      if (queued || sent) this.logger.log(`🔔 Webhooks : ${queued} événement(s) enfilé(s), ${sent} envoi(s) tenté(s).`);
      return { queued, sent };
    } catch (err) {
      this.logger.error(`Cycle webhooks interrompu : ${(err as Error).message}`);
      return { queued: 0, sent: 0 };
    } finally {
      this.running = false;
    }
  }
}
