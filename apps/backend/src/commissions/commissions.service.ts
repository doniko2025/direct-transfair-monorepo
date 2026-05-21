// apps/backend/src/commissions/commissions.service.ts
// =========================================================
// COMMISSIONS SERVICE v4.2
// ✅ FIX CRITIQUE : withdrawal include processedBy + agency
//    Avant : processedBy n'était pas chargé → agencyId = undefined
//    → myCommission = 0 même si l'agent avait validé le retrait
// ✅ FIX : recherche par processedById direct (plus fiable)
//    si la relation processedBy ne retourne rien
// ✅ Reste identique à v4.1 sinon
// =========================================================

import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AgencyType,
  CommissionDestType,
  CommissionSourceType,
  TransactionStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { UpdateCommissionDto } from './dto/update-commission.dto';

const DEFAULT_PAYER_SHARE    = 40;
const DEFAULT_SENDER_SHARE   = 20;
const DEFAULT_PLATFORM_SHARE = 40;

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ========================================================
  // RÈGLES
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
  // HISTORIQUE PAR AGENCE
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
          // ✅ FIX : chercher par processedById aussi (agent de l'agence)
          {
            withdrawal: {
              processedBy: { agencyId },
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { include: { agency: true } },
        // ✅ FIX CRITIQUE : inclure processedBy + agency dans le include
        withdrawal: {
          include: {
            processedBy: {
              include: { agency: true },
            },
          },
        },
      },
    });

    const rules = await this.prisma.commissionConfig.findMany({
      where: { clientId },
    });

    // ✅ FIX : récupérer les agents de cette agence pour matching par processedById
    const agencyAgents = await this.prisma.user.findMany({
      where: { agencyId },
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

      const rule = rules.find((r) => r.sourceType === sourceT && r.destType === destT);
      const fees = Number(tx.fees);

      const senderShare = rule ? rule.senderShare : DEFAULT_SENDER_SHARE;
      const senderCom   = (fees * senderShare) / 100;

      const payerShare = rule ? rule.payerShare : DEFAULT_PAYER_SHARE;
      const txStatus   = tx.status as string;
      const payerCom   =
        txStatus === TransactionStatus.PAID || txStatus === TransactionStatus.VALIDATED
          ? (fees * payerShare) / 100
          : 0;

      let myCommission = 0;

      // Commission expéditeur : l'agent qui a envoyé appartient à cette agence
      if (tx.sender?.agencyId === agencyId) {
        myCommission += senderCom;
      }

      // ✅ FIX : commission payeur — vérifier via relation ET via agencyAgentIds
      const processedById = (tx.withdrawal as any)?.processedById;
      const processedByAgencyId = (tx.withdrawal as any)?.processedBy?.agencyId;

      const isProcessedByThisAgency =
        processedByAgencyId === agencyId ||
        (processedById && agencyAgentIds.has(processedById));

      if (isProcessedByThisAgency) {
        myCommission += payerCom;
      }

      // Fallback : si aucune commission mais agence impliquée
      if (myCommission === 0 && fees > 0) {
        if (isProcessedByThisAgency)
          myCommission = (fees * DEFAULT_PAYER_SHARE) / 100;
        else if (tx.sender?.agencyId === agencyId)
          myCommission = (fees * DEFAULT_SENDER_SHARE) / 100;
      }

      const origin =
        tx.sender?.agency?.name ??
        processedByAgency?.name ??
        'Client Wallet';

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