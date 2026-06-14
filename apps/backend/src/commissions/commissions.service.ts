// apps/backend/src/commissions/commissions.service.ts
// =========================================================
// COMMISSIONS SERVICE v4.4
// ✅ v4.2 : withdrawal include processedBy + agency
// ✅ v4.3 :
//    - getFeeRate()      : lit le taux dynamique par méthode de paiement
//    - upsertFeeConfig() : sauvegarde le taux configuré par l'admin
// ✅ v4.4 : FIX commission affichée = 0 malgré versement réel
//
//   PROBLÈME :
//     getHistory() calculait la commission sur tx.fees EN DEVISE SOURCE
//     (ex: 1 XOF). Pour une transaction XOF→GNF :
//       senderCom = (1 XOF * 20%) = 0.20 XOF → arrondi à 0
//       payerCom  = (1 XOF * 40%) = 0.40 XOF → arrondi à 0
//     Affiché : +0 XOF ❌
//     Alors que le vrai versement (withdrawals.service.ts) était en GNF :
//       feesConverted ≈ 14.4 GNF → payerCom = 5.76 GNF ≈ 6 GNF ✅
//
//   CORRECTIF :
//     Conversion des frais en devise payout via tx.exchangeRate (déjà
//     stocké sur la transaction) avant tout calcul de commission.
//     Si pas de conversion nécessaire (même devise), inchangé.
// =========================================================

import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AgencyType,
  CommissionDestType,
  CommissionSourceType,
  CurrencyCode,
  TransactionStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { UpdateCommissionDto } from './dto/update-commission.dto';

const DEFAULT_PAYER_SHARE    = 40;
const DEFAULT_SENDER_SHARE   = 20;
const DEFAULT_PLATFORM_SHARE = 40;

// ── Mapping payoutMethod → slot de devise ─────────────────
const PAYOUT_CURRENCY_SLOT: Record<string, CurrencyCode> = {
  CASH_PICKUP:   CurrencyCode.XOF,
  BANK_DEPOSIT:  CurrencyCode.EUR,
  MOBILE_MONEY:  CurrencyCode.GNF,
  IBAN_TRANSFER: CurrencyCode.USD,
};

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ========================================================
  // FEE CONFIG — lire / écrire un taux de frais par méthode
  // ========================================================

  async getFeeRate(
    clientId: number,
    payoutMethod: string,
  ): Promise<{ rate: number; fixedFee: number }> {
    if (!payoutMethod || payoutMethod === 'WALLET' || payoutMethod === 'MOBILE_MONEY') {
      return { rate: 0, fixedFee: 0 };
    }

    try {
      const config = await this.prisma.commissionConfig.findFirst({
        where: { clientId, payoutMethod, isActive: true },
      });
      if (config) {
        return {
          rate:     (config as any).feeRate   ?? 1.5,
          fixedFee: (config as any).fixedFee  ?? 0,
        };
      }
    } catch {
      // Colonne pas encore migrée → fallback
    }

    return { rate: 1.5, fixedFee: 0 };
  }

  async upsertFeeConfig(
    clientId: number,
    payoutMethod: string,
    feeRate: number,
    fixedFee: number,
  ) {
    const currency = PAYOUT_CURRENCY_SLOT[payoutMethod] ?? null;

    const existing = await this.prisma.commissionConfig.findFirst({
      where: { clientId, payoutMethod },
    });

    if (existing) {
      return this.prisma.commissionConfig.update({
        where: { id: existing.id },
        data: {
          isActive:      true,
          senderShare:   feeRate,
          platformShare: Math.max(0, 100 - feeRate),
          description:   `FEE:${payoutMethod}`,
          ...(Object.fromEntries([
            ['feeRate',      feeRate],
            ['fixedFee',     fixedFee],
            ['payoutMethod', payoutMethod],
          ])),
        },
      });
    }

    return this.prisma.commissionConfig.create({
      data: {
        isActive:      true,
        clientId,
        sourceType:    CommissionSourceType.WALLET,
        destType:      CommissionDestType.SUBSIDIARY,
        currency:      currency as CurrencyCode | undefined,
        senderShare:   feeRate,
        payerShare:    0,
        platformShare: Math.max(0, 100 - feeRate),
        description:   `FEE:${payoutMethod}`,
        ...(Object.fromEntries([
          ['feeRate',      feeRate],
          ['fixedFee',     fixedFee],
          ['payoutMethod', payoutMethod],
        ])),
      },
    });
  }

  // ========================================================
  // RÈGLES de répartition (split rules)
  // ========================================================

  async getClientRules(clientId: number) {
    return this.prisma.commissionConfig.findMany({
      where:   { clientId },
      include: { tiers: true },
      orderBy: [{ sourceType: 'asc' }, { destType: 'asc' }],
    });
  }

  async upsertRule(clientId: number, dto: UpdateCommissionDto) {
    const platformShare = 100 - (dto.senderShare + dto.payerShare);
    if (platformShare < 0) {
      throw new BadRequestException('La somme des parts ne peut pas dépasser 100%');
    }
    const existing = await this.prisma.commissionConfig.findFirst({
      where: { clientId, sourceType: dto.sourceType, destType: dto.destType, currency: null },
    });
    if (existing) {
      return this.prisma.commissionConfig.update({
        where: { id: existing.id },
        data:  { senderShare: dto.senderShare, payerShare: dto.payerShare, platformShare },
      });
    }
    return this.prisma.commissionConfig.create({
      data: { clientId, sourceType: dto.sourceType, destType: dto.destType, senderShare: dto.senderShare, payerShare: dto.payerShare, platformShare },
    });
  }

  // ========================================================
  // HISTORIQUE PAR AGENCE
  // ========================================================

  async getHistory(clientId: number, agencyId: string, period: string) {
    const startDate = this.getPeriodStart(period);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        clientId,
        status:    { in: [TransactionStatus.VALIDATED, TransactionStatus.PAID] },
        createdAt: { gte: startDate },
        OR: [
          { sender:     { agencyId } },
          { withdrawal: { processedBy: { agencyId } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { include: { agency: true } },
        withdrawal: {
          include: { processedBy: { include: { agency: true } } },
        },
      },
    });

    const rules = await this.prisma.commissionConfig.findMany({
      where: { clientId },
    });

    const agencyAgents = await this.prisma.user.findMany({
      where:  { agencyId },
      select: { id: true },
    });
    const agencyAgentIds = new Set(agencyAgents.map((u) => u.id));

    return transactions.map((tx) => {
      let sourceT: CommissionSourceType = CommissionSourceType.WALLET;
      if (tx.sender?.agency) {
        sourceT = tx.sender.agency.type === AgencyType.PARTNER
          ? CommissionSourceType.PARTNER
          : CommissionSourceType.SUBSIDIARY;
      }

      let destT: CommissionDestType = CommissionDestType.SUBSIDIARY;
      const processedByAgency = (tx.withdrawal as any)?.processedBy?.agency;
      if (processedByAgency) {
        destT = processedByAgency.type === AgencyType.PARTNER
          ? CommissionDestType.PARTNER
          : CommissionDestType.SUBSIDIARY;
      }

      // Exclure les fee configs — on veut la split rule uniquement
      const rule = rules.find((r) =>
        r.sourceType === sourceT &&
        r.destType   === destT &&
        !(r as any).payoutMethod,
      );

      // ── Frais en devise source ────────────────────────
      const fees = Number(tx.fees);

      // ✅ FIX v4.4 : conversion des frais en devise payout (targetCurrency)
      //
      // AVANT : commission = fees (XOF) * share% → 1 XOF * 40% = 0.4 → affiché 0
      // APRÈS : feesConverted = fees * exchangeRate → 1 XOF * 14.4 = 14.4 GNF
      //         commission = 14.4 GNF * 40% = 5.76 GNF ✅
      //
      // tx.exchangeRate est le taux source→payout stocké à la création
      // de la transaction (ex: XOF→GNF = 14.4000).
      // Si la devise source = devise payout → pas de conversion.
      const payoutCurrency: string = (tx as any).targetCurrency ?? tx.currency;
      let feesConverted = fees;

      if (fees > 0 && tx.currency !== payoutCurrency && (tx as any).exchangeRate) {
        feesConverted = fees * Number((tx as any).exchangeRate);
      }

      // ── Calcul des parts sur les frais convertis ──────
      const senderShare = rule ? rule.senderShare : DEFAULT_SENDER_SHARE;
      const senderCom   = (feesConverted * senderShare) / 100;

      const payerShare = rule ? rule.payerShare : DEFAULT_PAYER_SHARE;
      const txStatus   = tx.status as string;
      const payerCom   =
        txStatus === TransactionStatus.PAID || txStatus === TransactionStatus.VALIDATED
          ? (feesConverted * payerShare) / 100
          : 0;

      // ── Attribution à l'agence ────────────────────────
      let myCommission = 0;

      if (tx.sender?.agencyId === agencyId) {
        myCommission += senderCom;
      }

      const processedById       = (tx.withdrawal as any)?.processedById;
      const processedByAgencyId = (tx.withdrawal as any)?.processedBy?.agencyId;
      const isProcessedByThisAgency =
        processedByAgencyId === agencyId ||
        (processedById && agencyAgentIds.has(processedById));

      if (isProcessedByThisAgency) {
        myCommission += payerCom;
      }

      // Fallback si aucune règle trouvée mais frais présents
      if (myCommission === 0 && feesConverted > 0) {
        if (isProcessedByThisAgency) {
          myCommission = (feesConverted * DEFAULT_PAYER_SHARE) / 100;
        } else if (tx.sender?.agencyId === agencyId) {
          myCommission = (feesConverted * DEFAULT_SENDER_SHARE) / 100;
        }
      }

      const origin = tx.sender?.agency?.name ?? processedByAgency?.name ?? 'Client Wallet';

      return {
        id:                 tx.id,
        createdAt:          tx.createdAt,
        origin,
        amount:             Number(tx.amount),
        currency:           tx.currency,           // devise source (pour le volume)
        fees,                                       // frais en devise source
        feesConverted,                              // frais en devise payout (pour info)
        commissionCurrency: payoutCurrency,         // devise de la commission
        myCommission,
        agencyCommission:   myCommission,
      };
    });
  }

  // ========================================================
  // STATS AGENT
  // ========================================================

  async getMyStats(clientId: number, agencyId: string, period: string) {
    const history = await this.getHistory(clientId, agencyId, period);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayCommissions = history
      .filter((h) => new Date(h.createdAt) >= todayStart)
      .reduce((sum, h) => sum + h.agencyCommission, 0);

    const totalCommissions = history.reduce((sum, h) => sum + h.agencyCommission, 0);
    const totalVolume      = history.reduce((sum, h) => sum + h.amount, 0);

    return {
      todayCommissions,
      totalCommissions,
      totalVolume,
      count:   history.length,
      history,
    };
  }

  // ========================================================
  // HELPER
  // ========================================================

  private getPeriodStart(period: string): Date {
    const now = new Date();
    const d   = new Date(now);
    switch (period) {
      case 'day':     d.setHours(0, 0, 0, 0);               break;
      case 'week':    d.setDate(now.getDate() - 7);          break;
      case 'month':   d.setMonth(now.getMonth() - 1);        break;
      case 'quarter': d.setMonth(now.getMonth() - 3);        break;
      case 'year':    d.setFullYear(now.getFullYear() - 1);  break;
      default:        return new Date(0);
    }
    return d;
  }
}