// apps/backend/src/merchants/merchant-alerts.service.ts
// =========================================================
// ALERTES DU MARCHAND (lot 13) — le marchand est prévenu sans avoir à surveiller l'application.
//   • Solde bas       : quand le solde du commerce passe sous le seuil qu'il a choisi (une seule alerte, réarmée quand le solde remonte).
//   • Échecs répétés  : quand plusieurs règlements échouent en peu de temps (solde client insuffisant, portefeuille gelé…) — souvent le signe
//                       d'un souci de caisse (mauvais montant, client sans fonds) ou d'une tentative suspecte.
//   • Retrait refusé  : déjà géré par le service des retraits (PAYOUT_REJECTED / PAYOUT_FAILED).
// Ne lève JAMAIS : une alerte ratée ne doit pas faire échouer un paiement, un remboursement ou un retrait.
// =========================================================

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { FAILURE_ALERT_COOLDOWN_HOURS, FAILURE_ALERT_THRESHOLD, FAILURE_ALERT_WINDOW_MINUTES, lowBalanceDecision, shouldAlertFailures } from './merchant-extras';
import { formatMoney, MerchantNotifierService } from './merchant-notifier.service';

@Injectable()
export class MerchantAlertsService {
  private readonly logger = new Logger(MerchantAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: MerchantNotifierService,
  ) {}

  /**
   * À appeler après tout mouvement du portefeuille du commerce (retrait, remboursement, encaissement, retrait refusé).
   * Seule la devise du compte est surveillée : c'est celle du seuil.
   */
  async onBalanceChanged(merchantProfileId: string, currency: string): Promise<void> {
    try {
      const p = await this.prisma.merchantProfile.findUnique({
        where: { id: merchantProfileId },
        select: { id: true, userId: true, lowBalanceThreshold: true, lowBalanceNotifiedAt: true, user: { select: { id: true, email: true, firstName: true, primaryCurrency: true } } },
      });
      if (!p) return;
      const notified = !!p.lowBalanceNotifiedAt;
      if (p.lowBalanceThreshold === null && !notified) return;
      if (String(p.user.primaryCurrency ?? '') !== currency) return;

      const wallet = await this.prisma.wallet.findFirst({ where: { merchantId: p.id, currency: currency as never }, select: { balance: true, reservedBalance: true } });
      const available = wallet ? Number(wallet.balance) - Number(wallet.reservedBalance) : 0;
      const threshold = p.lowBalanceThreshold === null ? null : Number(p.lowBalanceThreshold);
      const decision = lowBalanceDecision(available, threshold, notified);

      if (decision === 'REARM') {
        await this.prisma.merchantProfile.updateMany({ where: { id: p.id, lowBalanceNotifiedAt: { not: null } }, data: { lowBalanceNotifiedAt: null } });
        return;
      }
      if (decision !== 'ALERT') return;
      // Prise atomique : deux mouvements simultanés n'envoient qu'une alerte.
      const claimed = await this.prisma.merchantProfile.updateMany({ where: { id: p.id, lowBalanceNotifiedAt: null }, data: { lowBalanceNotifiedAt: new Date() } });
      if (claimed.count !== 1) return;
      await this.notifier.notifyUser(p.user, {
        kind: 'LOW_BALANCE',
        title: 'Solde du commerce bas',
        body: `Le solde de votre commerce est de ${formatMoney(available, currency)}, sous votre seuil de ${formatMoney(threshold ?? 0, currency)}. Gardez de quoi rembourser vos clients.`,
        actionUrl: '/merchant/settings',
        actionLabel: 'Réglages du commerce',
        type: 'WARNING',
        email: false,
      });
    } catch (err) {
      this.logger.warn(`Alerte solde bas impossible (${merchantProfileId}) : ${(err as Error).message}`);
    }
  }

  /** À appeler après un règlement échoué (le compteur `failedAttempts` de la demande est déjà incrémenté). */
  async onPaymentFailed(payeeUserId: string): Promise<void> {
    try {
      const p = await this.prisma.merchantProfile.findUnique({
        where: { userId: payeeUserId },
        select: { id: true, failureAlertsEnabled: true, failureAlertedAt: true, user: { select: { id: true, email: true, firstName: true } } },
      });
      if (!p || !p.failureAlertsEnabled) return;
      const now = new Date();
      const since = new Date(now.getTime() - FAILURE_ALERT_WINDOW_MINUTES * 60_000);
      const agg = await this.prisma.paymentRequest.aggregate({ where: { payeeId: payeeUserId, failedAttempts: { gt: 0 }, updatedAt: { gte: since } }, _sum: { failedAttempts: true } });
      const failures = Number(agg._sum.failedAttempts ?? 0);
      if (!shouldAlertFailures({ failures, enabled: p.failureAlertsEnabled, alertedAt: p.failureAlertedAt, now })) return;
      const cooldownStart = new Date(now.getTime() - FAILURE_ALERT_COOLDOWN_HOURS * 3_600_000);
      const claimed = await this.prisma.merchantProfile.updateMany({
        where: { id: p.id, OR: [{ failureAlertedAt: null }, { failureAlertedAt: { lt: cooldownStart } }] },
        data: { failureAlertedAt: now },
      });
      if (claimed.count !== 1) return;
      await this.notifier.notifyUser(p.user, {
        kind: 'PAYMENT_FAILURES',
        title: `${failures} paiements échoués en ${FAILURE_ALERT_WINDOW_MINUTES} min`,
        body: `Plusieurs règlements de vos clients n'ont pas abouti (solde insuffisant ou portefeuille bloqué). Vérifiez les montants demandés et rappelez à vos clients de recharger. Seuil d'alerte : ${FAILURE_ALERT_THRESHOLD}.`,
        actionUrl: '/merchant/payments',
        actionLabel: 'Paiements encaissés',
        type: 'WARNING',
        email: false,
      });
    } catch (err) {
      this.logger.warn(`Alerte échecs de paiement impossible (${payeeUserId}) : ${(err as Error).message}`);
    }
  }
}
