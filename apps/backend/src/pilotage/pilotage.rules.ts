// apps/backend/src/pilotage/pilotage.rules.ts
// =========================================================
// RÈGLES PURES DU LOT 15 (pilotage) — aucune lecture en base, testables seules.
//   • caisse        : écart de clôture (manque / excédent) et sa gravité
//   • liquidité     : niveau d'une caisse par rapport à son seuil minimal
//   • rentabilité   : marge nette estimée d'un couloir (frais − commissions des agents − part plateforme)
//   • objectifs     : avancement d'un agent sur le mois et classement
//   • période       : bornes d'un mois « AAAA-MM »
// =========================================================

import { BadRequestException } from '@nestjs/common';
import { roundForCurrency } from '../merchants/merchant-rules';

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const MAX_MONEY = 1_000_000_000_000;

/** Nombre sûr depuis un Decimal Prisma, une chaîne ou un nombre ; tout le reste vaut 0. */
export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(String(value));
  return Number.isFinite(n) ? n : 0;
}

export function round(value: number, currency: string): number {
  return roundForCurrency(value, currency);
}

// ── Mois ────────────────────────────────────────────────

/** « AAAA-MM » réel ; une valeur absente donne le mois courant (UTC décalé du fuseau). */
export function parseMonth(raw: unknown, now = new Date(), tzOffsetMin = 0): string {
  if (raw === undefined || raw === null || raw === '') {
    return new Date(now.getTime() + tzOffsetMin * 60_000).toISOString().slice(0, 7);
  }
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!MONTH_RE.test(s)) throw new BadRequestException('Mois invalide (attendu : AAAA-MM).');
  return s;
}

/** Début (inclus) et fin (exclue) d'un mois local, en instants UTC. */
export function monthBounds(month: string, tzOffsetMin = 0): { from: Date; to: Date } {
  const m = MONTH_RE.exec(month);
  if (!m) throw new BadRequestException('Mois invalide (attendu : AAAA-MM).');
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const from = Date.UTC(y, mo - 1, 1) - tzOffsetMin * 60_000;
  const to = Date.UTC(mo === 12 ? y + 1 : y, mo === 12 ? 0 : mo, 1) - tzOffsetMin * 60_000;
  return { from: new Date(from), to: new Date(to) };
}

export function previousMonth(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

// ── Caisse ──────────────────────────────────────────────

export type VarianceSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

/** Montant compté valide : nombre fini, positif ou nul, borné. */
export function parseCounted(raw: unknown, currency: string): number {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw.replace(',', '.')) : (raw as number);
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > MAX_MONEY) {
    throw new BadRequestException('Montant compté invalide.');
  }
  return round(n, currency);
}

export function computeVariance(counted: number, expected: number, currency: string): number {
  return round(counted - expected, currency);
}

/** Gravité d'un écart : nul → NONE ; au plus 1 % du solde théorique → LOW ; au plus 5 % → MEDIUM ; au-delà → HIGH. */
export function varianceSeverity(variance: number, expected: number): VarianceSeverity {
  const abs = Math.abs(variance);
  if (abs === 0) return 'NONE';
  const base = Math.abs(expected);
  if (base === 0) return 'HIGH';
  const ratio = abs / base;
  if (ratio <= 0.01) return 'LOW';
  if (ratio <= 0.05) return 'MEDIUM';
  return 'HIGH';
}

// ── Liquidité ───────────────────────────────────────────

export type LiquidityLevel = 'OK' | 'WARN' | 'LOW' | 'CRITICAL';

/** Sous le seuil : LOW ; sous la moitié du seuil : CRITICAL ; à moins de 25 % au-dessus du seuil : WARN. Seuil nul ou absent : OK. */
export function liquidityLevel(balance: number, min: number | null): LiquidityLevel {
  if (min === null || !(min > 0)) return 'OK';
  if (balance < min / 2) return 'CRITICAL';
  if (balance < min) return 'LOW';
  if (balance < min * 1.25) return 'WARN';
  return 'OK';
}

export function needsLiquidityAlert(level: LiquidityLevel): boolean {
  return level === 'LOW' || level === 'CRITICAL';
}

export function liquiditySeverity(level: LiquidityLevel): 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  return level === 'CRITICAL' ? 'CRITICAL' : level === 'LOW' ? 'HIGH' : 'MEDIUM';
}

/** Seuil applicable à une agence : sa règle propre l'emporte sur la règle « toutes les agences ». */
export function pickMinBalance(
  rules: readonly { agencyId: string | null; currency: string; minBalance: number; isActive: boolean }[],
  agencyId: string,
  currency: string,
): number | null {
  const active = rules.filter((r) => r.isActive && r.currency === currency);
  const own = active.find((r) => r.agencyId === agencyId);
  if (own) return own.minBalance;
  const all = active.find((r) => r.agencyId === null);
  return all ? all.minBalance : null;
}

// ── Rentabilité ─────────────────────────────────────────

export interface CorridorRaw {
  currency: string;
  targetCurrency: string | null;
  count: number;
  sent: number;
  received: number;
  fees: number;
  agentCommissions: number;
  platformShare: number;
  /** Gain estimé sur la marge de change de la société (devise d'envoi). 0 si aucune marge. */
  fxGain?: number;
}

export interface CorridorRow extends CorridorRaw {
  corridor: string;
  fxGain: number;
  /** Frais + gain de change − commissions des agents − part de la plateforme. Estimation : voir LISEZ-MOI-PILOTAGE.md. */
  net: number;
  /** Marge nette en % des revenus (frais + gain de change ; 0 si aucun revenu). */
  marginPct: number;
}

export function corridorLabel(currency: string, targetCurrency: string | null): string {
  return `${currency} → ${targetCurrency ?? currency}`;
}

export function toCorridorRow(raw: CorridorRaw): CorridorRow {
  const fxGain = round(raw.fxGain ?? 0, raw.currency);
  const revenue = raw.fees + fxGain;
  const net = round(revenue - raw.agentCommissions - raw.platformShare, raw.currency);
  const marginPct = revenue > 0 ? Math.round((net / revenue) * 1000) / 10 : 0;
  return { ...raw, fxGain, corridor: corridorLabel(raw.currency, raw.targetCurrency), net, marginPct };
}

/** Totaux par devise d'envoi (on n'additionne jamais deux devises). */
export interface CurrencyTotalRow { currency: string; count: number; sent: number; fees: number; fxGain: number; net: number }

export function totalsByCurrency(rows: readonly CorridorRow[]): CurrencyTotalRow[] {
  const map = new Map<string, CurrencyTotalRow>();
  for (const r of rows) {
    const t = map.get(r.currency) ?? { currency: r.currency, count: 0, sent: 0, fees: 0, fxGain: 0, net: 0 };
    t.count += r.count;
    t.sent = round(t.sent + r.sent, r.currency);
    t.fees = round(t.fees + r.fees, r.currency);
    t.fxGain = round(t.fxGain + r.fxGain, r.currency);
    t.net = round(t.net + r.net, r.currency);
    map.set(r.currency, t);
  }
  return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

// ── Objectifs et classement ─────────────────────────────

export interface AgentActivity {
  agentId: string;
  operations: number;
  /** Volume par devise. */
  volume: Record<string, number>;
  fees: Record<string, number>;
}

export interface TargetRow {
  currency: string;
  targetAmount: number;
  targetOperations: number;
}

export interface Progress {
  /** Avancement du volume (dans la devise de l'objectif), en %, plafonné à 999. null = pas d'objectif de volume. */
  amountPct: number | null;
  /** Avancement du nombre d'opérations, en %. null = pas d'objectif d'opérations. */
  operationsPct: number | null;
  /** Meilleur des deux avancements (celui qui compte pour le badge). null = aucun objectif. */
  pct: number | null;
  reached: boolean;
}

function pctOf(done: number, target: number): number {
  return Math.min(999, Math.round((done / target) * 1000) / 10);
}

export function targetProgress(activity: AgentActivity, target: TargetRow | null): Progress {
  if (!target) return { amountPct: null, operationsPct: null, pct: null, reached: false };
  const amountPct = target.targetAmount > 0 ? pctOf(activity.volume[target.currency] ?? 0, target.targetAmount) : null;
  const operationsPct = target.targetOperations > 0 ? pctOf(activity.operations, target.targetOperations) : null;
  const parts = [amountPct, operationsPct].filter((v): v is number => v !== null);
  const pct = parts.length ? Math.max(...parts) : null;
  return { amountPct, operationsPct, pct, reached: pct !== null && pct >= 100 };
}

/** Classement : nombre d'opérations décroissant, puis nom (ordre stable). Les rangs ex æquo sont partagés. */
export function rankAgents<T extends { operations: number; name: string }>(rows: readonly T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.operations - a.operations || a.name.localeCompare(b.name, 'fr'));
  let last = Number.POSITIVE_INFINITY;
  let rank = 0;
  return sorted.map((r, i) => {
    if (r.operations !== last) {
      rank = i + 1;
      last = r.operations;
    }
    return { ...r, rank };
  });
}

export function parseTarget(
  raw: { currency?: unknown; targetAmount?: unknown; targetOperations?: unknown },
): { currency: string; targetAmount: number; targetOperations: number } {
  const currency = String(raw.currency ?? '');
  const amount = Number(raw.targetAmount ?? 0);
  const ops = Number(raw.targetOperations ?? 0);
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_MONEY) throw new BadRequestException('Objectif de volume invalide.');
  if (!Number.isInteger(ops) || ops < 0 || ops > 1_000_000) throw new BadRequestException("Objectif d'opérations invalide.");
  if (amount === 0 && ops === 0) throw new BadRequestException('Indiquez un objectif de volume ou un nombre d’opérations.');
  return { currency, targetAmount: round(amount, currency), targetOperations: ops };
}
