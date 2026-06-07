// apps/backend/src/limits/limits.service.ts
// =========================================================
// LIMITS SERVICE v1.1 — Direct Transf'air
// ✅ v1.0 : version initiale
// ✅ v1.1 :
//   - Fallback currency → 'EUR' si primaryCurrency est null
//     (utilisateur créé avant l'ajout du champ, ou pays manquant)
//     Sans ce fallback, Intl.NumberFormat côté frontend plante
//     avec une devise undefined
//   - Fallback maxDaily/Monthly/Yearly → valeurs par défaut
//     si les champs Client sont null (client créé avant v5.0)
//   - Agrégat sur `amount` (montant transféré) et non `total`
//     (total = amount + fees) — les plafonds réglementaires
//     s'appliquent au montant envoyé, pas aux frais
// =========================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KycLevel, TransactionStatus } from '@prisma/client';

const KYC_LABEL: Record<KycLevel, string> = {
  LEVEL_0: 'Non vérifié',
  LEVEL_1: 'KYC Niveau 1',
  LEVEL_2: 'KYC Niveau 2',
  LEVEL_3: 'KYC Complet',
};

// Limites par défaut si les champs Client ne sont pas renseignés
const DEFAULT_LIMITS = {
  daily:   2_000,
  monthly: 10_000,
  yearly:  50_000,
};

@Injectable()
export class LimitsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLimits(clientId: number, userId: string) {
    const [user, client] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userId, clientId },
        select: { kycLevel: true, primaryCurrency: true },
      }),
      this.prisma.client.findFirst({
        where: { id: clientId },
        select: {
          maxDailyTransferAmount:   true,
          maxMonthlyTransferAmount: true,
          maxYearlyTransferAmount:  true,
        },
      }),
    ]);

    if (!user)   throw new NotFoundException('Utilisateur introuvable');
    if (!client) throw new NotFoundException('Client introuvable');

    const now          = new Date();
    const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear  = new Date(now.getFullYear(), 0, 1);

    const baseWhere = {
      senderId: userId,
      clientId,
      status:   TransactionStatus.PAID,
    } as const;

    const [daily, monthly, yearly] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...baseWhere, createdAt: { gte: startOfDay } },
        // ✅ v1.1 : `amount` (montant envoyé) et non `total` (amount + fees)
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...baseWhere, createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...baseWhere, createdAt: { gte: startOfYear } },
        _sum: { amount: true },
      }),
    ]);

    return {
      // ✅ v1.1 : fallback 'EUR' si primaryCurrency est null
      // (utilisateur sans pays renseigné ou créé avant le champ)
      currency: user.primaryCurrency ?? 'EUR',

      kycLevel: user.kycLevel,
      kycLabel: KYC_LABEL[user.kycLevel] ?? 'Inconnu',

      limits: {
        daily: {
          used: Number(daily._sum.amount   ?? 0),
          // ✅ v1.1 : fallback si le champ Client n'est pas renseigné
          max:  Number(client.maxDailyTransferAmount   ?? DEFAULT_LIMITS.daily),
        },
        monthly: {
          used: Number(monthly._sum.amount ?? 0),
          max:  Number(client.maxMonthlyTransferAmount ?? DEFAULT_LIMITS.monthly),
        },
        yearly: {
          used: Number(yearly._sum.amount  ?? 0),
          max:  Number(client.maxYearlyTransferAmount  ?? DEFAULT_LIMITS.yearly),
        },
      },
    };
  }
}