// src/lib/pilotageRules.ts
// Règles d'affichage du pilotage (lot 15) : libellés, tons des pastilles, périodes, mois, nombres. Aucune requête ici.

import type { LiquidityLevel, VarianceSeverity } from '@direct-transfair/shared';
import { formatAmount } from './companyRules';

export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger';

// ── Caisse ──────────────────────────────────────────────

export function varianceLabel(variance: number, currency: string): string {
  if (variance === 0) return 'Caisse juste';
  return `${variance < 0 ? 'Manque' : 'Excédent'} de ${formatAmount(Math.abs(variance), currency)}`;
}

export function varianceTone(severity: VarianceSeverity): Tone {
  return severity === 'NONE' ? 'ok' : severity === 'LOW' ? 'warn' : 'danger';
}

/** Saisie d'un montant au clavier : accepte « 12 500,50 », « 12500.5 » ; null si invalide ou négatif. */
export function parseAmountInput(raw: string): number | null {
  const s = raw.replace(/[\s  ]/g, '').replace(',', '.');
  if (!s || !/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ── Liquidité ───────────────────────────────────────────

export const LEVEL_LABEL: Record<LiquidityLevel, string> = { OK: 'Confortable', WARN: 'À surveiller', LOW: 'Sous le seuil', CRITICAL: 'Critique' };
export const LEVEL_TONE: Record<LiquidityLevel, Tone> = { OK: 'ok', WARN: 'warn', LOW: 'danger', CRITICAL: 'danger' };

/** Remplissage de la jauge (0–100) : le seuil se trouve à 50 %, donc 100 % = deux fois le seuil. Sans seuil : jauge pleine. */
export function gaugePct(balance: number, min: number | null): number {
  if (min === null || !(min > 0)) return 100;
  return Math.max(2, Math.min(100, Math.round((balance / (min * 2)) * 100)));
}

// ── Périodes ────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export type PeriodId = '7' | '30' | '90' | 'month' | 'lastMonth';

export const PERIOD_OPTIONS: readonly { id: PeriodId; label: string }[] = [
  { id: '7', label: '7 jours' },
  { id: '30', label: '30 jours' },
  { id: '90', label: '90 jours' },
  { id: 'month', label: 'Ce mois' },
  { id: 'lastMonth', label: 'Mois dernier' },
];

/** Bornes locales (AAAA-MM-JJ) d'une période prédéfinie. */
export function periodRange(id: PeriodId, now = new Date()): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (id === 'month') return { from: dayKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: dayKey(today) };
  if (id === 'lastMonth') {
    return { from: dayKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: dayKey(new Date(today.getFullYear(), today.getMonth(), 0)) };
  }
  const days = Number(id);
  return { from: dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))), to: dayKey(today) };
}

// ── Mois ────────────────────────────────────────────────

export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/** « AAAA-MM » ou « AAAA-MM-JJ » → [année, mois (1-12), jour]. */
function parts(s: string): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number);
  return [y ?? 1970, m ?? 1, d ?? 1];
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = parts(month);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export function monthLabel(month: string): string {
  const [y, m] = parts(month);
  const text = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function dayLabel(day: string): string {
  const [y, m, d] = parts(day);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── Nombres ─────────────────────────────────────────────

/** « 1 200 EUR · 3 000 000 GNF » à partir d'un volume par devise. */
export function volumeLabel(volume: Record<string, number>): string {
  const parts = Object.entries(volume).filter(([, v]) => v > 0).map(([c, v]) => formatAmount(v, c));
  return parts.length ? parts.join(' · ') : '—';
}

export function pctLabel(pct: number | null): string {
  return pct === null ? '—' : `${pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

export const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
