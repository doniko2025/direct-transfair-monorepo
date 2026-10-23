// apps/backend/src/transactions/pickup-expiry.service.ts
// =========================================================
// PICKUP EXPIRY SERVICE v1.0 — Direct Transf'air
// Balayage quotidien (03:15, heure du serveur) des codes de retrait expirés : les envois non retirés depuis plus de
// PICKUP_CODE_VALIDITY_MONTHS (5) mois sont annulés (EXPIRED) et l'expéditeur est remboursé. Toute la logique est dans
// TransactionsService.expireUnclaimed() (remboursement atomique, sûr si plusieurs instances tournent en même temps).
// PICKUP_EXPIRY_CRON=false désactive le balayage sur une instance (ex. un worker dédié).
// =========================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TransactionsService } from './transactions.service';

const BATCH = 200;
const MAX_BATCHES = 50; // garde-fou : 10 000 envois par passage au plus

@Injectable()
export class PickupExpiryService {
  private readonly logger = new Logger(PickupExpiryService.name);
  private running = false;

  constructor(private readonly transactions: TransactionsService) {}

  @Cron('15 3 * * *')
  async sweep(): Promise<number> {
    if (String(process.env.PICKUP_EXPIRY_CRON ?? '').trim().toLowerCase() === 'false') return 0;
    if (this.running) return 0; // un passage précédent dure encore
    this.running = true;
    let total = 0;
    try {
      for (let i = 0; i < MAX_BATCHES; i++) {
        const n = await this.transactions.expireUnclaimed(BATCH);
        total += n;
        if (n < BATCH) break;
      }
      if (total > 0) this.logger.log(`⏳ ${total} code(s) de retrait expiré(s) : envois annulés et expéditeurs remboursés.`);
    } catch (err) {
      this.logger.error(`Balayage des codes expirés interrompu : ${(err as Error)?.message}`);
    } finally {
      this.running = false;
    }
    return total;
  }
}
