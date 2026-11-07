// apps/backend/src/merchants/merchant-expiry.service.ts
// =========================================================
// Balayage des demandes d'encaissement échues (chaque minute) : statut EXPIRED + notification aux deux parties.
// Même sans ce balayage, une demande échue n'est jamais payable (contrôlé à chaque paiement) : il sert à fermer les écrans et à prévenir.
// MERCHANT_EXPIRY_CRON=false le désactive sur une instance.
// =========================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { MerchantPaymentsService } from './merchant-payments.service';

@Injectable()
export class MerchantExpiryService {
  private readonly logger = new Logger(MerchantExpiryService.name);
  private running = false;

  constructor(private readonly payments: MerchantPaymentsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<number> {
    if (String(process.env.MERCHANT_EXPIRY_CRON ?? '').trim().toLowerCase() === 'false') return 0;
    if (this.running) return 0;
    this.running = true;
    try {
      const n = await this.payments.sweepExpired();
      if (n > 0) this.logger.log(`⏳ ${n} demande(s) d'encaissement expirée(s).`);
      return n;
    } catch (err) {
      this.logger.error(`Balayage des encaissements interrompu : ${(err as Error)?.message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
