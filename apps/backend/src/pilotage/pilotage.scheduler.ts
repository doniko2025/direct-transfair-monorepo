// apps/backend/src/pilotage/pilotage.scheduler.ts
// =========================================================
// PILOTAGE — tâches planifiées (heure du serveur)
//   • toutes les 15 minutes : contrôle de liquidité des caisses (alertes + notifications)
//   • le 1er de chaque mois à 07:10 : rapport d'activité du mois écoulé, par courriel, aux administrateurs
// PILOTAGE_CRON=false coupe les deux sur une instance (ex. un worker dédié) ; PILOTAGE_MONTHLY_REPORT=false coupe seulement le rapport.
// =========================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PilotageService } from './pilotage.service';

const off = (v: string | undefined) => String(v ?? '').trim().toLowerCase() === 'false';

@Injectable()
export class PilotageScheduler {
  private readonly logger = new Logger(PilotageScheduler.name);
  private checking = false;
  private reporting = false;

  constructor(private readonly pilotage: PilotageService) {}

  @Cron('*/15 * * * *')
  async liquidity(): Promise<number> {
    if (off(process.env.PILOTAGE_CRON) || this.checking) return 0;
    this.checking = true;
    try {
      const n = await this.pilotage.evaluateAll();
      if (n > 0) this.logger.log(`💧 ${n} alerte(s) de liquidité créée(s).`);
      return n;
    } catch (err) {
      this.logger.error(`Contrôle de liquidité interrompu : ${(err as Error).message}`);
      return 0;
    } finally {
      this.checking = false;
    }
  }

  @Cron('10 7 1 * *')
  async monthlyReport(): Promise<number> {
    if (off(process.env.PILOTAGE_CRON) || off(process.env.PILOTAGE_MONTHLY_REPORT) || this.reporting) return 0;
    this.reporting = true;
    try {
      const n = await this.pilotage.sendMonthlyReports();
      this.logger.log(`📊 ${n} rapport(s) mensuel(s) envoyé(s).`);
      return n;
    } catch (err) {
      this.logger.error(`Rapport mensuel interrompu : ${(err as Error).message}`);
      return 0;
    } finally {
      this.reporting = false;
    }
  }
}
