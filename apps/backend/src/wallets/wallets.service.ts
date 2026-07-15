// apps/backend/src/wallets/wallets.service.ts
// =========================================================
// WALLETS SERVICE v5.4
// ✅ FIX v5.2 : getOrCreateWallet — agencyId est un CUID string,
//    ne jamais faire parseInt() dessus
// ✅ FIX v5.2 : getOrCreateWallet — support agencyId comme clé propre
// ✅ FIX v5.2 : getWalletsForUser — wallets clientId pour COMPANY_ADMIN
// ✅ FIX v5.3 : getWalletsForUser — SUPER_ADMIN inclus dans la branche
//    clientId (le SA reçoit les paiements B2B sur son wallet clientId,
//    pas sur son wallet userId → solde était toujours 0 sur le dashboard)
// ✅ FIX v5.3 : getWalletById — ownership étendu aux wallets clientId
//    (SUPER_ADMIN et COMPANY_ADMIN peuvent consulter leur ledger)
//
// ✅ FIX v5.4 : 🐛 getOrCreateWallet() pouvait violer la contrainte
//    unique sur un wallet désactivé
//
//   PROBLÈME RÉSOLU (juillet 2026) :
//   La recherche d'un wallet existant filtrait isActive: true. Si un
//   wallet existait déjà pour cette clé (userId+currency, agencyId+
//   currency ou clientId+currency) mais était désactivé — ce que fait
//   désormais AgenciesService.remove() sur les wallets d'un agent/
//   d'une agence désactivé(e), voir agencies.service.ts v4.5 — cette
//   recherche ne le trouvait pas, et le code tombait dans la branche
//   "création" : un tx.wallet.create() avec exactement la même clé
//   (userId+currency / agencyId+currency / clientId+currency), qui
//   viole Wallet.@@unique([...]) et échoue avec une erreur Prisma
//   P2002 — potentiellement en pleine transaction de transfert, donc
//   avec un rollback de toute l'opération. Ce risque existait déjà
//   avant ce fix pour toute autre cause de wallet inactif (gel manuel
//   par un futur outil admin, par exemple) ; il devient réel maintenant
//   qu'un chemin du code désactive effectivement des wallets.
//
//   CORRECTIF :
//   La recherche du wallet existant ne filtre plus isActive — elle
//   trouve le wallet quel que soit son état. S'il est trouvé mais
//   désactivé, il est automatiquement réactivé (isActive: true) avant
//   d'être retourné : demander un wallet pour un compte donné signale
//   un besoin actuel d'un wallet utilisable, la réactivation est donc
//   le comportement le plus cohérent (et la seule alternative valide,
//   la création d'un doublon étant de toute façon impossible).
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
  // ✅ v5.2 : agencyId est un CUID string — ne jamais parseInt()
  // ✅ v5.4 : voir changelog en tête de fichier — ne filtre plus
  //    isActive à la recherche, réactive un wallet trouvé inactif.
  // ========================================================

  async getOrCreateWallet(params: {
    userId?: string;
    agencyId?: string;
    clientId?: number;
    currency: string;
  }): Promise<{ id: string; currency: string }> {
    assertCurrency(params.currency);

    const { userId, agencyId, clientId, currency } = params;

    if (!userId && !agencyId && clientId === undefined) {
      throw new BadRequestException(
        'Un identifiant (userId, agencyId ou clientId) est requis.',
      );
    }

    let existing: any = null;

    // ✅ v5.4 — FIX : plus de filtre isActive ici (voir changelog).
    // Une contrainte @@unique existe sur chacune de ces clés ; la
    // création ci-dessous échouerait avec P2002 si un wallet
    // (actif ou non) existe déjà pour la même clé.
    if (agencyId) {
      existing = await this.prisma.wallet.findFirst({
        where: { agencyId, currency },
      });
    } else if (clientId !== undefined) {
      existing = await this.prisma.wallet.findFirst({
        where: { clientId, currency },
      });
    } else if (userId) {
      existing = await this.prisma.wallet.findFirst({
        where: { userId, currency },
      });
    }

    if (existing) {
      // ✅ v5.4 — réactivation automatique si trouvé mais désactivé.
      if (!existing.isActive) {
        existing = await this.prisma.wallet.update({
          where: { id: existing.id },
          data:  { isActive: true },
        });
      }
      return existing;
    }

    const createData: any = {
      currency,
      balance: new Prisma.Decimal(0),
      reservedBalance: new Prisma.Decimal(0),
      isActive: true,
      isDefault: false,
    };

    if (agencyId) {
      createData.agencyId = agencyId;
    } else if (clientId !== undefined) {
      createData.clientId = clientId;
    } else {
      createData.userId = userId;
    }

    const created = await this.prisma.wallet.create({ data: createData });
    return created;
  }

  // ========================================================
  // GET WALLETS FOR USER
  // ✅ v5.3 : SUPER_ADMIN ET COMPANY_ADMIN → wallets clientId
  //           Le SA reçoit les virements B2B sur son wallet clientId.
  //           Avant v5.3, SUPER_ADMIN tombait sur le fallback userId
  //           (wallet vide) → solde toujours affiché à 0.
  // ========================================================

  async getWalletsForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, clientId: true },
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable');

    // ✅ FIX v5.3 : SUPER_ADMIN inclus — même logique que COMPANY_ADMIN
    if (
      (user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN') &&
      user.clientId
    ) {
      const clientWallets = await this.prisma.wallet.findMany({
        where: { clientId: user.clientId, isActive: true },
        orderBy: { currency: 'asc' },
      });

      if (clientWallets.length > 0) {
        return clientWallets.map((w) => this.serialize(w));
      }
    }

    // Fallback : wallets userId (agents, users normaux)
    const wallets = await this.prisma.wallet.findMany({
      where: { userId, isActive: true },
      orderBy: { currency: 'asc' },
    });
    return wallets.map((w) => this.serialize(w));
  }

  // ========================================================
  // GET WALLET BY ID (avec vérification de propriété)
  // ✅ v5.3 : ownership étendu aux wallets clientId
  //    Avant : wallet.userId !== userId → KO pour les wallets clientId
  //    Maintenant : on vérifie aussi si wallet.clientId === user.clientId
  // ========================================================

  async getWalletById(walletId: string, userId: string) {
    const [wallet, user] = await Promise.all([
      this.prisma.wallet.findUnique({ where: { id: walletId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { clientId: true, role: true },
      }),
    ]);

    if (!wallet) throw new NotFoundException('Wallet introuvable');

    const ownedByUserId  = wallet.userId === userId;
    const ownedByClient  = !!user?.clientId && wallet.clientId === user.clientId;

    if (!ownedByUserId && !ownedByClient) {
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
    const page  = params.page  ?? 1;
    const limit = params.limit ?? 20;
    const skip  = (page - 1) * limit;

    const where: any = { walletId };
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to)   where.createdAt.lte = new Date(params.to);
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
        amount:       Number(e.amount),
        balanceAfter: Number(e.balanceAfter),
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ========================================================
  // SAFE LOCK (ANTI RACE CONDITION)
  // ========================================================

  private async lockWallet(
    tx: Prisma.TransactionClient,
    walletId: string,
  ): Promise<void> {
    const lockKey = uuidToLockKey(walletId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
  }

  // ========================================================
  // DEBIT
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

      const amt       = new Prisma.Decimal(amount);
      const available = wallet.balance.minus(wallet.reservedBalance);

      if (available.lessThan(amt)) {
        throw new BadRequestException(
          `Solde insuffisant: ${available} ${wallet.currency}`,
        );
      }

      const updated = await tx.wallet.update({
        where: { id: walletId },
        data:  { balance: { decrement: amt } },
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
  // CREDIT
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
        data:  { balance: { increment: amt } },
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

      const amt       = new Prisma.Decimal(amount);
      const available = wallet.balance.minus(wallet.reservedBalance);

      if (available.lessThan(amt)) {
        throw new BadRequestException('Fonds insuffisants');
      }

      const updated = await tx.wallet.update({
        where: { id: walletId },
        data:  { reservedBalance: { increment: amt } },
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
        data:  { reservedBalance: { decrement: amt } },
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
  // TRANSFER
  // ========================================================

  async transfer(params: {
    fromWalletId: string;
    toWalletId:   string;
    amount:       number;
    description:  string;
  }) {
    const { fromWalletId, toWalletId, amount, description } = params;
    if (amount <= 0) throw new BadRequestException('Montant invalide');

    return this.prisma.$transaction(async (tx) => {
      const ids = [fromWalletId, toWalletId].sort();
      await this.lockWallet(tx, ids[0]);
      await this.lockWallet(tx, ids[1]);

      const fromWallet = await tx.wallet.findUnique({ where: { id: fromWalletId } });
      const toWallet   = await tx.wallet.findUnique({ where: { id: toWalletId } });

      if (!fromWallet || !toWallet) throw new NotFoundException('Wallet introuvable');

      const fromAmt   = new Prisma.Decimal(amount);
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
        data:  { balance: { decrement: fromAmt } },
      });

      const updatedTo = await tx.wallet.update({
        where: { id: toWalletId },
        data:  { balance: { increment: toAmount } },
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
        to:   this.serialize(updatedTo),
        rate,
      };
    });
  }

  // ========================================================
  // SERIALIZE
  // ========================================================

  private serialize(w: any) {
    const balance  = Number(w.balance);
    const reserved = Number(w.reservedBalance);
    return {
      id:               w.id,
      currency:         w.currency,
      balance,
      reservedBalance:  reserved,
      availableBalance: balance - reserved,
      isDefault:        w.isDefault,
      isActive:         w.isActive,
    };
  }
}