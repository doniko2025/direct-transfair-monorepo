// apps/backend/src/merchants/merchant-extras.ts
// =========================================================
// RÈGLES PURES DU LOT 13 (remboursement · QR permanent · caissiers · clôture et export · alertes) — aucune lecture en base, testables seules.
//   • remboursement : qui peut rembourser quoi, jusqu'à quand
//   • caissiers     : plafond par encaissement
//   • journée       : bornes d'un jour local selon le fuseau de l'appareil, totaux d'une période
//   • export        : CSV lisible par Excel en français (séparateur « ; », virgule décimale, BOM) à l'abri de l'injection de formules
//   • alertes       : solde bas, échecs de paiement répétés
// =========================================================

import { BadRequestException, ConflictException } from '@nestjs/common';
import * as crypto from 'crypto';

import { isZeroDecimal, roundForCurrency } from './merchant-rules';

// ── Constantes ─────────────────────────────────────────

/** Un paiement ne peut plus être remboursé au-delà de ce délai (le litige se règle alors avec le service client). */
export const REFUND_WINDOW_DAYS = 30;
/** Une demande née d'un scan du QR permanent doit être réglée dans ce délai (le temps de saisir le code secret). */
export const STATIC_QR_REQUEST_MINUTES = 3;
export const MAX_STAFF_PER_MERCHANT = 10;
/** Alerte « échecs de paiement » : au moins N échecs en `WINDOW` minutes, puis au plus une alerte toutes les `COOLDOWN` heures. */
export const FAILURE_ALERT_THRESHOLD = 3;
export const FAILURE_ALERT_WINDOW_MINUTES = 60;
export const FAILURE_ALERT_COOLDOWN_HOURS = 6;
/** Garde-fous des rapports. */
export const REPORT_MAX_ROWS = 5000;
export const REPORT_MAX_DAYS = 93;

// ── Références ─────────────────────────────────────────

/** `MF-` remboursement : horodatage base 36 + 6 hex aléatoires (même forme que `MP-` et `MR-`). */
export function generateRefundReference(now = new Date()): string {
  return `MF-${now.getTime().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// ── Remboursement ──────────────────────────────────────

export interface RefundCandidate {
  status: string;
  paidAt: Date | null;
  refundedAt: Date | null;
}

/** Vrai si le paiement est encore remboursable (sans lever d'erreur) — sert à afficher ou masquer le bouton. */
export function isRefundable(r: RefundCandidate, now: Date, windowDays = REFUND_WINDOW_DAYS): boolean {
  if (r.status !== 'PAID' || r.refundedAt || !r.paidAt) return false;
  return now.getTime() - r.paidAt.getTime() <= windowDays * 86_400_000;
}

export function assertRefundable(r: RefundCandidate, now: Date, windowDays = REFUND_WINDOW_DAYS): void {
  if (r.refundedAt) throw new ConflictException('Ce paiement a déjà été remboursé.');
  if (r.status !== 'PAID' || !r.paidAt) throw new BadRequestException('Seul un paiement reçu peut être remboursé.');
  if (!isRefundable(r, now, windowDays)) {
    throw new BadRequestException(`Le délai de remboursement (${windowDays} jours) est dépassé. Contactez le service client.`);
  }
}

/**
 * Remboursement TOTAL : le client récupère tout ce qu'il a payé ; le commerce rend ce montant à son tour (net reçu + commission).
 * La commission n'est pas restituée par la plateforme : elle a rémunéré un service rendu. Le marchand le voit avant de confirmer.
 */
export function refundAmounts(amount: number, fee: number, currency: string): { payerCredit: number; merchantDebit: number; feeLost: number } {
  const total = roundForCurrency(amount, currency);
  return { payerCredit: total, merchantDebit: total, feeLost: roundForCurrency(fee, currency) };
}

// ── Caissiers ──────────────────────────────────────────

/** Un caissier ne peut pas encaisser plus que le plafond fixé par le propriétaire (s'il y en a un). */
export function assertWithinStaffLimit(amount: number, maxAmount: number | null | undefined, currency: string): void {
  if (maxAmount === null || maxAmount === undefined || !(maxAmount > 0)) return;
  if (amount > maxAmount) {
    throw new BadRequestException(`Votre plafond par encaissement est de ${maxAmount.toLocaleString('fr-FR')} ${currency}. Demandez au propriétaire du commerce.`);
  }
}

/** Plafond saisi par le propriétaire : positif, adapté à la devise (entier en GNF / XOF) ; null / vide = pas de plafond. */
export function normalizeStaffLimit(raw: unknown, currency: string): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'string' ? Number(raw) : (raw as number);
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) throw new BadRequestException('Plafond invalide.');
  if (isZeroDecimal(currency) && !Number.isInteger(n)) throw new BadRequestException(`En ${currency}, le plafond doit être un nombre entier.`);
  return roundForCurrency(n, currency);
}

// ── Journées ───────────────────────────────────────────

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** « AAAA-MM-JJ » réel (pas de 31 février). */
export function parseDay(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  const m = DAY_RE.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) return s;
  }
  throw new BadRequestException('Date invalide (attendu : AAAA-MM-JJ).');
}

/** Décalage de fuseau de l'appareil en minutes EN PLUS de l'UTC (Paris hiver : +60), borné à ±14 h ; absent ou invalide → UTC. */
export function parseTzOffset(raw: unknown): number {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : (raw as number);
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.max(-840, Math.min(840, Math.round(n)));
}

/** Début (inclus) et fin (exclue) d'un jour local, exprimés en instants UTC. */
export function dayBounds(day: string, tzOffsetMin: number): { from: Date; to: Date } {
  const m = DAY_RE.exec(parseDay(day))!;
  const startUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - tzOffsetMin * 60_000;
  return { from: new Date(startUtc), to: new Date(startUtc + 86_400_000) };
}

/** Jour local (AAAA-MM-JJ) d'un instant. */
export function localDay(at: Date, tzOffsetMin: number): string {
  return new Date(at.getTime() + tzOffsetMin * 60_000).toISOString().slice(0, 10);
}

/** Période [from, to] en jours locaux (inclus) → bornes UTC. Refuse une période à l'envers ou trop longue. */
export function periodBounds(fromDay: string, toDay: string, tzOffsetMin: number): { from: Date; to: Date; days: number } {
  const a = dayBounds(fromDay, tzOffsetMin);
  const b = dayBounds(toDay, tzOffsetMin);
  if (b.from.getTime() < a.from.getTime()) throw new BadRequestException('La date de fin précède la date de début.');
  const days = Math.round((b.to.getTime() - a.from.getTime()) / 86_400_000);
  if (days > REPORT_MAX_DAYS) throw new BadRequestException(`Période trop longue (${REPORT_MAX_DAYS} jours au maximum).`);
  return { from: a.from, to: b.to, days };
}

// ── Totaux d'une période ───────────────────────────────

export interface SaleRow {
  currency: string;
  amount: number;
  fee: number;
  netAmount: number;
  method: string; // PHONE | QR
  viaStaticQr: boolean;
  createdById: string | null;
}
export interface RefundRow {
  currency: string;
  amount: number;
}
export interface CurrencyTotals {
  currency: string;
  count: number;
  gross: number;
  fees: number;
  net: number;
  refundsCount: number;
  refundsTotal: number;
  /** Variation réelle du solde du commerce sur la période : net encaissé moins montants remboursés. */
  balanceChange: number;
  byMethod: { PHONE: number; QR: number; STATIC_QR: number };
  byCashier: { userId: string | null; count: number; gross: number }[];
}

export const methodOf = (r: Pick<SaleRow, 'method' | 'viaStaticQr'>): 'PHONE' | 'QR' | 'STATIC_QR' => (r.viaStaticQr ? 'STATIC_QR' : r.method === 'PHONE' ? 'PHONE' : 'QR');

/** Totaux par devise (triés par devise). Les montants sont arrondis selon la devise (pas de dérive des flottants). */
export function aggregate(sales: readonly SaleRow[], refunds: readonly RefundRow[]): CurrencyTotals[] {
  const map = new Map<string, CurrencyTotals>();
  const get = (currency: string): CurrencyTotals => {
    let t = map.get(currency);
    if (!t) {
      t = { currency, count: 0, gross: 0, fees: 0, net: 0, refundsCount: 0, refundsTotal: 0, balanceChange: 0, byMethod: { PHONE: 0, QR: 0, STATIC_QR: 0 }, byCashier: [] };
      map.set(currency, t);
    }
    return t;
  };
  for (const s of sales) {
    const t = get(s.currency);
    t.count += 1;
    t.gross += s.amount;
    t.fees += s.fee;
    t.net += s.netAmount;
    t.byMethod[methodOf(s)] += 1;
    let c = t.byCashier.find((x) => x.userId === s.createdById);
    if (!c) {
      c = { userId: s.createdById, count: 0, gross: 0 };
      t.byCashier.push(c);
    }
    c.count += 1;
    c.gross += s.amount;
  }
  for (const r of refunds) {
    const t = get(r.currency);
    t.refundsCount += 1;
    t.refundsTotal += r.amount;
  }
  return [...map.values()]
    .sort((a, b) => a.currency.localeCompare(b.currency))
    .map((t) => {
      const round = (n: number) => roundForCurrency(n, t.currency);
      const net = round(t.net);
      const refundsTotal = round(t.refundsTotal);
      return {
        ...t,
        gross: round(t.gross),
        fees: round(t.fees),
        net,
        refundsTotal,
        balanceChange: round(net - refundsTotal),
        byCashier: t.byCashier.map((c) => ({ ...c, gross: round(c.gross) })).sort((a, b) => b.gross - a.gross),
      };
    });
}

// ── Export CSV ─────────────────────────────────────────

/**
 * Une cellule de texte ne doit jamais être interprétée comme une formule par le tableur (= + - @ en tête) : on la fait précéder d'une apostrophe.
 * Les nombres, eux, restent des nombres (virgule décimale pour Excel en français).
 */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  let s: string;
  if (typeof v === 'number') {
    s = Number.isFinite(v) ? String(v).replace('.', ',') : '';
  } else {
    s = v.replace(/\r?\n/g, ' ').trim();
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  }
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV complet : BOM UTF-8 (accents corrects dans Excel), séparateur « ; », fins de ligne CRLF. */
export function toCsv(headers: readonly string[], rows: readonly (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvCell).join(';'), ...rows.map((r) => r.map(csvCell).join(';'))];
  return `﻿${lines.join('\r\n')}\r\n`;
}

// ── Alertes ────────────────────────────────────────────

/** Alerte « solde bas » : une seule fois quand le solde passe sous le seuil ; réarmée quand il le dépasse de nouveau. */
export function lowBalanceDecision(balance: number, threshold: number | null | undefined, notified: boolean): 'ALERT' | 'REARM' | 'NONE' {
  if (threshold === null || threshold === undefined || !(threshold > 0)) return notified ? 'REARM' : 'NONE';
  if (balance < threshold) return notified ? 'NONE' : 'ALERT';
  return notified ? 'REARM' : 'NONE';
}

/** Alerte « échecs de paiement » : assez d'échecs récents, alertes activées et pas d'alerte récente. */
export function shouldAlertFailures(p: { failures: number; enabled: boolean; alertedAt: Date | null; now: Date }): boolean {
  if (!p.enabled || p.failures < FAILURE_ALERT_THRESHOLD) return false;
  if (!p.alertedAt) return true;
  return p.now.getTime() - p.alertedAt.getTime() >= FAILURE_ALERT_COOLDOWN_HOURS * 3_600_000;
}
