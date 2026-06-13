// apps/backend/src/commissions/commissions.service.ts
// =========================================================
// COMMISSIONS SERVICE v4.3
// ✅ v4.2 : withdrawal include processedBy + agency
// ✅ v4.3 :
//    - getFeeRate()      : lit le taux dynamique par méthode de paiement
//    - upsertFeeConfig() : sauvegarde le taux configuré par l'admin
//    → Fin du taux hardcodé 0.015 dans transactions.service.ts
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

// ── Mapping payoutMethod → slot de devise (contournement contrainte unique) ──
// On utilise la colonne currency comme discriminant pour que chaque
// fee config ait un (clientId, WALLET, SUBSIDIARY, currency) unique.
// Aucune migration de contrainte nécessaire.
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

  /**
   * Retourne le taux de frais configuré par l'admin pour une méthode de paiement.
   * Appelé par TransactionsService.create() à chaque création de transaction.
   *
   * @param clientId  ID de la société cliente
   * @param payoutMethod  ex: "CASH_PICKUP", "BANK_DEPOSIT", "MOBILE_MONEY", "IBAN_TRANSFER"
   * @returns { rate: number, fixedFee: number }
   *   rate     = pourcentage (ex: 1.5 pour 1.5%)
   *   fixedFee = montant fixe en devise locale (ex: 200 pour 200 XOF)
   */
  async getFeeRate(
    clientId: number,
    payoutMethod: string,
  ): Promise<{ rate: number; fixedFee: number }> {
    // Wallet/MobileMoney toujours gratuit
    if (!payoutMethod || payoutMethod === 'WALLET' || payoutMethod === 'MOBILE_MONEY') {
      return { rate: 0, fixedFee: 0 };
    }

    try {
      const config = await this.prisma.commissionConfig.findFirst({
        where: {
          clientId,
          payoutMethod,
          isActive: true,
        },
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

    // Fallback : 1.5% si aucune config admin en base
    return { rate: 1.5, fixedFee: 0 };
  }

  /**
   * Crée ou met à jour la config de frais pour une méthode de paiement.
   * Appelé depuis CommissionsController.updateRule() quand dto.payoutMethod est présent.
   */
  async upsertFeeConfig(
    clientId: number,
    payoutMethod: string,
    feeRate: number,
    fixedFee: number,
  ) {
    const currency = PAYOUT_CURRENCY_SLOT[payoutMethod] ?? null;

    // Chercher une config existante pour ce payoutMethod
    const existing = await this.prisma.commissionConfig.findFirst({
      where: { clientId, payoutMethod },
    });

    if (existing) {
      return this.prisma.commissionConfig.update({
        where: { id: existing.id },
        data: {
          senderShare:   feeRate,
          platformShare: Math.max(0, 100 - feeRate),
          description:   `FEE:${payoutMethod}`,
          // Colonnes ajoutées par la migration
          ...(Object.fromEntries([
            ['feeRate',  feeRate],
            ['fixedFee', fixedFee],
            ['payoutMethod', payoutMethod],
          ])),
        },
      });
    }

    return this.prisma.commissionConfig.create({
      data: {
        clientId,
        sourceType:    CommissionSourceType.WALLET,
        destType:      CommissionDestType.SUBSIDIARY,
        currency:      currency as CurrencyCode | undefined,
        senderShare:   feeRate,
        payerShare:    0,
        platformShare: Math.max(0, 100 - feeRate),
        description:   `FEE:${payoutMethod}`,
        // Colonnes ajoutées par la migration
        ...(Object.fromEntries([
          ['feeRate',  feeRate],
          ['fixedFee', fixedFee],
          ['payoutMethod', payoutMethod],
        ])),
      },
    });
  }

  // ========================================================
  // RÈGLES de répartition de commission (existant)
  // ========================================================

  async getClientRules(clientId: number) {
    return this.prisma.commissionConfig.findMany({
      where: { clientId },
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
        data: { senderShare: dto.senderShare, payerShare: dto.payerShare, platformShare },
      });
    }
    return this.prisma.commissionConfig.create({
      data: { clientId, sourceType: dto.sourceType, destType: dto.destType, senderShare: dto.senderShare, payerShare: dto.payerShare, platformShare },
    });
  }

  // ========================================================
  // HISTORIQUE PAR AGENCE (identique v4.2)
  // ========================================================

  async getHistory(clientId: number, agencyId: string, period: string) {
    const startDate = this.getPeriodStart(period);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        clientId,
        status: { in: [TransactionStatus.VALIDATED, TransactionStatus.PAID] },
        createdAt: { gte: startDate },
        OR: [
          { sender: { agencyId } },
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

      // Exclure les fee configs de la recherche de règle de répartition
      const rule = rules.find((r) =>
        r.sourceType === sourceT &&
        r.destType   === destT &&
        !(r as any).payoutMethod, // ← ignorer les fee configs
      );
      const fees = Number(tx.fees);

      const senderShare = rule ? rule.senderShare : DEFAULT_SENDER_SHARE;
      const senderCom   = (fees * senderShare) / 100;

      const payerShare  = rule ? rule.payerShare : DEFAULT_PAYER_SHARE;
      const txStatus    = tx.status as string;
      const payerCom    =
        txStatus === TransactionStatus.PAID || txStatus === TransactionStatus.VALIDATED
          ? (fees * payerShare) / 100 : 0;

      let myCommission = 0;

      if (tx.sender?.agencyId === agencyId) {
        myCommission += senderCom;
      }

      const processedById      = (tx.withdrawal as any)?.processedById;
      const processedByAgencyId = (tx.withdrawal as any)?.processedBy?.agencyId;
      const isProcessedByThisAgency =
        processedByAgencyId === agencyId ||
        (processedById && agencyAgentIds.has(processedById));

      if (isProcessedByThisAgency) {
        myCommission += payerCom;
      }

      if (myCommission === 0 && fees > 0) {
        if (isProcessedByThisAgency) myCommission = (fees * DEFAULT_PAYER_SHARE) / 100;
        else if (tx.sender?.agencyId === agencyId) myCommission = (fees * DEFAULT_SENDER_SHARE) / 100;
      }

      const origin = tx.sender?.agency?.name ?? processedByAgency?.name ?? 'Client Wallet';

      return {
        id:               tx.id,
        createdAt:        tx.createdAt,
        origin,
        amount:           Number(tx.amount),
        currency:         tx.currency,
        fees,
        myCommission,
        agencyCommission: myCommission,
      };
    });
  }

  // ========================================================
  // STATS AGENT (identique v4.2)
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