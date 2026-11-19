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
  DEFAULT_REFERRAL, LOCK_MESSAGE, REFERRAL_KIND, judgeLock, normalizeReferralCode, rewardExpiry, startOfMonthUtc,
  type ReferralSettings,
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
  await tx.referralReward.updateMany({ where: { id: rewardId, remaining: { lte: 0 }, status: 'AVAILABLE' }, data: { status: 'USED' } });
}

/**
 * Premier envoi abouti d'un filleul → le parrain gagne ses envois sans frais (une seule fois par filleul,
 * garanti par l'unicité (parrain, type, filleul), et dans la limite mensuelle). Jamais bloquant.
 */
export async function rewardReferrerOnFirstTransfer(
  db: Db,
  p: { clientId: number; senderId: string; transactionId: string; amount: number; now?: Date },
): Promise<void> {
  try {
    const now = p.now ?? new Date();
    const sender = await db.user.findUnique({ where: { id: p.senderId }, select: { referredById: true, firstName: true } });
    if (!sender?.referredById) return;

    const cfg = await loadReferralSettings(db, p.clientId);
    if (!cfg.isActive || cfg.referrerWaivers <= 0) return;
    if (p.amount < cfg.minFirstTransfer) return;

    // Premier envoi seulement : aucun autre envoi de ce client (hors annulés / échoués) avant celui-ci.
    const earlier = await db.transaction.count({
      where: {
        senderId: p.senderId, type: 'TRANSFER', id: { not: p.transactionId }, deletedAt: null,
        status: { notIn: ['CANCELLED', 'FAILED', 'EXPIRED'] },
      },
    });
    if (earlier > 0) return;

    const monthly = await db.referralReward.count({
      where: { userId: sender.referredById, kind: REFERRAL_KIND.referrer, createdAt: { gte: startOfMonthUtc(now) } },
    });
    if (monthly >= cfg.maxRewardsPerMonth) return;

    await db.referralReward.create({
      data: {
        clientId: p.clientId, userId: sender.referredById, kind: REFERRAL_KIND.referrer, sourceUserId: p.senderId,
        remaining: cfg.referrerWaivers, expiresAt: rewardExpiry(now, cfg.rewardValidityDays),
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
