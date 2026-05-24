//apps/backend/src/limits/limits.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KycLevel, TransactionStatus } from '@prisma/client';

const KYC_LABEL: Record<KycLevel, string> = {
  LEVEL_0: 'Non vérifié',
  LEVEL_1: 'KYC Niveau 1',
  LEVEL_2: 'KYC Niveau 2',
  LEVEL_3: 'KYC Complet',
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
          maxDailyTransferAmount: true,
          maxMonthlyTransferAmount: true,
          maxYearlyTransferAmount: true,
        },
      }),
    ]);

    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (!client) throw new NotFoundException('Client introuvable');

    const now = new Date();
    const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear  = new Date(now.getFullYear(), 0, 1);

    const [daily, monthly, yearly] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          senderId: userId,
          clientId,
          status: TransactionStatus.PAID,
          createdAt: { gte: startOfDay },
        },
        _sum: { total: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          senderId: userId,
          clientId,
          status: TransactionStatus.PAID,
          createdAt: { gte: startOfMonth },
        },
        _sum: { total: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          senderId: userId,
          clientId,
          status: TransactionStatus.PAID,
          createdAt: { gte: startOfYear },
        },
        _sum: { total: true },
      }),
    ]);

    return {
      currency: user.primaryCurrency,
      kycLevel: user.kycLevel,
      kycLabel: KYC_LABEL[user.kycLevel],
      limits: {
        daily: {
          used: Number(daily._sum.total   ?? 0),
          max:  Number(client.maxDailyTransferAmount   ?? 2000),
        },
        monthly: {
          used: Number(monthly._sum.total ?? 0),
          max:  Number(client.maxMonthlyTransferAmount ?? 10000),
        },
        yearly: {
          used: Number(yearly._sum.total  ?? 0),
          max:  Number(client.maxYearlyTransferAmount  ?? 50000),
        },
      },
    };
  }
}