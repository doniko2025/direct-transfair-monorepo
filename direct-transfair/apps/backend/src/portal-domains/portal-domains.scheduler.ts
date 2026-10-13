// apps/backend/src/portal-domains/portal-domains.scheduler.ts
// =========================================================
// Vérification planifiée des domaines de portail v1.0 — toutes les 5 minutes (chaque domaine a son propre rythme :
// voir PortalDomainsService.isDue). PORTAL_DOMAINS_CRON=false la coupe. Le verrou par domaine évite tout doublon
// si plusieurs instances tournent.
// =========================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { cronEnabled } from './portal-domains.config';
import { PortalDomainsService, safeMessage } from './portal-domains.service';

@Injectable()
export class PortalDomainsScheduler {
  private readonly logger = new Logger(PortalDomainsScheduler.name);
  private running = false;

  constructor(private readonly service: PortalDomainsService) {}

  @Cron('*/5 * * * *')
  async tick(): Promise<void> {
    if (!cronEnabled() || this.running) return;
    this.running = true;
    try {
      const res = await this.service.checkDue();
      if (res.examined > 0) {
        this.logger.log(`Domaines de portail : ${res.examined} vérifiés, ${res.activated} activés, ${res.failed} en erreur.`);
      }
    } catch (err) {
      this.logger.error(`Vérification des domaines de portail impossible : ${safeMessage(err)}`);
    } finally {
      this.running = false;
    }
  }
}
