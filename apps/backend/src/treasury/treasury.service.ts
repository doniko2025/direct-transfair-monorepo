// apps/backend/src/treasury/treasury.service.ts
// =========================================================
// TREASURY SERVICE v5.2 — Direct Transf'air
// ✅ Snapshot quotidien par devise (5 devises)
// ✅ Vue globale Super Admin (toutes sociétés)
// ✅ Vue Company Admin (sa société)
// ✅ Injection / Retrait de fonds (Super Admin + Company Admin)
// ✅ Auto-alimentation Company Admin (toutes devises)
// ✅ Cron job quotidien à minuit
// ✅ FIX: isActive → subscriptionStatus sur le modèle Client
// =========================================================

import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, SubscriptionStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';
import { WalletsService } from '../wallets/wallets.service';

const SUPPORTED_CURRENCIES = ['XOF', 'EUR', 'USD', 'GNF', 'GBP'];

// =========================================================
// TYPES
// =========================================================

export interface TreasuryOverviewItem {
  currency: string;
  symbol: string;
  balance: number;
  reservedBalance: number;
  availableBalance: number;
  totalSentToday: number;
  totalReceivedToday: number;
  totalFeesToday: number;
  transactionCountToday: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  GNF: 'FG',
  XOF: 'CFA',
};

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class TreasuryService {
  private readonly logger = new Logger(TreasuryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: RatesService,
    private readonly walletsService: WalletsService,
  ) {}

  // ========================================================
  // VUE TEMPS RÉEL — Super Admin (toutes sociétés)
  // ========================================================

  async getGlobalOverview(): Promise<TreasuryOverviewItem[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results: TreasuryOverviewItem[] = [];

    for (const currency of SUPPORTED_CURRENCIES) {
      const walletAgg = await this.prisma.wallet.aggregate({
        where: { clientId: { not: null }, currency, isActive: true },
        _sum: { balance: true, reservedBalance: true },
      });

      const balance = Number(walletAgg._sum.balance ?? 0);
      const reserved = Number(walletAgg._sum.reservedBalance ?? 0);

      const txStats = await this.prisma.transaction.groupBy({
        by: ['currency'],
        where: {
          currency,
          createdAt: { gte: today },
          status: { in: ['PAID', 'VALIDATED', 'PENDING', 'PROCESSING'] },
        },
        _sum: { amount: true, fees: true },
        _count: { id: true },
      });

      const txStat = txStats[0];

      results.push({
        currency,
        symbol: CURRENCY_SYMBOLS[currency] ?? currency,
        balance,
        reservedBalance: reserved,
        availableBalance: balance - reserved,
        totalSentToday: Number(txStat?._sum.amount ?? 0),
        totalReceivedToday: 0,
        totalFeesToday: Number(txStat?._sum.fees ?? 0),
        transactionCountToday: txStat?._count.id ?? 0,
      });
    }

    return results;
  }

  // ========================================================
  // VUE TEMPS RÉEL — Company Admin (sa société)
  // ========================================================

  async getClientOverview(clientId: number): Promise<TreasuryOverviewItem[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results: TreasuryOverviewItem[] = [];

    for (const currency of SUPPORTED_CURRENCIES) {
      const walletAgg = await this.prisma.wallet.aggregate({
        where: { clientId, currency, isActive: true },
        _sum: { balance: true, reservedBalance: true },
      });

      const balance = Number(walletAgg._sum.balance ?? 0);
      const reserved = Number(walletAgg._sum.reservedBalance ?? 0);

      const txStats = await this.prisma.transaction.groupBy({
        by: ['currency'],
        where: {
          clientId,
          currency,
          createdAt: { gte: today },
          status: { in: ['PAID', 'VALIDATED', 'PENDING', 'PROCESSING'] },
        },
        _sum: { amount: true, fees: true },
        _count: { id: true },
      });

      const txStat = txStats[0];

      results.push({
        currency,
        symbol: CURRENCY_SYMBOLS[currency] ?? currency,
        balance,
        reservedBalance: reserved,
        availableBalance: balance - reserved,
        totalSentToday: Number(txStat?._sum.amount ?? 0),
        totalReceivedToday: 0,
        totalFeesToday: Number(txStat?._sum.fees ?? 0),
        transactionCountToday: txStat?._count.id ?? 0,
      });
    }

    return results;
  }

  // ========================================================
  // SNAPSHOTS HISTORIQUES
  // ========================================================

  async getSnapshots(params: {
    clientId?: number | null;
    currency?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const where: any = {};
    if (params.clientId !== undefined) where.clientId = params.clientId;
    if (params.currency) where.currency = params.currency;
    if (params.from || params.to) {
      where.date = {};
      if (params.from) where.date.gte = new Date(params.from);
      if (params.to) where.date.lte = new Date(params.to);
    }

    const snapshots = await this.prisma.treasurySnapshot.findMany({
      where,
      orderBy: { date: 'desc' },
      take: params.limit ?? 30,
    });

    return snapshots.map((s) => ({
      ...s,
      totalSent: Number(s.totalSent),
      totalReceived: Number(s.totalReceived),
      totalFees: Number(s.totalFees),
      totalCommission: Number(s.totalCommission),
      openingBalance: Number(s.openingBalance),
      closingBalance: Number(s.closingBalance),
    }));
  }

  // ========================================================
  // INJECTION DE FONDS — Company Admin (sa société)
  // ========================================================

  async injectFunds(params: {
    clientId: number;
    currency: string;
    amount: number;
    performedBy?: string;
    reason?: string;
  }) {
    const { clientId, currency, amount, performedBy, reason } = params;

    if (!amount || amount <= 0) {
      throw new BadRequestException('Montant invalide');
    }

    const normalizedCurrency = currency.toUpperCase().trim();
    if (!SUPPORTED_CURRENCIES.includes(normalizedCurrency)) {
      throw new BadRequestException(`Devise non supportée : ${currency}`);
    }

    const wallet = await this.walletsService.getOrCreateWallet({
      clientId,
      currency: normalizedCurrency,
    });

    this.logger.log(
      `💉 injectFunds — clientId=${clientId} | ${amount} ${normalizedCurrency} | by=${performedBy ?? 'system'}`,
    );

    return this.walletsService.credit(
      wallet.id,
      amount,
      reason ?? `Injection trésorerie ${normalizedCurrency}`,
    );
  }

  // ========================================================
  // RETRAIT FORCÉ — Super Admin uniquement
  // ========================================================

  async withdrawFunds(params: {
    userId?: string;
    agencyId?: string;
    clientId?: number;
    amount: number;
    currency: string;
    reason?: string;
  }) {
    const { amount, currency, reason } = params;

    if (!amount || amount <= 0) {
      throw new BadRequestException('Montant invalide');
    }

    const wallet = await this.walletsService.getOrCreateWallet({
      userId: params.userId,
      agencyId: params.agencyId,
      clientId: params.clientId,
      currency,
    });

    return this.walletsService.debit(
      wallet.id,
      amount,
      reason ?? 'Retrait trésorerie',
    );
  }

  // ========================================================
  // AUTO-ALIMENTATION — Company Admin (sa société uniquement)
  // ========================================================

  async selfFund(params: {
    clientId: number;
    currency: string;
    amount: number;
    reason?: string;
  }): Promise<{ walletId: string; currency: string; credited: number }> {
    const { clientId, currency, amount, reason } = params;

    if (!amount || amount <= 0) {
      throw new BadRequestException('Le montant doit être supérieur à 0.');
    }

    const normalizedCurrency = currency.toUpperCase().trim();
    if (!SUPPORTED_CURRENCIES.includes(normalizedCurrency)) {
      throw new BadRequestException(
        `Devise non supportée : ${currency}. Devises acceptées : ${SUPPORTED_CURRENCIES.join(', ')}`,
      );
    }

    // ✅ FIX: Client n'a pas isActive — on utilise subscriptionStatus
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, subscriptionStatus: true },
    });

    if (
      !client ||
      client.subscriptionStatus === SubscriptionStatus.INACTIVE ||
      client.subscriptionStatus === SubscriptionStatus.SUSPENDED ||
      client.subscriptionStatus === SubscriptionStatus.EXPIRED
    ) {
      throw new ForbiddenException('Société introuvable ou inactive.');
    }

    const wallet = await this.walletsService.getOrCreateWallet({
      clientId,
      currency: normalizedCurrency,
    });

    await this.walletsService.credit(
      wallet.id,
      amount,
      reason ?? `Auto-alimentation ${normalizedCurrency} — Company Admin`,
    );

    this.logger.log(
      `💰 selfFund — clientId=${clientId} | ${amount} ${normalizedCurrency} crédités sur wallet ${wallet.id}`,
    );

    return {
      walletId: wallet.id,
      currency: normalizedCurrency,
      credited: amount,
    };
  }

  async selfFundAll(params: {
    clientId: number;
    amounts: Partial<Record<string, number>>;
    reason?: string;
  }): Promise<{ results: { currency: string; credited: number; walletId: string }[] }> {
    const { clientId, amounts, reason } = params;

    const entries = Object.entries(amounts).filter(
      ([cur, amt]) => SUPPORTED_CURRENCIES.includes(cur.toUpperCase()) && amt && amt > 0,
    );

    if (entries.length === 0) {
      throw new BadRequestException(
        'Aucun montant valide fourni. Vérifiez les devises et les montants.',
      );
    }

    const results = await Promise.all(
      entries.map(([currency, amount]) =>
        this.selfFund({ clientId, currency, amount: amount!, reason }),
      ),
    );

    return { results };
  }

  // ========================================================
  // CRON — Snapshot quotidien à minuit
  // ========================================================

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runDailySnapshot(): Promise<void> {
    this.logger.log('⏰ CRON — Snapshot trésorerie quotidien démarré');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      await this.createSnapshotForDate(null, yesterday, today);

      const clients = await this.prisma.client.findMany({
        select: { id: true },
      });
      for (const client of clients) {
        await this.createSnapshotForDate(client.id, yesterday, today);
      }

      this.logger.log(`✅ Snapshots créés pour ${clients.length + 1} entités`);
    } catch (e) {
      this.logger.error('❌ Erreur snapshot trésorerie', e);
    }
  }

  private async createSnapshotForDate(
    clientId: number | null,
    dateStart: Date,
    dateEnd: Date,
  ): Promise<void> {
    for (const currency of SUPPORTED_CURRENCIES) {
      const walletWhere: any = { currency, isActive: true };
      if (clientId !== null) walletWhere.clientId = clientId;
      else walletWhere.clientId = { not: null };

      const txWhere: any = {
        currency,
        createdAt: { gte: dateStart, lt: dateEnd },
        status: { in: ['PAID', 'VALIDATED'] },
      };
      if (clientId !== null) txWhere.clientId = clientId;

      const [walletAgg, txAgg, txCount] = await Promise.all([
        this.prisma.wallet.aggregate({
          where: walletWhere,
          _sum: { balance: true },
        }),
        this.prisma.transaction.aggregate({
          where: txWhere,
          _sum: { amount: true, fees: true, platformCommission: true },
          _count: { id: true },
        }),
        this.prisma.transaction.groupBy({
          by: ['senderId'],
          where: txWhere,
        }),
      ]);

      const closingBalance = new Prisma.Decimal(walletAgg._sum.balance ?? 0);

      await this.prisma.treasurySnapshot.upsert({
        where: {
          clientId_currency_date: {
            clientId: clientId ?? 0,
            currency,
            date: dateStart,
          },
        },
        update: {
          totalSent: txAgg._sum.amount ?? 0,
          totalFees: txAgg._sum.fees ?? 0,
          totalCommission: txAgg._sum.platformCommission ?? 0,
          closingBalance,
          transactionCount: txAgg._count.id,
          uniqueSenders: txCount.length,
        },
        create: {
          clientId,
          currency,
          date: dateStart,
          totalSent: txAgg._sum.amount ?? 0,
          totalReceived: 0,
          totalFees: txAgg._sum.fees ?? 0,
          totalCommission: txAgg._sum.platformCommission ?? 0,
          openingBalance: 0,
          closingBalance,
          transactionCount: txAgg._count.id,
          uniqueSenders: txCount.length,
        },
      });
    }
  }

  // ========================================================
  // TRIGGER MANUEL
  // ========================================================

  async triggerManualSnapshot(): Promise<void> {
    this.logger.log('🔧 Snapshot manuel déclenché');
    await this.runDailySnapshot();
  }
}