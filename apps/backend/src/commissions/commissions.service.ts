// apps/backend/src/commissions/commissions.service.ts
// =========================================================
// COMMISSIONS SERVICE v4.0
// ✅ upsert corrigé — contrainte unique sans currency (null non supporté dans @@unique)
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

    // ✅ CORRECTION : le champ currency est optionnel dans le schéma.
    // On utilise findFirst + update/create plutôt que upsert avec contrainte null.
    const existing = await this.prisma.commissionConfig.findFirst({
      where: {
        clientId,
        sourceType: dto.sourceType,
        destType: dto.destType,
        currency: null,
      },
    });

    if (existing) {
      return this.prisma.commissionConfig.update({
        where: { id: existing.id },
        data: {
          senderShare: dto.senderShare,
          payerShare: dto.payerShare,
          platformShare,
        },
      });
    }

    return this.prisma.commissionConfig.create({
      data: {
        clientId,
        sourceType: dto.sourceType,
        destType: dto.destType,
        senderShare: dto.senderShare,
        payerShare: dto.payerShare,
        platformShare,
      },
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
          { withdrawal: { processedBy: { agencyId } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { include: { agency: true } },
        withdrawal: {
          include: {
            processedBy: { include: { agency: true } },
          },
        },
      },
    });

    const rules = await this.prisma.commissionConfig.findMany({
      where: { clientId },
    });

    return transactions.map((tx) => {
      let sourceT: CommissionSourceType = CommissionSourceType.WALLET;
      if (tx.sender?.agency) {
        sourceT =
          tx.sender.agency.type === AgencyType.PARTNER
            ? CommissionSourceType.PARTNER
            : CommissionSourceType.SUBSIDIARY;
      }

      let destT: CommissionDestType = CommissionDestType.SUBSIDIARY;
      const processedByAgency = (tx.withdrawal as any)?.processedBy?.agency;
      if (processedByAgency) {
        destT =
          processedByAgency.type === AgencyType.PARTNER
            ? CommissionDestType.PARTNER
            : CommissionDestType.SUBSIDIARY;
      }

      const rule = rules.find(
        (r) => r.sourceType === sourceT && r.destType === destT,
      );
      const fees = Number(tx.fees);

      const senderCom = rule ? (fees * rule.senderShare) / 100 : 0;
      const payerCom =
        rule && tx.status === TransactionStatus.PAID
          ? (fees * rule.payerShare) / 100
          : 0;

      let myCommission = 0;
      if (tx.sender?.agencyId === agencyId) myCommission += senderCom;
      if ((tx.withdrawal as any)?.processedBy?.agencyId === agencyId)
        myCommission += payerCom;

      const origin =
        tx.sender?.agency?.name ??
        processedByAgency?.name ??
        'Client Wallet';

      return {
        id: tx.id,
        createdAt: tx.createdAt,
        origin,
        amount: Number(tx.amount),
        currency: tx.currency,
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

    const totalCommissions = history.reduce(
      (sum, h) => sum + h.agencyCommission,
      0,
    );
    const totalVolume = history.reduce((sum, h) => sum + h.amount, 0);

    return {
      todayCommissions,
      totalCommissions,
      totalVolume,
      count: history.length,
      history,
    };
  }

  // ========================================================
  // HELPER
  // ========================================================

  private getPeriodStart(period: string): Date {
    const now = new Date();
    const d = new Date(now);

    switch (period) {
      case 'day':
        d.setHours(0, 0, 0, 0);
        break;
      case 'week':
        d.setDate(now.getDate() - 7);
        break;
      case 'month':
        d.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        d.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        d.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return new Date(0);
    }
    return d;
  }
}