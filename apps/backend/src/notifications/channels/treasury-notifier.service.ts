// apps/backend/src/notifications/channels/treasury-notifier.service.ts
// =========================================================
// TREASURY NOTIFIER v1.0 — Direct Transf'air
// Fichier indépendant — n'ajoute rien à WalletNotifierService,
// AgentNotifierService, CompanyNotifierService ni AdminNotifierService.
//
// Enveloppe fine autour de NotificationsService.create(), avec des
// méthodes nommées pour les 2 nouveaux flux de trésorerie agence :
//  - Remontée de fonds initiée par l'agent   (agence → société)
//  - Retrait forcé initié par l'admin        (agence → société)
// =========================================================

import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';

@Injectable()
export class TreasuryNotifierService {
  constructor(private readonly notifications: NotificationsService) {}

  // ── Remontée de fonds (agent → société) ─────────────────

  async notifyRemittanceSent(agentId: string, amountLabel: string, agencyName: string) {
    return this.notifications.create(
      agentId,
      'Remontée de fonds envoyée 📤',
      `Vous avez envoyé ${amountLabel} depuis l'agence ${agencyName} vers le compte de la société.`,
      'TRANSACTION',
    );
  }

  async notifyRemittanceReceived(
    adminId: string,
    amountLabel: string,
    agencyName: string,
    agentName: string,
  ) {
    return this.notifications.create(
      adminId,
      'Remontée de fonds reçue 💰',
      `${agentName} a envoyé ${amountLabel} depuis l'agence ${agencyName}.`,
      'TRANSACTION',
    );
  }

  // ── Retrait forcé (admin → agence) ──────────────────────

  async notifyCollectionToAgent(agentId: string, amountLabel: string, adminName: string, agencyName: string) {
    return this.notifications.create(
      agentId,
      'Retrait effectué par la société 🏦',
      `${adminName} a retiré ${amountLabel} du solde de l'agence ${agencyName}.`,
      'TRANSACTION',
    );
  }

  async notifyCollectionDone(adminId: string, amountLabel: string, agencyName: string) {
    return this.notifications.create(
      adminId,
      'Retrait agence effectué ✅',
      `Vous avez retiré ${amountLabel} depuis l'agence ${agencyName}.`,
      'TRANSACTION',
    );
  }
}