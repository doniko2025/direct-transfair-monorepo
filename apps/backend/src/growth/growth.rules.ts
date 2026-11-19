// apps/backend/src/growth/growth.rules.ts
// =========================================================
// RÈGLES PURES DU LOT 16 (croissance) — aucune lecture en base, testables seules.
//   • garantie de taux  : durée, validité d'une garantie pour un envoi donné
//   • demandes d'argent : expiration, rapprochement d'une demande avec l'envoi qui la règle
//   • parrainage        : validité des récompenses, normalisation du code saisi
// =========================================================

import { BadRequestException } from '@nestjs/common';

// ── Garantie de taux ────────────────────────────────────

// ✅ audit argent (M2) : une garantie de taux est une OPTION GRATUITE offerte au client (si le marché se retourne en sa faveur il
// envoie au taux du marché, sinon au taux garanti). Deux garde-fous : une durée courte (5 min au lieu de 10) et une petite marge
// (0,2 %) retenue sur le taux garanti — réglables par RATE_LOCK_MINUTES et RATE_LOCK_MARGIN_PCT.
export const RATE_LOCK_DEFAULT_MINUTES = 5;
export const RATE_LOCK_DEFAULT_MARGIN_PCT = 0.2;
export const MAX_OPEN_LOCKS = 5;

/** Marge retenue sur le taux garanti, en % : RATE_LOCK_MARGIN_PCT (0 à 5), 0,2 par défaut. */
export function lockMarginPct(raw: unknown = process.env.RATE_LOCK_MARGIN_PCT): number {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.replace(',', '.')) : (raw as number);
  if (typeof n !== 'number' || !Number.isFinite(n)) return RATE_LOCK_DEFAULT_MARGIN_PCT;
  return Math.max(0, Math.min(5, n));
}

/** Montant converti après marge : le client garde la garantie, la plateforme garde un coussin contre un mouvement du marché. */
export function applyLockMargin(convertedAmount: number, marginPct: number): number {
  return convertedAmount * (1 - Math.max(0, marginPct) / 100);
}

/** Durée de la garantie en minutes : RATE_LOCK_MINUTES (2 à 30), 5 par défaut. */
export function lockMinutes(raw: unknown = process.env.RATE_LOCK_MINUTES): number {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : (raw as number);
  if (typeof n !== 'number' || !Number.isFinite(n)) return RATE_LOCK_DEFAULT_MINUTES;
  return Math.max(2, Math.min(30, Math.round(n)));
}

export function addMinutes(from: Date, minutes: number): Date {
  return new Date(from.getTime() + minutes * 60_000);
}

export type LockVerdict = 'OK' | 'EXPIRED' | 'USED' | 'MISMATCH' | 'FOREIGN';

export interface LockLike {
  userId: string;
  currency: string;
  targetCurrency: string;
  amount: number;
  expiresAt: Date;
  consumedAt: Date | null;
}

/** Une garantie sert un seul envoi : même client, mêmes devises, même montant, non expirée, non consommée. */
export function judgeLock(lock: LockLike, ask: { userId: string; currency: string; targetCurrency: string; amount: number }, now: Date): LockVerdict {
  if (lock.userId !== ask.userId) return 'FOREIGN';
  if (lock.consumedAt) return 'USED';
  if (lock.expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  if (lock.currency !== ask.currency || lock.targetCurrency !== ask.targetCurrency || Math.abs(lock.amount - ask.amount) > 1e-6) return 'MISMATCH';
  return 'OK';
}

export const LOCK_MESSAGE: Record<Exclude<LockVerdict, 'OK'>, string> = {
  EXPIRED: 'Le taux garanti a expiré. Demandez un nouveau taux pour confirmer le montant que recevra votre bénéficiaire.',
  USED: 'Ce taux garanti a déjà servi pour un envoi.',
  MISMATCH: 'Le taux garanti ne correspond plus à cet envoi (montant ou devise modifié). Demandez un nouveau taux.',
  FOREIGN: 'Taux garanti introuvable.',
};

// ── Demandes d'argent ───────────────────────────────────

export const REQUEST_DEFAULT_DAYS = 7;
export const MAX_OPEN_REQUESTS = 20;
export const MAX_REQUEST_AMOUNT = 100_000_000;

export function requestDays(raw: unknown = process.env.MONEY_REQUEST_DAYS): number {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : (raw as number);
  if (typeof n !== 'number' || !Number.isFinite(n)) return REQUEST_DEFAULT_DAYS;
  return Math.max(1, Math.min(30, Math.round(n)));
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000);
}

export function parseRequestAmount(raw: unknown): number {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.replace(',', '.')) : (raw as number);
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > MAX_REQUEST_AMOUNT) throw new BadRequestException('Montant demandé invalide.');
  return Math.round(n * 100) / 100;
}

export interface PaymentLike {
  senderId: string;
  recipientId: string | null;
  clientId: number;
  status: string;
  currency: string;
  amount: number;
  targetCurrency: string | null;
  receivedAmount: number;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface RequestLike {
  clientId: number;
  requesterId: string;
  payerId: string;
  amount: number;
  currency: string;
  createdAt: Date;
}

/** Montant reçu par le demandeur dans la devise de la demande (0 si l'envoi ne la couvre pas). */
export function paidInRequestCurrency(p: PaymentLike, requestCurrency: string): number {
  if (p.targetCurrency === requestCurrency && p.receivedAmount > 0) return p.receivedAmount;
  if (p.currency === requestCurrency && (!p.targetCurrency || p.targetCurrency === p.currency)) return p.amount;
  return 0;
}

/**
 * L'envoi règle la demande si : c'est un envoi du payeur vers le demandeur, de la même société, abouti, postérieur à la demande,
 * et son montant reçu dans la devise demandée couvre le montant demandé.
 */
export function paymentSettlesRequest(req: RequestLike, p: PaymentLike): boolean {
  if (p.deletedAt) return false;
  if (p.clientId !== req.clientId || p.senderId !== req.payerId || p.recipientId !== req.requesterId) return false;
  if (p.status !== 'PAID') return false;
  if (p.createdAt.getTime() < req.createdAt.getTime() - 1000) return false;
  return paidInRequestCurrency(p, req.currency) + 1e-6 >= req.amount;
}

// ── Parrainage ──────────────────────────────────────────

/** Code saisi à l'inscription : majuscules, sans espaces ; vide si absent ou absurde. */
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase().replace(/\s+/g, '');
  return /^[A-Z0-9-]{4,24}$/.test(code) ? code : null;
}

export const REFERRAL_KIND = { referee: 'REFEREE_WELCOME', referrer: 'REFERRER_BONUS' } as const;

export function rewardExpiry(from: Date, days: number): Date {
  return addDays(from, Math.max(1, Math.min(365, Math.round(days))));
}

export function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export interface ReferralSettings {
  isActive: boolean;
  refereeWaivers: number;
  referrerWaivers: number;
  minFirstTransfer: number;
  rewardValidityDays: number;
  maxRewardsPerMonth: number;
}

export const DEFAULT_REFERRAL: ReferralSettings = {
  isActive: false,
  refereeWaivers: 1,
  referrerWaivers: 1,
  minFirstTransfer: 0,
  rewardValidityDays: 30,
  maxRewardsPerMonth: 10,
};

const int = (v: unknown, min: number, max: number, label: string): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : (v as number);
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) throw new BadRequestException(`${label} : entier entre ${min} et ${max}.`);
  return n;
};

export function parseReferralSettings(raw: Partial<Record<keyof ReferralSettings, unknown>>, current: ReferralSettings = DEFAULT_REFERRAL): ReferralSettings {
  const min = raw.minFirstTransfer === undefined ? current.minFirstTransfer : Number(String(raw.minFirstTransfer).replace(',', '.'));
  if (!Number.isFinite(min) || min < 0 || min > 1_000_000_000) throw new BadRequestException('Montant minimal du premier envoi invalide.');
  return {
    isActive: raw.isActive === undefined ? current.isActive : raw.isActive === true,
    refereeWaivers: raw.refereeWaivers === undefined ? current.refereeWaivers : int(raw.refereeWaivers, 0, 10, 'Envois offerts au filleul'),
    referrerWaivers: raw.referrerWaivers === undefined ? current.referrerWaivers : int(raw.referrerWaivers, 0, 10, 'Envois offerts au parrain'),
    minFirstTransfer: min,
    rewardValidityDays: raw.rewardValidityDays === undefined ? current.rewardValidityDays : int(raw.rewardValidityDays, 1, 365, 'Validité (jours)'),
    maxRewardsPerMonth: raw.maxRewardsPerMonth === undefined ? current.maxRewardsPerMonth : int(raw.maxRewardsPerMonth, 1, 1000, 'Plafond mensuel'),
  };
}
