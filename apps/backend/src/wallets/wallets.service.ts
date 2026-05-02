// apps/backend/src/wallets/wallets.service.ts
// =========================================================
// WALLETS SERVICE v4.0
// ✅ Gestion multi-devises (XOF, EUR, USD, GNF, GBP)
// ✅ Wallet auto créé selon pays de résidence
// ✅ Ledger double-entrée
// ✅ reservedBalance pour fonds en attente
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

// =========================================================
// CONSTANTES
// =========================================================

export const SUPPORTED_CURRENCIES = ['XOF', 'EUR', 'USD', 'GNF', 'GBP'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  FR: 'EUR', DE: 'EUR', IT: 'EUR', ES: 'EUR', BE: 'EUR', PT: 'EUR',
  NL: 'EUR', AT: 'EUR', FI: 'EUR', IE: 'EUR', LU: 'EUR', GR: 'EUR',
  GB: 'GBP', GG: 'GBP', JE: 'GBP', IM: 'GBP',
  US: 'USD', SV: 'USD', PA: 'USD', EC: 'USD',
  GN: 'GNF',
  SN: 'XOF', CI: 'XOF', ML: 'XOF', BF: 'XOF', BJ: 'XOF',
  TG: 'XOF', NE: 'XOF', GW: 'XOF',
};

export function getCurrencyFromCountry(country?: string | null): string {
  if (!country) return 'XOF';
  const code = country.toUpperCase().trim().substring(0, 2);
  return COUNTRY_TO_CURRENCY[code] ?? 'XOF';
}

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: RatesService,
  ) {}

  // ========================================================
  // LECTURE
  // ========================================================

  async getWalletsForUser(userId: string) {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { currency: 'asc' }],
    });
    return wallets.map((w) => this.serialize(w));
  }

  async getWalletsForAgency(agencyId: string) {
    const wallets = await this.prisma.wallet.findMany({
      where: { agencyId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { currency: 'asc' }],
    });
    return wallets.map((w) => this.serialize(w));
  }

  async getWalletsForClient(clientId: number) {
    const wallets = await this.prisma.wallet.findMany({
      where: { clientId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { currency: 'asc' }],
    });
    return wallets.map((w) => this.serialize(w));
  }

  async getWalletById(walletId: string, ownerId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });
    if (!wallet) throw new NotFoundException('Wallet introuvable');

    const isOwner =
      wallet.userId === ownerId ||
      wallet.agencyId === ownerId ||
      String(wallet.clientId) === ownerId;

    if (!isOwner) throw new ForbiddenException('Accès refusé à ce wallet');

    return this.serialize(wallet);
  }

  async getLedger(
    walletId: string,
    params?: { page?: number; limit?: number; from?: string; to?: string },
  ) {
    const page = params?.page ?? 1;
    const limit = Math.min(params?.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { walletId };
    if (params?.from || params?.to) {
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
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ========================================================
  // CRÉATION
  // ========================================================

  /**
   * Crée le wallet de la devise principale selon le pays
   * Appelé à l'inscription ou à la création d'une agence
   */
  async createDefaultWalletForUser(
    userId: string,
    country?: string | null,
  ) {
    const currency = getCurrencyFromCountry(country);

    const existing = await this.prisma.wallet.findUnique({
      where: { userId_currency: { userId, currency } },
    });
    if (existing) return this.serialize(existing);

    const wallet = await this.prisma.wallet.create({
      data: {
        userId,
        currency,
        balance: 0,
        isDefault: true,
        isActive: true,
      },
    });

    return this.serialize(wallet);
  }

  async createDefaultWalletForAgency(
    agencyId: string,
    country?: string | null,
  ) {
    const currency = getCurrencyFromCountry(country);

    const existing = await this.prisma.wallet.findUnique({
      where: { agencyId_currency: { agencyId, currency } },
    });
    if (existing) return this.serialize(existing);

    const wallet = await this.prisma.wallet.create({
      data: {
        agencyId,
        currency,
        balance: 0,
        isDefault: true,
        isActive: true,
      },
    });

    return this.serialize(wallet);
  }

  /**
   * Crée tous les wallets des 5 devises pour un client (plateforme)
   */
  async createAllWalletsForClient(clientId: number) {
    // ✅ FIX : typage explicite any[] pour éviter l'incompatibilité Prisma Decimal vs serialize()
    const created: any[] = [];
    for (const currency of SUPPORTED_CURRENCIES) {
      const existing = await this.prisma.wallet.findUnique({
        where: { clientId_currency: { clientId, currency } },
      });
      if (!existing) {
        const w = await this.prisma.wallet.create({
          data: {
            clientId,
            currency,
            balance: 0,
            isDefault: currency === 'XOF',
            isActive: true,
          },
        });
        created.push(w);
      }
    }
    return created.map((w) => this.serialize(w));
  }

  // ========================================================
  // DÉBIT / CRÉDIT
  // ========================================================

  /**
   * Débite un wallet (vérifie le solde disponible)
   * Crée une LedgerEntry DEBIT
   */
  async debit(
    walletId: string,
    amount: number,
    description: string,
    transactionId?: string,
    externalRef?: string,
  ) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet introuvable');

    const amt = new Prisma.Decimal(amount);
    const available = wallet.balance.minus(wallet.reservedBalance);

    if (available.lessThan(amt)) {
      throw new BadRequestException(
        `Solde insuffisant. Disponible : ${available} ${wallet.currency}, requis : ${amt}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: walletId },
        data: { balance: { decrement: amt } },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId,
          transactionId: transactionId ?? null,
          type: 'DEBIT',
          amount: amt,
          currency: wallet.currency,
          description,
          balanceAfter: updated.balance,
          externalRef: externalRef ?? null,
        },
      });

      return this.serialize(updated);
    });
  }

  /**
   * Crédite un wallet
   * Crée une LedgerEntry CREDIT
   */
  async credit(
    walletId: string,
    amount: number,
    description: string,
    transactionId?: string,
    externalRef?: string,
  ) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet introuvable');

    const amt = new Prisma.Decimal(amount);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: walletId },
        data: { balance: { increment: amt } },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId,
          transactionId: transactionId ?? null,
          type: 'CREDIT',
          amount: amt,
          currency: wallet.currency,
          description,
          balanceAfter: updated.balance,
          externalRef: externalRef ?? null,
        },
      });

      return this.serialize(updated);
    });
  }

  /**
   * Réserve des fonds (avant une transaction en attente)
   * Augmente reservedBalance, ne touche pas balance
   */
  async hold(walletId: string, amount: number, description: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet introuvable');

    const amt = new Prisma.Decimal(amount);
    const available = wallet.balance.minus(wallet.reservedBalance);

    if (available.lessThan(amt)) {
      throw new BadRequestException(
        `Solde insuffisant pour réserver. Disponible : ${available}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
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

  /**
   * Libère des fonds réservés (transaction annulée)
   */
  async unhold(walletId: string, amount: number, description: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet introuvable');

    const amt = new Prisma.Decimal(amount);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: walletId },
        data: {
          reservedBalance: {
            decrement: amt,
          },
        },
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
  // TRANSFERT ENTRE WALLETS (avec conversion)
  // ========================================================

  /**
   * Transfère entre deux wallets (même devise ou conversion automatique)
   * Utilisé pour les virements internes, recharges agences, etc.
   */
  async transfer(params: {
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    description: string;
    transactionId?: string;
  }) {
    const { fromWalletId, toWalletId, amount, description, transactionId } = params;

    const [fromWallet, toWallet] = await Promise.all([
      this.prisma.wallet.findUnique({ where: { id: fromWalletId } }),
      this.prisma.wallet.findUnique({ where: { id: toWalletId } }),
    ]);

    if (!fromWallet) throw new NotFoundException('Wallet source introuvable');
    if (!toWallet) throw new NotFoundException('Wallet destination introuvable');

    const fromAmt = new Prisma.Decimal(amount);

    // Conversion si devises différentes
    let toAmount = amount;
    if (fromWallet.currency !== toWallet.currency) {
      toAmount = await this.rates.convert(
        amount,
        fromWallet.currency,
        toWallet.currency,
      );
    }

    const toAmt = new Prisma.Decimal(toAmount);
    const available = fromWallet.balance.minus(fromWallet.reservedBalance);

    if (available.lessThan(fromAmt)) {
      throw new BadRequestException(
        `Solde insuffisant. Disponible : ${available} ${fromWallet.currency}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const [updatedFrom, updatedTo] = await Promise.all([
        tx.wallet.update({
          where: { id: fromWalletId },
          data: { balance: { decrement: fromAmt } },
        }),
        tx.wallet.update({
          where: { id: toWalletId },
          data: { balance: { increment: toAmt } },
        }),
      ]);

      await tx.ledgerEntry.create({
        data: {
          walletId: fromWalletId,
          transactionId: transactionId ?? null,
          type: 'DEBIT',
          amount: fromAmt,
          currency: fromWallet.currency,
          description,
          balanceAfter: updatedFrom.balance,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: toWalletId,
          transactionId: transactionId ?? null,
          type: 'CREDIT',
          amount: toAmt,
          currency: toWallet.currency,
          description,
          balanceAfter: updatedTo.balance,
        },
      });

      return {
        from: this.serialize(updatedFrom),
        to: this.serialize(updatedTo),
        rate:
          fromWallet.currency !== toWallet.currency
            ? toAmount / amount
            : 1,
      };
    });
  }

  // ========================================================
  // UTILITAIRES
  // ========================================================

  /**
   * Récupère ou crée le wallet d'une devise donnée pour un user
   */
  async getOrCreateWallet(params: {
    userId?: string;
    agencyId?: string;
    clientId?: number;
    currency: string;
  }) {
    const { userId, agencyId, clientId, currency } = params;

    if (userId) {
      const existing = await this.prisma.wallet.findUnique({
        where: { userId_currency: { userId, currency } },
      });
      if (existing) return this.serialize(existing);
      const w = await this.prisma.wallet.create({
        data: { userId, currency, balance: 0, isActive: true },
      });
      return this.serialize(w);
    }

    if (agencyId) {
      const existing = await this.prisma.wallet.findUnique({
        where: { agencyId_currency: { agencyId, currency } },
      });
      if (existing) return this.serialize(existing);
      const w = await this.prisma.wallet.create({
        data: { agencyId, currency, balance: 0, isActive: true },
      });
      return this.serialize(w);
    }

    if (clientId) {
      const existing = await this.prisma.wallet.findUnique({
        where: { clientId_currency: { clientId, currency } },
      });
      if (existing) return this.serialize(existing);
      const w = await this.prisma.wallet.create({
        data: { clientId, currency, balance: 0, isActive: true },
      });
      return this.serialize(w);
    }

    throw new BadRequestException('userId, agencyId ou clientId requis');
  }

  private serialize(w: any) {
    const balance = typeof w.balance?.toNumber === 'function' ? w.balance.toNumber() : Number(w.balance ?? 0);
    const reserved = typeof w.reservedBalance?.toNumber === 'function' ? w.reservedBalance.toNumber() : Number(w.reservedBalance ?? 0);
    return {
      id: w.id,
      currency: w.currency,
      balance,
      reservedBalance: reserved,
      availableBalance: balance - reserved,
      isDefault: w.isDefault ?? false,
      isActive: w.isActive ?? true,
      userId: w.userId ?? null,
      agencyId: w.agencyId ?? null,
      clientId: w.clientId ?? null,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    };
  }
}