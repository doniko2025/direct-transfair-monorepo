// apps/backend/src/wallets/wallets.service.ts
// =========================================================
// WALLETS SERVICE v5.1
// ✅ FIX lockWallet : "Wallet" → "wallet" (casse PostgreSQL)
// ✅ FIX lockWallet : advisory lock via pg_advisory_xact_lock
//    au lieu de SELECT FOR UPDATE sur nom de table raw
// ✅ Gestion multi-devises (XOF, EUR, USD, GNF, GBP)
// ✅ Wallet auto créé selon pays de résidence
// ✅ Ledger double-entrée
// ✅ reservedBalance pour fonds en attente
// ✅ getOrCreateWallet (requis par TreasuryService)
// ✅ getWalletsForUser, getWalletById, getLedger
// =========================================================

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';

export const SUPPORTED_CURRENCIES = ['XOF', 'EUR', 'USD', 'GNF', 'GBP'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

function assertCurrency(currency: string): asserts currency is SupportedCurrency {
  if (!SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency)) {
    throw new BadRequestException(`Devise non supportée: ${currency}`);
  }
}

// ✅ APRÈS — fonctionne avec CUID, UUID, ou n'importe quel string
function uuidToLockKey(id: string): bigint {
  let hash = 0n;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31n + BigInt(id.charCodeAt(i))) & 0x7FFFFFFFFFFFFFFFn;
  }
  return hash;
}
@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: RatesService,
  ) {}

  // ========================================================
  // GET OR CREATE WALLET
  // Requis par TreasuryService (injectFunds, withdrawFunds, selfFund)
  // ========================================================

  async getOrCreateWallet(params: {
    userId?: string;
    agencyId?: string;
    clientId?: number;
    currency: string;
  }): Promise<{ id: string; currency: string }> {
    assertCurrency(params.currency);

    const clientId =
      params.clientId ??
      (params.agencyId ? parseInt(params.agencyId, 10) : undefined);

    const userId = !clientId ? params.userId : undefined;

    if (!clientId && !userId) {
      throw new BadRequestException(
        'Un identifiant (userId, agencyId ou clientId) est requis.',
      );
    }

    const where = clientId
      ? { clientId, currency: params.currency, isActive: true }
      : { userId, currency: params.currency, isActive: true };

    const existing = await this.prisma.wallet.findFirst({ where });
    if (existing) return existing;

    const created = await this.prisma.wallet.create({
      data: {
        ...(clientId ? { clientId } : { userId }),
        currency: params.currency,
        balance: new Prisma.Decimal(0),
        reservedBalance: new Prisma.Decimal(0),
        isActive: true,
        isDefault: false,
      },
    });

    return created;
  }

  // ========================================================
  // GET WALLETS FOR USER
  // ========================================================

  async getWalletsForUser(userId: string) {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId, isActive: true },
      orderBy: { currency: 'asc' },
    });
    return wallets.map((w) => this.serialize(w));
  }

  // ========================================================
  // GET WALLET BY ID (avec vérification de propriété)
  // ========================================================

  async getWalletById(walletId: string, userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) throw new NotFoundException('Wallet introuvable');
    if (wallet.userId !== userId) {
      throw new ForbiddenException('Accès non autorisé à ce wallet');
    }

    return this.serialize(wallet);
  }

  // ========================================================
  // GET LEDGER
  // ========================================================

  async getLedger(
    walletId: string,
    params: {
      page?: number;
      limit?: number;
      from?: string;
      to?: string;
    },
  ) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { walletId };
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }

    const [entries, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    return {
      data: entries.map((e) => ({
        ...e,
        amount: Number(e.amount),
        balanceAfter: Number(e.balanceAfter),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ========================================================
  // SAFE LOCK (ANTI RACE CONDITION)
  // ✅ FIX v5.1 : advisory lock au lieu de SELECT FOR UPDATE
  //    raw SQL — évite l'erreur 42P01 "relation Wallet does not exist"
  //    pg_advisory_xact_lock est automatiquement libéré en fin de transaction
  // ========================================================

  private async lockWallet(
    tx: Prisma.TransactionClient,
    walletId: string,
  ): Promise<void> {
    const lockKey = uuidToLockKey(walletId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
  }

  // ========================================================
  // DEBIT (SAFE VERSION)
  // ========================================================

  async debit(
    walletId: string,
    amount: number,
    description: string,
    transactionId?: string,
  ) {
    if (amount <= 0) throw new BadRequestException('Montant invalide');

    return this.prisma.$transaction(async (tx) => {
      await this.lockWallet(tx, walletId);

      const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
      if (!wallet) throw new NotFoundException('Wallet introuvable');

      const amt = new Prisma.Decimal(amount);
      const available = wallet.balance.minus(wallet.reservedBalance);

      if (available.lessThan(amt)) {
        throw new BadRequestException(
          `Solde insuffisant: ${available} ${wallet.currency}`,
        );
      }

      const updated = await tx.wallet.update({
        where: { id: walletId },
        data: { balance: { decrement: amt } },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId,
          type: 'DEBIT',
          amount: amt,
          currency: wallet.currency,
          description,
          transactionId,
          balanceAfter: updated.balance,
        },
      });

      return this.serialize(updated);
    });
  }

  // ========================================================
  // CREDIT (SAFE)
  // ========================================================

  async credit(
    walletId: string,
    amount: number,
    description: string,
    transactionId?: string,
  ) {
    if (amount <= 0) throw new BadRequestException('Montant invalide');

    return this.prisma.$transaction(async (tx) => {
      await this.lockWallet(tx, walletId);

      const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
      if (!wallet) throw new NotFoundException('Wallet introuvable');

      const amt = new Prisma.Decimal(amount);

      const updated = await tx.wallet.update({
        where: { id: walletId },
        data: { balance: { increment: amt } },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId,
          type: 'CREDIT',
          amount: amt,
          currency: wallet.currency,
          description,
          transactionId,
          balanceAfter: updated.balance,
        },
      });

      return this.serialize(updated);
    });
  }

  // ========================================================
  // HOLD
  // ========================================================

  async hold(walletId: string, amount: number, description: string) {
    if (amount <= 0) throw new BadRequestException('Montant invalide');

    return this.prisma.$transaction(async (tx) => {
      await this.lockWallet(tx, walletId);

      const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
      if (!wallet) throw new NotFoundException('Wallet introuvable');

      const amt = new Prisma.Decimal(amount);
      const available = wallet.balance.minus(wallet.reservedBalance);

      if (available.lessThan(amt)) {
        throw new BadRequestException('Fonds insuffisants');
      }

      const updated = await tx.wallet.update({
        where: { id: walletId },
        data: { reservedBalance: { increment: amt } },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId,
          type: 'HOLD',
          amount: amt,
          currency: wallet.currency,
          description,
          balanceAfter: updated.balance,
        },
      });

      return this.serialize(updated);
    });
  }

  // ========================================================
  // UNHOLD
  // ========================================================

  async unhold(walletId: string, amount: number, description: string) {
    if (amount <= 0) throw new BadRequestException('Montant invalide');

    return this.prisma.$transaction(async (tx) => {
      await this.lockWallet(tx, walletId);

      const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
      if (!wallet) throw new NotFoundException('Wallet introuvable');

      const amt = new Prisma.Decimal(amount);

      if (wallet.reservedBalance.lessThan(amt)) {
        throw new BadRequestException('Montant réservé insuffisant');
      }

      const updated = await tx.wallet.update({
        where: { id: walletId },
        data: { reservedBalance: { decrement: amt } },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId,
          type: 'UNHOLD',
          amount: amt,
          currency: wallet.currency,
          description,
          balanceAfter: updated.balance,
        },
      });

      return this.serialize(updated);
    });
  }

  // ========================================================
  // TRANSFER (ATOMIC + RATE LOCK)
  // ========================================================

  async transfer(params: {
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    description: string;
  }) {
    const { fromWalletId, toWalletId, amount, description } = params;

    if (amount <= 0) throw new BadRequestException('Montant invalide');

    return this.prisma.$transaction(async (tx) => {
      // Toujours locker dans le même ordre pour éviter les deadlocks
      const ids = [fromWalletId, toWalletId].sort();
      await this.lockWallet(tx, ids[0]);
      await this.lockWallet(tx, ids[1]);

      const fromWallet = await tx.wallet.findUnique({ where: { id: fromWalletId } });
      const toWallet = await tx.wallet.findUnique({ where: { id: toWalletId } });

      if (!fromWallet || !toWallet) throw new NotFoundException('Wallet introuvable');

      const fromAmt = new Prisma.Decimal(amount);
      const available = fromWallet.balance.minus(fromWallet.reservedBalance);

      if (available.lessThan(fromAmt)) {
        throw new BadRequestException('Solde insuffisant');
      }

      const rate =
        fromWallet.currency === toWallet.currency
          ? 1
          : await this.rates.getRate(fromWallet.currency, toWallet.currency);

      const toAmount = new Prisma.Decimal(amount * rate);

      const updatedFrom = await tx.wallet.update({
        where: { id: fromWalletId },
        data: { balance: { decrement: fromAmt } },
      });

      const updatedTo = await tx.wallet.update({
        where: { id: toWalletId },
        data: { balance: { increment: toAmount } },
      });

      await tx.ledgerEntry.createMany({
        data: [
          {
            walletId: fromWalletId,
            type: 'DEBIT',
            amount: fromAmt,
            currency: fromWallet.currency,
            description,
            balanceAfter: updatedFrom.balance,
          },
          {
            walletId: toWalletId,
            type: 'CREDIT',
            amount: toAmount,
            currency: toWallet.currency,
            description,
            balanceAfter: updatedTo.balance,
          },
        ],
      });

      return {
        from: this.serialize(updatedFrom),
        to: this.serialize(updatedTo),
        rate,
      };
    });
  }

  // ========================================================
  // SERIALIZE
  // ========================================================

  private serialize(w: any) {
    const balance = Number(w.balance);
    const reserved = Number(w.reservedBalance);

    return {
      id: w.id,
      currency: w.currency,
      balance,
      reservedBalance: reserved,
      availableBalance: balance - reserved,
      isDefault: w.isDefault,
      isActive: w.isActive,
    };
  }
}