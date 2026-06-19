// apps/backend/src/notifications/channels/wallet-notifier.service.ts
// =========================================================
// WALLET NOTIFIER v2.0 — Direct Transf'air
// ✅ v1.0 : notifyTransferSent, notifyTransferReceived,
//           notifyDepositReceived, notifyWithdrawal
// ✅ v2.0 : wrapper safe() + Logger
//
//   PROBLÈME v1.0 : chaque méthode faisait un await direct
//   de notificationsService.create(). En cas d'erreur Prisma
//   (enum invalide, contrainte, timeout…), l'exception remontait
//   dans transactions.service.ts et était avalée par .catch(()=>{})
//   sans aucune trace → impossible à diagnostiquer.
//
//   CORRECTIF : ajout d'un wrapper privé safe() qui :
//   - try/catch autour de chaque appel notificationsService.create()
//   - logue l'erreur via Logger (visible dans les logs backend)
//     sans jamais propager l'exception
//   Résultat : une notification qui échoue n'est plus silencieuse
//   ET ne bloque jamais le flux de transaction principal.
//
//   Signatures 100 % rétrocompatibles avec transactions.service.ts
//   (paramètres optionnels uniquement en fin de signature).
// =========================================================

import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';

@Injectable()
export class WalletNotifierService {
  private readonly logger = new Logger(WalletNotifierService.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  // ── Transfert sortant (expéditeur = USER) ────────────
  async notifyTransferSent(
    userId:        string,
    recipientName: string,
    amount:        string,
    reference?:    string,   // optionnel — rétrocompatible
  ) {
    await this.safe('notifyTransferSent', userId, () =>
      this.notificationsService.create(
        userId,
        'Transfert envoyé 💸',
        `Vous avez envoyé ${amount} à ${recipientName}.${reference ? ` Réf : ${reference}.` : ''}`,
        'SUCCESS',
        { recipientName, amount, reference },
      ),
    );
  }

  // ── Transfert entrant (destinataire = USER) ───────────
  async notifyTransferReceived(
    userId:     string,
    senderName: string,
    amount:     string,
    reference?: string,   // optionnel — rétrocompatible
  ) {
    await this.safe('notifyTransferReceived', userId, () =>
      this.notificationsService.create(
        userId,
        'Argent reçu 💰',
        `Vous avez reçu ${amount} de la part de ${senderName}.${reference ? ` Réf : ${reference}.` : ''}`,
        'SUCCESS',
        { senderName, amount, reference },
      ),
    );
  }

  // ── Dépôt agence crédité ──────────────────────────────
  async notifyDepositReceived(
    userId:      string,
    amount:      string,
    agencyName?: string,   // optionnel — rétrocompatible
  ) {
    await this.safe('notifyDepositReceived', userId, () =>
      this.notificationsService.create(
        userId,
        'Dépôt effectué ✅',
        `Votre compte a été crédité de ${amount}${agencyName ? ` par l'agence ${agencyName}` : ''}.`,
        'SUCCESS',
        { amount, agencyName },
      ),
    );
  }

  // ── Retrait espèces débité ────────────────────────────
  async notifyWithdrawal(
    userId: string,
    amount: string,
    code?:  string,   // optionnel — rétrocompatible
  ) {
    await this.safe('notifyWithdrawal', userId, () =>
      this.notificationsService.create(
        userId,
        'Retrait effectué 🏧',
        `Un retrait de ${amount} a été débité de votre compte.${code ? ` Code : ${code}.` : ''}`,
        'INFO',
        { amount, code },
      ),
    );
  }

  // ── Code de retrait disponible (Cash Pickup) ──────────
  async notifyCodeReady(
    userId:          string,
    beneficiaryName: string,
    amount:          string,
    code:            string,
  ) {
    await this.safe('notifyCodeReady', userId, () =>
      this.notificationsService.create(
        userId,
        'Code de retrait prêt 🔐',
        `Le code pour que ${beneficiaryName} retire ${amount} est disponible : ${code}.`,
        'TRANSACTION',
        { beneficiaryName, amount, code },
      ),
    );
  }

  // ── Alerte solde faible ───────────────────────────────
  async notifyLowBalance(
    userId:   string,
    balance:  string,
    currency: string,
  ) {
    await this.safe('notifyLowBalance', userId, () =>
      this.notificationsService.create(
        userId,
        'Solde faible ⚠️',
        `Votre solde est de ${balance} ${currency}. Pensez à recharger votre wallet.`,
        'WARNING',
        { balance, currency },
      ),
    );
  }

  // ── Transfert en attente ──────────────────────────────
  async notifyTransferPending(
    userId:     string,
    amount:     string,
    reference?: string,
  ) {
    await this.safe('notifyTransferPending', userId, () =>
      this.notificationsService.create(
        userId,
        'Transfert en cours ⏳',
        `Votre transfert de ${amount} est en cours de validation.${reference ? ` Réf : ${reference}.` : ''}`,
        'WARNING',
        { amount, reference },
      ),
    );
  }

  // ── Annulation / remboursement ────────────────────────
  async notifyTransferCancelled(
    userId: string,
    amount: string,
    reason?: string,
  ) {
    await this.safe('notifyTransferCancelled', userId, () =>
      this.notificationsService.create(
        userId,
        'Transfert annulé 🔁',
        `Votre transfert de ${amount} a été annulé.${reason ? ` Motif : ${reason}.` : ''} Le montant sera remboursé.`,
        'ERROR',
        { amount, reason },
      ),
    );
  }

  // ── Wrapper sécurisé — logue l'erreur, ne throw jamais ─
  // Garantit qu'une erreur de notification ne bloque jamais
  // le flux de transaction principal. Logue pour diagnostic.
  private async safe(
    method: string,
    userId: string,
    fn:     () => Promise<any>,
  ): Promise<void> {
    try {
      await fn();
    } catch (err: any) {
      this.logger.error(
        `[WalletNotifier.${method}] userId=${userId} — ${err?.message ?? err}`,
      );
    }
  }
}