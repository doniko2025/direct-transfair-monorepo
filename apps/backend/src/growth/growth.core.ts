// apps/backend/src/growth/growth.core.ts
// =========================================================
// LOGIQUE « CROISSANCE » SOUS FORME DE FONCTIONS SIMPLES (aucune classe, aucune injection).
// Elles prennent le client Prisma (ou la transaction en cours) en paramètre : AuthService et TransactionsService
// peuvent donc s'en servir sans changer leur constructeur (leurs tests les construisent à la main) et sans
// créer de dépendance circulaire entre modules.
//
// Règle d'or : tout ce qui est « bonus » (rattachement du parrain, récompense du parrain) ne doit JAMAIS faire
// échouer une inscription ou un envoi → ces fonctions-là attrapent leurs erreurs. Seules la garantie de taux et
// la consommation d'une récompense, qui touchent à l'argent, sont strictes (et s'exécutent dans la transaction).
// =========================================================

import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  DEFAULT_REFERRAL, LOCK_MESSAGE, REFERRAL_KIND, judgeLock, normalizeReferralCode, paidInRequestCurrency, paymentSettlesRequest, rewardExpiry,
  startOfMonthUtc, type PaymentLike, type ReferralSettings,
} from './growth.rules';

type Db = Prisma.TransactionClient;
const logger = new Logger('Growth');

// ── Réglages de parrainage ──────────────────────────────

export async function loadReferralSettings(db: Db, clientId: number): Promise<ReferralSettings> {
  const row = await db.referralConfig.findUnique({ where: { clientId } });
  if (!row) return { ...DEFAULT_REFERRAL };
  return {
    isActive: row.isActive,
    refereeWaivers: row.refereeWaivers,
    referrerWaivers: row.referrerWaivers,
    minFirstTransfer: Number(row.minFirstTransfer),
    rewardValidityDays: row.rewardValidityDays,
    maxRewardsPerMonth: row.maxRewardsPerMonth,
  };
}

// ── Inscription : rattacher le parrain, offrir l'accueil au filleul ──

/**
 * Rattache le nouvel utilisateur à son parrain (code saisi) et lui offre ses envois sans frais de bienvenue.
 * Ne lève jamais d'erreur : un code inconnu ou une panne n'empêchent pas l'inscription.
 * Le rattachement est conservé même si le programme est désactivé (la récompense, elle, dépend du réglage).
 */
export async function attachReferral(db: Db, p: { clientId: number; newUserId: string; rawCode: unknown; now?: Date }): Promise<boolean> {
  try {
    const code = normalizeReferralCode(p.rawCode);
    if (!code) return false;
    const now = p.now ?? new Date();

    const referrer = await db.user.findFirst({
      where: { referralCode: code, clientId: p.clientId, isActive: true },
      select: { id: true },
    });
    if (!referrer || referrer.id === p.newUserId) return false;

    // updateMany : ne rattache que si le compte n'a pas déjà de parrain (jamais de changement de parrain).
    const linked = await db.user.updateMany({ where: { id: p.newUserId, referredById: null }, data: { referredById: referrer.id } });
    if (linked.count === 0) return false;

    const cfg = await loadReferralSettings(db, p.clientId);
    if (cfg.isActive && cfg.refereeWaivers > 0) {
      await db.referralReward.create({
        data: {
          clientId: p.clientId, userId: p.newUserId, kind: REFERRAL_KIND.referee, sourceUserId: referrer.id,
          remaining: cfg.refereeWaivers, expiresAt: rewardExpiry(now, cfg.rewardValidityDays),
        },
      });
      await db.notification.create({
        data: {
          userId: p.newUserId, type: 'INFO', title: 'Bienvenue — envoi sans frais offert', actionUrl: '/referral', space: 'client', groupKey: 'growth',
          message: `Votre parrain vous offre ${cfg.refereeWaivers} envoi${cfg.refereeWaivers > 1 ? 's' : ''} sans frais, valable ${cfg.rewardValidityDays} jours.`,
        },
      });
    }
    return true;
  } catch (e) {
    logger.warn(`Rattachement du parrain impossible : ${(e as Error)?.message}`);
    return false;
  }
}

// ── Envoi : récompense « envoi sans frais » ─────────────

export interface UsableReward { id: string; kind: string; remaining: number }

/** La récompense à consommer en premier : celle qui expire le plus tôt. */
export async function findUsableWaiver(db: Db, userId: string, now: Date = new Date()): Promise<UsableReward | null> {
  const r = await db.referralReward.findFirst({
    where: { userId, status: 'AVAILABLE', remaining: { gt: 0 }, expiresAt: { gt: now } },
    orderBy: { expiresAt: 'asc' },
    select: { id: true, kind: true, remaining: true },
  });
  return r;
}

/**
 * Consomme UN envoi sans frais, dans la transaction de l'envoi. Atomique : si deux envois simultanés se disputent
 * la dernière récompense, un seul la gagne et l'autre échoue (l'utilisateur relance, les frais s'appliquent).
 */
export async function consumeWaiver(tx: Db, rewardId: string, transactionId: string, now: Date = new Date()): Promise<void> {
  const res = await tx.referralReward.updateMany({
    where: { id: rewardId, status: 'AVAILABLE', remaining: { gt: 0 }, expiresAt: { gt: now } },
    data: { remaining: { decrement: 1 }, usedAt: now, transactionId },
  });
  if (res.count === 0) throw new ConflictException('Votre envoi sans frais vient d’être utilisé par un autre envoi. Relancez : les frais habituels s’appliqueront.');
  // Une ligne par utilisation : l'envoi annulé rendra exactement SON envoi sans frais (voir restoreWaiverOf).
  await tx.referralRewardUse.create({ data: { rewardId, transactionId } });
  await tx.referralReward.updateMany({ where: { id: rewardId, remaining: { lte: 0 }, status: 'AVAILABLE' }, data: { status: 'USED' } });
}

/**
 * Rend l'envoi sans frais consommé par un envoi qui n'a finalement pas abouti (annulé, expiré, échoué, rappelé) : le client avait été
 * facturé sans frais, mais comme il récupère tout son argent, il ne doit pas perdre son avantage en plus. Dans la transaction SQL du
 * remboursement. Chaque utilisation est enregistrée (ReferralRewardUse) : l'envoi rendu est EXACTEMENT celui de cet envoi, même quand la
 * récompense en offrait plusieurs. Idempotent. Une récompense marquée expirée n'est pas ressuscitée. Renvoie true si un envoi a été rendu.
 */
export async function restoreWaiverOf(tx: Db, transactionId: string): Promise<boolean> {
  const use = await tx.referralRewardUse.findUnique({ where: { transactionId } });
  if (!use) return false;
  const removed = await tx.referralRewardUse.deleteMany({ where: { id: use.id } });
  if (removed.count === 0) return false; // un autre appel l'a déjà rendu
  await tx.referralReward.updateMany({
    where: { id: use.rewardId, status: { in: ['AVAILABLE', 'USED'] } },
    data: { remaining: { increment: 1 }, status: 'AVAILABLE' },
  });
  // La colonne « dernier envoi » ne doit plus pointer sur un envoi annulé.
  await tx.referralReward.updateMany({ where: { id: use.rewardId, transactionId }, data: { transactionId: null } });
  return true;
}

/**
 * Retire la récompense gagnée par le PARRAIN grâce à un envoi de son filleul, quand cet envoi est rappelé : le filleul n'a finalement pas
 * fait ce « premier envoi ». Dans la transaction SQL du rappel.
 *   • récompense encore intacte → supprimée (le prochain premier envoi PAYÉ du filleul la redonnera) ;
 *   • déjà en partie utilisée → les envois sans frais restants sont retirés, ceux déjà utilisés restent acquis.
 * Renvoie true si une récompense a été retirée ou réduite.
 */
export async function revokeReferrerRewardOf(tx: Db, transactionId: string): Promise<boolean> {
  const reward = await tx.referralReward.findFirst({ where: { grantedByTransactionId: transactionId, kind: REFERRAL_KIND.referrer } });
  if (!reward) return false;
  const used = await tx.referralRewardUse.count({ where: { rewardId: reward.id } });
  if (used === 0) {
    const gone = await tx.referralReward.deleteMany({ where: { id: reward.id } });
    return gone.count > 0;
  }
  const cut = await tx.referralReward.updateMany({ where: { id: reward.id }, data: { remaining: 0, status: 'USED' } });
  return cut.count > 0;
}

/**
 * Rouvre la demande d'argent réglée par un envoi qui est ensuite remboursé (rappel par le service client) : le demandeur n'a plus l'argent,
 * la demande ne doit plus apparaître « payée ». Encore valable → de nouveau « en attente » ; échue entre-temps → « expirée ».
 * Dans la transaction SQL du remboursement. Renvoie true si une demande a été rouverte.
 */
export async function reopenMoneyRequestOf(tx: Db, transactionId: string, now: Date = new Date()): Promise<boolean> {
  const live = await tx.moneyRequest.updateMany({
    where: { paidTransactionId: transactionId, status: 'PAID', expiresAt: { gt: now } },
    data: { status: 'PENDING', respondedAt: null, paidTransactionId: null },
  });
  if (live.count > 0) return true;
  const late = await tx.moneyRequest.updateMany({
    where: { paidTransactionId: transactionId, status: 'PAID' },
    data: { status: 'EXPIRED', paidTransactionId: null },
  });
  return late.count > 0;
}

/**
 * Devise de référence du programme : le « premier envoi minimal » s'exprime dans la devise principale de la société (clients.defaultCurrency),
 * pas dans celle de chaque filleul (5 000 GNF et 5 EUR n'étaient comparés qu'à un seul et même chiffre).
 */
export async function referralReferenceCurrency(db: Db, clientId: number): Promise<string | null> {
  const row = await db.client.findUnique({ where: { id: clientId }, select: { defaultCurrency: true } });
  return row?.defaultCurrency ? String(row.defaultCurrency) : null;
}

/**
 * Premier envoi PAYÉ d'un filleul → le parrain gagne ses envois sans frais (une seule fois par filleul, garanti par l'unicité
 * (parrain, type, filleul), et dans la limite mensuelle). Jamais bloquant.
 *
 * À appeler quand l'envoi est réellement payé : à la création pour un envoi vers un portefeuille (crédité tout de suite), au paiement du
 * code en agence pour un retrait cash. Avant : à la création de tout envoi, même un envoi cash ensuite annulé ou expiré (le parrain
 * gardait sa récompense). « Premier » = aucun autre envoi PAYÉ de ce client avant celui-ci.
 *
 * `convert` ramène le montant dans la devise de référence quand le minimum est > 0 ; sans conversion possible, pas de récompense.
 */
export async function rewardReferrerOnFirstTransfer(
  db: Db,
  p: {
    clientId: number; senderId: string; transactionId: string; amount: number; currency?: string; now?: Date;
    convert?: (amount: number, from: string, to: string) => Promise<number>;
  },
): Promise<void> {
  try {
    const now = p.now ?? new Date();
    const sender = await db.user.findUnique({ where: { id: p.senderId }, select: { referredById: true, firstName: true } });
    if (!sender?.referredById) return;

    const cfg = await loadReferralSettings(db, p.clientId);
    if (!cfg.isActive || cfg.referrerWaivers <= 0) return;

    if (cfg.minFirstTransfer > 0) {
      const reference = await referralReferenceCurrency(db, p.clientId);
      let comparable = p.amount;
      if (reference && p.currency && p.currency !== reference) {
        if (!p.convert) return;
        comparable = await p.convert(p.amount, p.currency, reference);
      }
      if (!(comparable >= cfg.minFirstTransfer)) return;
    }

    // Premier envoi PAYÉ seulement : aucun autre envoi payé de ce client avant celui-ci.
    const earlier = await db.transaction.count({
      where: { senderId: p.senderId, type: 'TRANSFER', id: { not: p.transactionId }, deletedAt: null, status: 'PAID' },
    });
    if (earlier > 0) return;

    const monthly = await db.referralReward.count({
      where: { userId: sender.referredById, kind: REFERRAL_KIND.referrer, createdAt: { gte: startOfMonthUtc(now) } },
    });
    if (monthly >= cfg.maxRewardsPerMonth) return;

    await db.referralReward.create({
      data: {
        clientId: p.clientId, userId: sender.referredById, kind: REFERRAL_KIND.referrer, sourceUserId: p.senderId,
        remaining: cfg.referrerWaivers, expiresAt: rewardExpiry(now, cfg.rewardValidityDays), grantedByTransactionId: p.transactionId,
      },
    });
    await db.notification.create({
      data: {
        userId: sender.referredById, type: 'INFO', title: 'Parrainage : envoi sans frais gagné 🎉', actionUrl: '/referral', space: 'client', groupKey: 'growth',
        message: `${sender.firstName ?? 'Votre filleul'} vient de faire son premier envoi : ${cfg.referrerWaivers} envoi${cfg.referrerWaivers > 1 ? 's' : ''} sans frais pour vous, valable ${cfg.rewardValidityDays} jours.`,
      },
    });
  } catch (e) {
    // P2002 = récompense déjà donnée pour ce filleul : cas normal, pas une erreur.
    if ((e as { code?: string })?.code !== 'P2002') logger.warn(`Récompense du parrain impossible : ${(e as Error)?.message}`);
  }
}

// ── Garantie de taux ────────────────────────────────────

export interface LockedRate { id: string; rate: number; receivedAmount: number }

/** Vérifie une garantie pour CET envoi. Lève une erreur claire sinon (avant tout débit). */
export async function resolveRateLock(
  db: Db,
  p: { lockId: string; userId: string; currency: string; targetCurrency: string; amount: number; now?: Date },
): Promise<LockedRate> {
  const lock = await db.rateLock.findUnique({ where: { id: p.lockId } });
  if (!lock) throw new BadRequestException(LOCK_MESSAGE.FOREIGN);
  const verdict = judgeLock(
    { userId: lock.userId, currency: lock.currency, targetCurrency: lock.targetCurrency, amount: Number(lock.amount), expiresAt: lock.expiresAt, consumedAt: lock.consumedAt },
    { userId: p.userId, currency: p.currency, targetCurrency: p.targetCurrency, amount: p.amount },
    p.now ?? new Date(),
  );
  if (verdict !== 'OK') throw new BadRequestException(LOCK_MESSAGE[verdict]);
  return { id: lock.id, rate: lock.rate, receivedAmount: Number(lock.receivedAmount) };
}

/** Marque la garantie comme utilisée, dans la transaction de l'envoi (un seul envoi par garantie). */
export async function consumeRateLock(tx: Db, lockId: string, transactionId: string, now: Date = new Date()): Promise<void> {
  const res = await tx.rateLock.updateMany({
    where: { id: lockId, consumedAt: null, expiresAt: { gt: now } },
    data: { consumedAt: now, transactionId },
  });
  if (res.count === 0) throw new BadRequestException(LOCK_MESSAGE.USED);
}


// ── Demandes d'argent : règlement par l'envoi fait POUR elle ─────────────────────────────

export interface SettledRequest {
  id: string;
  requesterId: string;
  asked: number;
  got: number;
  currency: string;
  transactionId: string;
}

/**
 * Règle UNE demande précise avec l'envoi qui vient d'être créé (appelé dans la transaction SQL de l'envoi : l'envoi et le règlement
 * réussissent ou échouent ensemble). Le lien est explicite (`moneyRequestId` envoyé par l'écran « Payer ») : un envoi quelconque du
 * payeur au demandeur ne règle plus une demande par hasard. Règle : bon payeur, bon destinataire, même société, demande encore en attente
 * et non échue, montant reçu (dans la devise de la demande) au moins égal au montant demandé. Sinon : null, l'envoi reste un envoi normal.
 */
export async function settleLinkedMoneyRequest(
  db: Db,
  p: {
    requestId: string; clientId: number; payerId: string; requesterId: string;
    transaction: { id: string; currency: string; amount: number; targetCurrency: string | null; receivedAmount: number };
    now?: Date;
  },
): Promise<SettledRequest | null> {
  const now = p.now ?? new Date();
  const r = await db.moneyRequest.findFirst({ where: { id: p.requestId, clientId: p.clientId, payerId: p.payerId, requesterId: p.requesterId, status: 'PENDING', expiresAt: { gt: now } } });
  if (!r) return null;
  const like: PaymentLike = {
    senderId: p.payerId, recipientId: p.requesterId, clientId: p.clientId, status: 'PAID', currency: p.transaction.currency, amount: p.transaction.amount,
    targetCurrency: p.transaction.targetCurrency, receivedAmount: p.transaction.receivedAmount, createdAt: now, deletedAt: null,
  };
  const req = { clientId: r.clientId, requesterId: r.requesterId, payerId: r.payerId, amount: Number(r.amount), currency: String(r.currency), createdAt: r.createdAt, expiresAt: r.expiresAt };
  if (!paymentSettlesRequest(req, like)) return null;
  const done = await db.moneyRequest.updateMany({ where: { id: r.id, status: 'PENDING' }, data: { status: 'PAID', respondedAt: now, paidTransactionId: p.transaction.id } });
  if (done.count === 0) return null;
  return { id: r.id, requesterId: r.requesterId, asked: Number(r.amount), got: paidInRequestCurrency(like, String(r.currency)), currency: String(r.currency), transactionId: p.transaction.id };
}

/** Texte de la notification « Demande réglée » : annonce le montant réellement reçu quand il dépasse la demande. */
export function settledRequestMessage(s: Pick<SettledRequest, 'asked' | 'got' | 'currency'>): string {
  const asked = `${s.asked.toLocaleString('fr-FR')} ${s.currency}`;
  return Math.abs(s.got - s.asked) < 0.005
    ? `Votre demande de ${asked} a été réglée.`
    : `Votre demande de ${asked} a été réglée : vous avez reçu ${s.got.toLocaleString('fr-FR')} ${s.currency}.`;
}
