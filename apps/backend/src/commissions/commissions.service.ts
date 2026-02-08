// apps/backend/src/commissions/commissions.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import {
  CommissionSourceType,
  CommissionDestType,
  TransactionStatus,
  AgencyType,
} from '@prisma/client';

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getClientRules(clientId: number) {
    return this.prisma.commissionConfig.findMany({
      where: { clientId },
      orderBy: [{ sourceType: 'asc' }, { destType: 'asc' }],
    });
  }

  async upsertRule(clientId: number, dto: UpdateCommissionDto) {
    const platformShare = 100 - (dto.senderShare + dto.payerShare);
    if (platformShare < 0) throw new BadRequestException('Total > 100%');

    return this.prisma.commissionConfig.upsert({
      where: {
        clientId_sourceType_destType: {
          clientId,
          sourceType: dto.sourceType,
          destType: dto.destType,
        },
      },
      update: {
        senderShare: dto.senderShare,
        payerShare: dto.payerShare,
        platformShare,
      },
      create: {
        clientId,
        sourceType: dto.sourceType,
        destType: dto.destType,
        senderShare: dto.senderShare,
        payerShare: dto.payerShare,
        platformShare,
      },
    });
  }

  // ===========================
  // HISTORIQUE PAR AGENCE
  // ===========================

  async getHistory(clientId: number, agencyId: string, period: string) {
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate = new Date(0);
    }

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
        withdrawal: { include: { processedBy: { include: { agency: true } } } },
      },
    });

    const rules = await this.prisma.commissionConfig.findMany({
      where: { clientId },
    });

    const history = transactions.map((tx) => {
      let sourceT: CommissionSourceType = CommissionSourceType.WALLET;

      if (tx.sender?.agency) {
        sourceT =
          tx.sender.agency.type === AgencyType.PARTNER
            ? CommissionSourceType.PARTNER
            : CommissionSourceType.SUBSIDIARY;
      }

      let destT: CommissionDestType = CommissionDestType.SUBSIDIARY;

      if (tx.withdrawal?.processedBy?.agency) {
        destT =
          tx.withdrawal.processedBy.agency.type === AgencyType.PARTNER
            ? CommissionDestType.PARTNER
            : CommissionDestType.SUBSIDIARY;
      }

      const rule = rules.find(
        (r) => r.sourceType === sourceT && r.destType === destT,
      );

      const fees = Number(tx.fees);

      const senderCom = rule ? (fees * rule.senderShare) / 100 : 0;
      const payerCom =
        rule && tx.status === 'PAID' ? (fees * rule.payerShare) / 100 : 0;

      let myCommission = 0;

      if (tx.sender?.agencyId === agencyId) myCommission += senderCom;
      if (tx.withdrawal?.processedBy?.agencyId === agencyId)
        myCommission += payerCom;

      const origin =
        tx.sender?.agency?.name ??
        tx.withdrawal?.processedBy?.agency?.name ??
        'Client Wallet';

      return {
        id: tx.id,
        createdAt: tx.createdAt,
        origin,
        amount: Number(tx.amount),
        fees,
        myCommission,
        agencyCommission: myCommission,
      };
    });

    return history;
  }

  // ===========================
  // STATS AGENT
  // ===========================

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
}
