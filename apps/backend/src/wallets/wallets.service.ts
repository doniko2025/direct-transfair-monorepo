// apps/backend/src/wallets/wallets.service.ts
// =========================================================
// WALLETS SERVICE v5.9
// ✅ v5.9 (audit du code) : (1) transferInTx() convertit avec RatesService.convert() (taux de la base, repli en dur seulement si absent)
//    au lieu de getRate() qui ignorait les taux saisis par l'admin ; (2) getLedger() valide page / limit (≤ 100) / dates.
// ✅ v5.8 : creditInTx accepte { allowFrozen: true } (paramètre ajouté en dernier). Réservé aux commissions versées à des
//    TIERS lors du paiement d'un code (agence d'envoi, société) : le gel du wallet d'un tiers ne doit pas empêcher un
//    retrait déjà autorisé d'être payé au bénéficiaire. L'argent arrive sur le wallet gelé (il reste bloqué pour les
//    sorties) ; le journal garde la trace. Tous les autres crédits continuent de refuser un wallet gelé.
// ✅ v5.7 (audit points 6 et 9) :
//    (1) GEL DE WALLET APPLIQUÉ. Wallet.isFrozen (gel conformité / LCB-FT) n'était lu que pour l'affichage : un wallet gelé
//        continuait d'envoyer et de recevoir. debitInTx, creditInTx, transferInTx (source ET destination) et hold refusent
//        maintenant un wallet gelé (403, code WALLET_FROZEN). unhold reste permis (libérer une réserve ne sort pas d'argent).
//        ⚠️ Conséquence voulue : un remboursement (annulation / échec) vers un wallet gelé est refusé tant que le gel dure.
//    (2) transferInTx : montant converti arrondi à la devise de destination (avant : 65 595,7 XOF stockés en flottant) ;
//        un transfert d'un wallet vers lui-même est refusé (deux lignes de journal pour un effet nul).
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
//
// ✅ v5.5 (phase 6) : creditInTx() / debitInTx() / creditOnce()
//   debit() et credit() ouvrent leur propre $transaction : impossible de les
//   rendre atomiques avec un changement de statut de Transaction (annulation,
//   validation B2B…). creditInTx/debitInTx font exactement le même travail
//   (verrou, contrôle, mise à jour, ligne de ledger) sur un client Prisma
//   DÉJÀ ouvert par l'appelant ; debit() et credit() les appellent, leur
//   comportement ne change pas. creditOnce() = crédit idempotent par (wallet, transaction), sous verrou.
//
// ✅ v5.6 (phase 6) : transferInTx() — le transfert entre deux wallets sur un client Prisma DÉJÀ ouvert, pour
//   l'écrire dans la même transaction SQL que la ligne Transaction (remontée de fonds, retrait forcé) ;
//   transfer() l'appelle, son comportement ne change pas. transactionId (optionnel) relie les lignes de ledger
//   à la Transaction.
// =========================================================

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { roundToCurrency } from '../fee-schedule/fee-engine';
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
    // ✅ audit : paramètres validés — page ≥ 1, limit entre 1 et 100, dates lisibles (avant : NaN, date invalide → erreur 500,
    // et limit non plafonnée).
    const page  = Number.isInteger(params.page)  && (params.page  as number) >= 1 ? (params.page  as number) : 1;
    const limit = Number.isInteger(params.limit) && (params.limit as number) >= 1 ? Math.min(params.limit as number, 100) : 20;
    const skip  = (page - 1) * limit;

    const where: any = { walletId };
    if (params.from || params.to) {
      const from = params.from ? new Date(params.from) : null;
      const to   = params.to   ? new Date(params.to)   : null;
      if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
        throw new BadRequestException('Date invalide : utilisez le format AAAA-MM-JJ.');
      }
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to)   where.createdAt.lte = to;
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

  /** ✅ v5.7 : un wallet gelé (conformité / LCB-FT) ne reçoit ni ne sort d'argent. */
  private assertNotFrozen(wallet: { isFrozen?: boolean | null; frozenReason?: string | null }): void {
    if (wallet.isFrozen) {
      throw new ForbiddenException({
        code: 'WALLET_FROZEN',
        message: `Ce wallet est gelé${wallet.frozenReason ? ` (${wallet.frozenReason})` : ''} : opération refusée.`,
      });
    }
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
    return this.prisma.$transaction((tx) =>
      this.debitInTx(tx, walletId, amount, description, transactionId),
    );
  }

  /** Débit sur un client Prisma déjà ouvert (atomique avec le reste de l'appelant). */
  async debitInTx(
    tx: Prisma.TransactionClient,
    walletId: string,
    amount: number,
    description: string,
    transactionId?: string,
  ) {
    if (amount <= 0) throw new BadRequestException('Montant invalide');

    await this.lockWallet(tx, walletId);

    const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet introuvable');
    this.assertNotFrozen(wallet); // ✅ v5.7

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
    return this.prisma.$transaction((tx) =>
      this.creditInTx(tx, walletId, amount, description, transactionId),
    );
  }

  /** Crédit sur un client Prisma déjà ouvert (atomique avec le reste de l'appelant). */
  async creditInTx(
    tx: Prisma.TransactionClient,
    walletId: string,
    amount: number,
    description: string,
    transactionId?: string,
    opts?: { allowFrozen?: boolean },
  ) {
    if (amount <= 0) throw new BadRequestException('Montant invalide');

    await this.lockWallet(tx, walletId);

    const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet introuvable');
    if (!opts?.allowFrozen) this.assertNotFrozen(wallet); // ✅ v5.7 (v5.8 : sauf commission de tiers)

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
  }

  /**
   * Crédit idempotent : ne crédite JAMAIS deux fois la même transaction sur ce wallet.
   * Le contrôle « déjà crédité ? » et le crédit sont faits sous le verrou du wallet, dans la même
   * transaction SQL : deux appels simultanés (double sondage du mobile) ne créditent qu'une fois.
   * Renvoie false si le crédit existait déjà.
   */
  async creditOnce(
    walletId: string,
    amount: number,
    description: string,
    transactionId: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockWallet(tx, walletId);

      const already = await tx.ledgerEntry.findFirst({
        where:  { walletId, transactionId, type: 'CREDIT' },
        select: { id: true },
      });
      if (already) return false;

      await this.creditInTx(tx, walletId, amount, description, transactionId);
      return true;
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
      this.assertNotFrozen(wallet); // ✅ v5.7

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
    transactionId?: string;
  }) {
    if (params.amount <= 0) throw new BadRequestException('Montant invalide');

    return this.prisma.$transaction((tx) => this.transferInTx(tx, params));
  }

  /** Transfert entre deux wallets sur un client Prisma déjà ouvert (atomique avec le reste de l'appelant). */
  async transferInTx(
    tx: Prisma.TransactionClient,
    params: { fromWalletId: string; toWalletId: string; amount: number; description: string; transactionId?: string },
  ) {
    const { fromWalletId, toWalletId, amount, description, transactionId } = params;
    if (amount <= 0) throw new BadRequestException('Montant invalide');
    if (fromWalletId === toWalletId) {
      throw new BadRequestException('Le wallet source et le wallet destination sont identiques.'); // ✅ v5.7
    }

    // ✅ audit : le taux vient de la base (taux saisis par l'admin), pas des taux codés en dur de getRate(). Il est lu AVANT
    // la prise des verrous (la devise d'un wallet ne change jamais) pour ne pas garder un verrou pendant une requête de taux.
    const pre = await tx.wallet.findMany({
      where:  { id: { in: [fromWalletId, toWalletId] } },
      select: { id: true, currency: true },
    });
    const preFrom = pre.find((w) => w.id === fromWalletId);
    const preTo   = pre.find((w) => w.id === toWalletId);
    if (!preFrom || !preTo) throw new NotFoundException('Wallet introuvable');
    const rawConverted = preFrom.currency === preTo.currency
      ? amount
      : await this.rates.convert(amount, preFrom.currency, preTo.currency);

    const ids = [fromWalletId, toWalletId].sort();
    await this.lockWallet(tx, ids[0]);
    await this.lockWallet(tx, ids[1]);

    const fromWallet = await tx.wallet.findUnique({ where: { id: fromWalletId } });
    const toWallet   = await tx.wallet.findUnique({ where: { id: toWalletId } });

    if (!fromWallet || !toWallet) throw new NotFoundException('Wallet introuvable');
    this.assertNotFrozen(fromWallet); // ✅ v5.7
    this.assertNotFrozen(toWallet);

    const fromAmt   = new Prisma.Decimal(amount);
    const available = fromWallet.balance.minus(fromWallet.reservedBalance);

    if (available.lessThan(fromAmt)) {
      throw new BadRequestException('Solde insuffisant');
    }

    const rate = amount > 0 ? rawConverted / amount : 1;

    // ✅ v5.7 : arrondi à la devise de destination (XOF / GNF : unités entières, autres : 2 décimales).
    const toAmount = new Prisma.Decimal(roundToCurrency(rawConverted, toWallet.currency));
    if (toAmount.lte(0)) throw new BadRequestException('Montant converti nul : augmentez le montant.');

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
          transactionId,
          balanceAfter: updatedFrom.balance,
        },
        {
          walletId: toWalletId,
          type: 'CREDIT',
          amount: toAmount,
          currency: toWallet.currency,
          description,
          transactionId,
          balanceAfter: updatedTo.balance,
        },
      ],
    });

    return {
      from: this.serialize(updatedFrom),
      to:   this.serialize(updatedTo),
      rate,
    };
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