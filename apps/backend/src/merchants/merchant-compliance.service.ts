// apps/backend/src/merchants/merchant-compliance.service.ts
// =========================================================
// CONFORMITÉ DES PAIEMENTS MARCHAND (lot 14)
// Avant ce lot, payer un commerce échappait aux plafonds par niveau KYC et au scoring AML, alors qu'un envoi y était soumis.
//   • assertWithinLimits()  : mêmes plafonds que les envois (par opération, jour, mois, année), cumul envois + paiements,
//                             contrôlé DANS la transaction SQL du règlement, sous le verrou du portefeuille du payeur.
//   • scorePayment()        : scoring AML NON bloquant (même barème que les envois : montant élevé, fractionnement, vitesse, cumul 24 h,
//                             compte récent). Renseigne Transaction.riskScore / isFlagged et crée un AmlFlag pour la conformité.
//                             Ne lève jamais : l'argent a déjà bougé, une panne de scoring ne doit pas faire échouer un paiement.
// =========================================================

import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';
import { TransferLimitsService } from '../transfer-limits/transfer-limits.service';
import { amlFlagScore, computeRiskScore } from '../transactions/aml-scoring';

type Db = Prisma.TransactionClient;

@Injectable()
export class MerchantComplianceService {
  private readonly logger = new Logger(MerchantComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: TransferLimitsService,
    private readonly rates: RatesService,
  ) {}

  /** 403 LIMIT_EXCEEDED si ce paiement dépasse les plafonds du payeur. À appeler dans la transaction SQL, après le débit. */
  assertWithinLimits(db: Db, p: { clientId: number; payerId: string; currency: string; amount: number; requestId: string }): Promise<void> {
    return this.limits.assertMerchantPaymentWithinLimits(db, { clientId: p.clientId, userId: p.payerId, currency: p.currency, amount: p.amount, excludeRequestId: p.requestId });
  }

  private async toXof(value: number, currency: string): Promise<number | null> {
    if (currency.toUpperCase() === 'XOF') return value;
    try { return await this.rates.convert(value, currency, 'XOF'); } catch { return null; }
  }

  /** Scoring AML non bloquant d'un paiement déjà réglé. */
  async scorePayment(p: { transactionId: string; requestId: string; payerId: string; amount: number; currency: string }): Promise<void> {
    try {
      const since = new Date(Date.now() - 24 * 3_600_000);
      const [recent, subject] = await Promise.all([
        this.prisma.paymentRequest.findMany({
          where: { payerId: p.payerId, status: 'PAID', id: { not: p.requestId }, paidAt: { gte: since } },
          select: { amount: true, currency: true },
          take: 200,
        }),
        this.prisma.user.findUnique({ where: { id: p.payerId }, select: { createdAt: true } }),
      ]);

      const amountXof = await this.toXof(p.amount, p.currency);
      const byCurrency = new Map<string, number>();
      for (const t of recent) byCurrency.set(String(t.currency), (byCurrency.get(String(t.currency)) ?? 0) + Number(t.amount));
      let recentSumXof24h: number | null = 0;
      for (const [cur, sum] of byCurrency) {
        const x = await this.toXof(sum, cur);
        if (x === null) { recentSumXof24h = null; break; }
        recentSumXof24h += x;
      }

      const result = computeRiskScore({
        amountXof: recentSumXof24h === null ? null : amountXof,
        recentCount24h: recent.length,
        recentSumXof24h: recentSumXof24h ?? 0,
        accountCreatedAt: subject?.createdAt ?? null,
      });
      await this.prisma.transaction.update({ where: { id: p.transactionId }, data: { riskScore: result.score, isFlagged: result.flagged } });
      if (result.flagged) {
        await this.prisma.amlFlag.create({
          data: { userId: p.payerId, transactionId: p.transactionId, reason: `Paiement marchand — ${result.reasons.join(' ; ')}`, riskScore: Math.max(result.score, 1) },
        });
        this.logger.warn(`🚩 AML — paiement marchand ${p.transactionId} signalé (score ${result.score}, seuil ${amlFlagScore()}) : ${result.reasons.join(' ; ')}`);
      }
    } catch (err) {
      this.logger.warn(`Scoring AML du paiement marchand ${p.transactionId} impossible : ${(err as Error).message}`);
    }
  }
}
