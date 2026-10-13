// apps/backend/src/limits/limits.service.ts
// =========================================================
// LIMITS SERVICE v2.0 — Direct Transf'air  (écran « Mes plafonds » du client)
// ✅ v1.0–v1.2 : version initiale, fallbacks, requestIncrease dans la classe
// ✅ v2.0 (phase 6) :
//   (1) Les plafonds affichés sont ceux qui sont réellement appliqués à l'envoi : ceux de la société pour le niveau KYC
//       du client et sa devise (TransferLimitsService), au lieu de champs Client jamais contrôlés. Les montants « utilisés »
//       comptent les mêmes envois que le contrôle (en cours ou réussis, pas seulement PAID).
//   (2) Un plafond peut être « sans limite » : max = null. Nouveau champ perTransaction (maximum d'un seul envoi).
//   (3) requestIncrease() n'était qu'un « Demande enregistrée » sans rien enregistrer : la demande est maintenant
//       envoyée en notification aux administrateurs de la société du client.
// =========================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { KycLevel } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { KycLevelName } from '../transfer-limits/transfer-limit-defaults';
import { TransferLimitsService } from '../transfer-limits/transfer-limits.service';

const KYC_LABEL: Record<KycLevel, string> = {
  LEVEL_0: 'Non vérifié',
  LEVEL_1: 'KYC Niveau 1',
  LEVEL_2: 'KYC Niveau 2',
  LEVEL_3: 'KYC Complet',
};

@Injectable()
export class LimitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transferLimits: TransferLimitsService,
  ) {}

  async getLimits(clientId: number, userId: string) {
    const [user, client] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userId, clientId },
        select: { kycLevel: true, primaryCurrency: true },
      }),
      this.prisma.client.findFirst({ where: { id: clientId }, select: { defaultCurrency: true } }),
    ]);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (!client) throw new NotFoundException('Client introuvable');

    const currency = String(user.primaryCurrency ?? client.defaultCurrency ?? 'EUR');
    const limits = await this.transferLimits.effectiveLimits(this.prisma, clientId, user.kycLevel as KycLevelName, currency);
    const usage = await this.transferLimits.usageOf(this.prisma, clientId, userId, currency);

    return {
      currency,
      kycLevel: user.kycLevel,
      kycLabel: KYC_LABEL[user.kycLevel] ?? 'Inconnu',
      perTransaction: limits.perTransaction,
      limits: {
        daily: { used: usage.daily, max: limits.daily },
        monthly: { used: usage.monthly, max: limits.monthly },
        yearly: { used: usage.yearly, max: limits.yearly },
      },
    };
  }

  /** Prévient les administrateurs de la société qu'un client demande un plafond plus élevé. */
  async requestIncrease(clientId: number, userId: string, reason: string) {
    const [user, admins] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userId, clientId },
        select: { id: true, firstName: true, lastName: true, phone: true, kycLevel: true },
      }),
      this.prisma.user.findMany({
        where: { clientId, role: 'COMPANY_ADMIN', isActive: true, deletedAt: null },
        select: { id: true },
      }),
    ]);
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.phone || 'Un client';
    if (admins.length > 0) {
      await this.prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          title: 'Demande de plafond plus élevé',
          message: `${name} (${KYC_LABEL[user.kycLevel]}) demande un plafond d'envoi plus élevé : « ${reason.trim()} »`,
          type: 'INFO' as const,
          groupKey: 'limits',
          metadata: { userId: user.id, kycLevel: user.kycLevel, reason: reason.trim() },
        })),
      });
    }
    return { message: 'Demande transmise à votre agence. Elle étudiera votre niveau de vérification.' };
  }
}
