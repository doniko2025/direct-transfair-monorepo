// apps/backend/src/compliance/official-lists.scheduler.ts
// Actualisation quotidienne des listes officielles (03:30, heure du serveur).
// OFFICIAL_LISTS_CRON=false coupe la tâche sur une instance (ex. quand un worker dédié s'en charge).

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { OfficialListsService } from './official-lists.service';

@Injectable()
export class OfficialListsScheduler {
  private readonly logger = new Logger(OfficialListsScheduler.name);
  private running = false;

  constructor(private readonly lists: OfficialListsService) {}

  @Cron('30 3 * * *')
  async daily(): Promise<number> {
    if (String(process.env.OFFICIAL_LISTS_CRON ?? '').trim().toLowerCase() === 'false' || this.running) return 0;
    this.running = true;
    try {
      const results = await this.lists.syncAllInUse();
      return results.filter((r) => r.status === 'OK').length;
    } catch (err) {
      this.logger.error(`Actualisation des listes officielles interrompue : ${(err as Error).message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
