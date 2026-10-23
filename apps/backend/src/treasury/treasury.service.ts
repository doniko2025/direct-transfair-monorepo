// apps/backend/src/treasury/treasury.service.ts
// =========================================================
// TREASURY SERVICE v5.6 — Direct Transf'air
// ✅ v5.6 : runIdempotent() — idempotence des opérations de trésorerie (inject, inject-all, withdraw, transfer). Même
//   en-tête `Idempotency-Key` pour le même utilisateur = même opération : un double clic ou un nouvel essai après une
//   coupure ne crédite / ne débite plus deux fois ; la réponse de la première exécution est rejouée. Table
//   idempotency_records (unique (userId, key)). Sans en-tête : comportement inchangé. Réutiliser une clé pour une autre
//   route → 409. Une exécution encore en cours → 409. Une exécution échouée libère la clé (on peut réessayer).
//   ⚠️ Migration : 20261023150000_add_idempotency_records_and_ledger_restrict
// ✅ v5.5 (phase 6, passe 3) :
//   (1) audit() : trace dans le journal d'audit (action BALANCE_ADJUSTMENT) de chaque injection, auto-alimentation,
//       retrait et transfert interne — ces opérations créent ou déplacent de l'argent sans contrepartie réelle.
//   (2) selfFundAll() : montants convertis en nombres, bornés (MAX_TREASURY_AMOUNT) ; avant, une chaîne ou un
//       montant énorme partait tel quel vers la base (erreur 500).
//   (3) Snapshot GLOBAL : la ligne était recherchée avec clientId 0 mais créée avec clientId null (donc jamais
//       retrouvée) : chaque déclenchement manuel ajoutait un doublon. Recherche explicite sur clientId null.
// ✅ FIX: CurrencyCode enum cast (migration v4.1)
// ✅ FIX: groupBy currency → as any (Prisma enum filter)
// ✅ FIX: txStat optional chaining sécurisé
//
// ✅ v5.4 : 🧹 nettoyage — ternaire mort dans getSnapshots()
//   Le controller calculait `user.role === 'SUPER_ADMIN' ? (user.clientId
//   ?? undefined) : (user.clientId ?? undefined)` — les deux branches
//   faisaient exactement la même chose, le rôle n'avait donc plus
//   aucun effet sur la valeur retenue. Ce n'est pas un bug fonctionnel
//   (le résultat était déjà correct, juste écrit de façon confuse) —
//   simplifié en une seule expression côté treasury.controller.ts.
//   Ce fichier lui-même n'a aucune ligne de logique changée, seul le
//   numéro de version est mis à jour pour rester synchronisé.
//
//   ⚠️ Toujours ouvert, nécessite une décision produit avant correctif :
//   totalReceivedToday est câblé en dur à 0 dans getGlobalOverview()
//   et getClientOverview() — jamais calculé. Le dashboard trésorerie
//   ne peut donc jamais montrer ce qui est entré aujourd'hui. Pas
//   corrigé faute de définition confirmée de "reçu" (conversions
//   entrantes ? dépôts uniquement ? les deux ?).
// =========================================================

import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CurrencyCode, Prisma, SubscriptionStatus } from '@prisma/client';

import type { AuthUserPayload } from '../auth/types/auth-user-payload.type';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';
import { WalletsService } from '../wallets/wallets.service';

/** Plafond d'un montant saisi à la trésorerie (au-delà, la colonne Decimal déborde). */
export const MAX_TREASURY_AMOUNT = 1_000_000_000_000;

const SUPPORTED_CURRENCIES: CurrencyCode[] = [
  CurrencyCode.XOF,
  CurrencyCode.EUR,
  CurrencyCode.USD,
  CurrencyCode.GNF,
  CurrencyCode.GBP,
];

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
  EUR: '€', USD: '$', GBP: '£', GNF: 'FG', XOF: 'CFA',
};

@Injectable()
export class TreasuryService {
  private readonly logger = new Logger(TreasuryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: RatesService,
    private readonly walletsService: WalletsService,
  ) {}

  // ========================================================
  // VUE TEMPS RÉEL — Super Admin
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

      const balance  = Number(walletAgg._sum.balance ?? 0);
      const reserved = Number(walletAgg._sum.reservedBalance ?? 0);

      // ✅ FIX: groupBy retourne un tableau — on cherche la ligne matching
      const txStats = await this.prisma.transaction.aggregate({
        where: {
          currency,
          createdAt: { gte: today },
          status: { in: ['PAID', 'VALIDATED', 'PENDING', 'PROCESSING'] as any },
        },
        _sum: { amount: true, fees: true },
        _count: { id: true },
      });

      results.push({
        currency,
        symbol: CURRENCY_SYMBOLS[currency] ?? currency,
        balance,
        reservedBalance: reserved,
        availableBalance: balance - reserved,
        totalSentToday:        Number(txStats._sum.amount ?? 0),
        totalReceivedToday:    0,
        totalFeesToday:        Number(txStats._sum.fees ?? 0),
        transactionCountToday: txStats._count.id ?? 0,
      });
    }

    return results;
  }

  // ========================================================
  // VUE TEMPS RÉEL — Company Admin
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

      const balance  = Number(walletAgg._sum.balance ?? 0);
      const reserved = Number(walletAgg._sum.reservedBalance ?? 0);

      const txStats = await this.prisma.transaction.aggregate({
        where: {
          clientId,
          currency,
          createdAt: { gte: today },
          status: { in: ['PAID', 'VALIDATED', 'PENDING', 'PROCESSING'] as any },
        },
        _sum: { amount: true, fees: true },
        _count: { id: true },
      });

      results.push({
        currency,
        symbol: CURRENCY_SYMBOLS[currency] ?? currency,
        balance,
        reservedBalance: reserved,
        availableBalance: balance - reserved,
        totalSentToday:        Number(txStats._sum.amount ?? 0),
        totalReceivedToday:    0,
        totalFeesToday:        Number(txStats._sum.fees ?? 0),
        transactionCountToday: txStats._count.id ?? 0,
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
      if (params.to)   where.date.lte = new Date(params.to);
    }

    const snapshots = await this.prisma.treasurySnapshot.findMany({
      where,
      orderBy: { date: 'desc' },
      take: params.limit ?? 30,
    });

    return snapshots.map((s) => ({
      ...s,
      totalSent:       Number(s.totalSent),
      totalReceived:   Number(s.totalReceived),
      totalFees:       Number(s.totalFees),
      totalCommission: Number(s.totalCommission),
      openingBalance:  Number(s.openingBalance),
      closingBalance:  Number(s.closingBalance),
    }));
  }

  // ========================================================
  // JOURNAL D'AUDIT — mouvements de trésorerie
  // ========================================================

  /**
   * ✅ v5.6 — exécute `job` au plus une fois par (userId, key). key null = pas d'idempotence (anciens clients).
   * La clé est réservée AVANT l'opération (index unique) : deux requêtes simultanées ne peuvent pas toutes deux l'exécuter.
   */
  async runIdempotent<T>(
    userId: string,
    key: string | null,
    scope: string,
    job: () => Promise<T>,
  ): Promise<T> {
    if (!key) return job();

    try {
      await this.prisma.idempotencyRecord.create({ data: { userId, key, scope } });
    } catch (err) {
      if ((err as { code?: string })?.code !== 'P2002') throw err;
      const prior = await this.prisma.idempotencyRecord.findUnique({ where: { userId_key: { userId, key } } });
      if (prior && prior.scope !== scope) {
        throw new ConflictException('Idempotency-Key déjà utilisée pour une autre opération.');
      }
      if (prior?.response !== null && prior?.response !== undefined) {
        return prior.response as unknown as T;
      }
      throw new ConflictException('Cette opération est déjà en cours de traitement. Réessayez dans un instant.');
    }

    try {
      const result = await job();
      try {
        await this.prisma.idempotencyRecord.update({
          where: { userId_key: { userId, key } },
          data:  { response: result as unknown as Prisma.InputJsonValue },
        });
      } catch (err) {
        // L'argent a bougé : on ne fait pas échouer l'opération. La clé reste réservée (un rejeu répondra « en cours »).
        this.logger.error(`Réponse idempotente non enregistrée (${scope}) : ${(err as Error).message}`);
      }
      return result;
    } catch (err) {
      // Échec : rien n'a été fait, la clé est libérée pour un nouvel essai.
      await this.prisma.idempotencyRecord.delete({ where: { userId_key: { userId, key } } }).catch(() => undefined);
      throw err;
    }
  }

  /** L'opération est faite : un échec d'écriture du journal ne doit pas la faire passer pour un échec. */
  async audit(
    user: Pick<AuthUserPayload, 'id' | 'clientId'> | undefined,
    kind: 'TREASURY_INJECT' | 'TREASURY_SELF_FUND' | 'TREASURY_WITHDRAW' | 'TREASURY_TRANSFER',
    details: Record<string, unknown>,
  ): Promise<void> {
    if (!user) return;
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          clientId: user.clientId ?? null,
          action: 'BALANCE_ADJUSTMENT',
          entity: 'Treasury',
          entityId: kind,
          details: { kind, ...details } as Prisma.InputJsonValue,
          successful: true,
        },
      });
    } catch (err) {
      this.logger.error(`Journal d'audit non écrit (${kind}) : ${(err as Error).message}`);
    }
  }

  // ========================================================
  // INJECTION DE FONDS
  // ========================================================

  async injectFunds(params: {
    clientId: number;
    currency: string;
    amount: number;
    performedBy?: string;
    description?: string;
    reason?: string;
  }) {
    const { clientId, currency, performedBy, description, reason } = params;
    const amount = Number(params.amount);

    if (!amount || amount <= 0 || amount > MAX_TREASURY_AMOUNT) throw new BadRequestException('Montant invalide');

    const normalizedCurrency = currency.toUpperCase().trim() as CurrencyCode;
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
      description ?? reason ?? `Injection trésorerie ${normalizedCurrency}`,
    );
  }

  // ========================================================
  // RETRAIT FORCÉ
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

    if (!amount || amount <= 0 || amount > MAX_TREASURY_AMOUNT) throw new BadRequestException('Montant invalide');

    const wallet = await this.walletsService.getOrCreateWallet({
      userId:   params.userId,
      agencyId: params.agencyId,
      clientId: params.clientId,
      currency: currency.toUpperCase() as CurrencyCode,
    });

    return this.walletsService.debit(wallet.id, amount, reason ?? 'Retrait trésorerie');
  }

  // ========================================================
  // TRANSFERT ENTRE WALLETS
  // ========================================================

  async transferBetweenWallets(params: {
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    description?: string;
  }) {
    const { fromWalletId, toWalletId, amount, description } = params;

    if (!amount || amount <= 0) throw new BadRequestException('Montant invalide');

    return this.walletsService.transfer({
      fromWalletId,
      toWalletId,
      amount,
      description: description ?? 'Transfert interne Super Admin',
    });
  }

  // ========================================================
  // AUTO-ALIMENTATION — Company Admin
  // ========================================================

  async selfFund(params: {
    clientId: number;
    currency: string;
    amount: number;
    reason?: string;
  }): Promise<{ walletId: string; currency: string; credited: number }> {
    const { clientId, currency, amount, reason } = params;

    if (!amount || amount <= 0 || amount > MAX_TREASURY_AMOUNT) {
      throw new BadRequestException('Le montant doit être supérieur à 0.');
    }

    const normalizedCurrency = currency.toUpperCase().trim() as CurrencyCode;
    if (!SUPPORTED_CURRENCIES.includes(normalizedCurrency)) {
      throw new BadRequestException(
        `Devise non supportée : ${currency}. Devises acceptées : ${SUPPORTED_CURRENCIES.join(', ')}`,
      );
    }

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

    return { walletId: wallet.id, currency: normalizedCurrency, credited: amount };
  }

  // ========================================================
  // AUTO-ALIMENTATION MULTI-DEVISES
  // ========================================================

  async selfFundAll(params: {
    clientId: number;
    amounts: Partial<Record<string, number>>;
    reason?: string;
  }): Promise<{ results: { currency: string; credited: number; walletId: string }[] }> {
    const { clientId, amounts, reason } = params;

    const entries: [string, number][] = [];
    for (const [cur, raw] of Object.entries(amounts ?? {})) {
      if (!SUPPORTED_CURRENCIES.includes(cur.toUpperCase() as CurrencyCode)) continue;
      // Une devise laissée vide ou à zéro est simplement ignorée ; une valeur absurde est refusée.
      if (raw === null || raw === undefined || (raw as unknown) === '') continue;
      const amt = Number(raw);
      if (!Number.isFinite(amt)) throw new BadRequestException(`Montant invalide pour ${cur}.`);
      if (amt <= 0) continue;
      if (amt > MAX_TREASURY_AMOUNT) throw new BadRequestException(`Montant trop élevé pour ${cur}.`);
      entries.push([cur, amt]);
    }

    if (entries.length === 0) {
      throw new BadRequestException(
        'Aucun montant valide fourni. Vérifiez les devises et les montants.',
      );
    }

    const results = await Promise.all(
      entries.map(([currency, amount]) =>
        this.selfFund({ clientId, currency, amount, reason }),
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

      const clients = await this.prisma.client.findMany({ select: { id: true } });

      for (const client of clients) {
        await this.createSnapshotForDate(client.id, yesterday, today);
      }

      this.logger.log(`✅ Snapshots créés pour ${clients.length + 1} entités`);
    } catch (e) {
      this.logger.error('❌ Erreur snapshot trésorerie', e);
    }
  }

  // ========================================================
  // HELPER INTERNE — Snapshot pour une date donnée
  // ========================================================

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
        // ✅ FIX: groupBy senderId — on compte les expéditeurs uniques
        this.prisma.transaction.findMany({
          where: txWhere,
          select: { senderId: true },
          distinct: ['senderId'],
        }),
      ]);

      const closingBalance = new Prisma.Decimal(walletAgg._sum.balance ?? 0);

      const figures = {
        totalSent:        txAgg._sum.amount ?? 0,
        totalFees:        txAgg._sum.fees ?? 0,
        totalCommission:  txAgg._sum.platformCommission ?? 0,
        closingBalance,
        transactionCount: txAgg._count.id,
        uniqueSenders:    txCount.length,
      };

      if (clientId === null) {
        // Snapshot global : clientId est NULL en base. L'unicité (clientId, devise, date) ne s'applique pas aux
        // NULL (PostgreSQL) : on cherche la ligne du jour explicitement, sinon chaque exécution ajoutait un doublon.
        const existing = await this.prisma.treasurySnapshot.findFirst({
          where: { clientId: null, currency, date: dateStart },
          select: { id: true },
        });
        if (existing) {
          await this.prisma.treasurySnapshot.update({ where: { id: existing.id }, data: figures });
        } else {
          await this.prisma.treasurySnapshot.create({
            data: { clientId: null, currency, date: dateStart, totalReceived: 0, openingBalance: 0, ...figures },
          });
        }
        continue;
      }

      await this.prisma.treasurySnapshot.upsert({
        where: { clientId_currency_date: { clientId, currency, date: dateStart } },
        update: figures,
        create: { clientId, currency, date: dateStart, totalReceived: 0, openingBalance: 0, ...figures },
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