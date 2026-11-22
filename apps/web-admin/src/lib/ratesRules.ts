// src/lib/ratesRules.ts
// Taux de change : saisie, formats, variation et libellés.

import type { RateCurrency, RatePair } from '@direct-transfair/shared';
import type { Tone } from './supervisionRules';

/** Même seuil que le serveur (rates-admin/rate-rules.ts) : au-delà, une confirmation est exigée. */
export const LARGE_CHANGE_PERCENT = 25;
export const MAX_RATE = 1_000_000_000;

export const RATE_CURRENCY_NAME: Record<RateCurrency, string> = {
  EUR: 'Euro',
  GBP: 'Livre sterling',
  USD: 'Dollar américain',
  XOF: 'Franc CFA',
  GNF: 'Franc guinéen',
};

/** Nom de devise en milieu de phrase : « franc CFA », « euro »… */
export function lowerName(currency: RateCurrency): string {
  const name = RATE_CURRENCY_NAME[currency];
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/** Un taux s'affiche avec assez de chiffres pour rester lisible, qu'il vaille 656 ou 0,0015. */
export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (value < 1) return value.toLocaleString('fr-FR', { maximumSignificantDigits: 4 });
  return value.toLocaleString('fr-FR', { maximumFractionDigits: value >= 100 ? 2 : 4 });
}

/** « 1 EUR = 655,96 XOF » */
export function rateLine(base: string, quote: string, rate: number | null | undefined): string {
  return `1 ${base} = ${formatRate(rate)} ${quote}`;
}

export function inverseOf(rate: number | null | undefined): number | null {
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? 1 / rate : null;
}

/** Taux réellement appliqué par le serveur pour ce couple. Null = non configuré : aucune conversion possible (pas de taux de secours). */
export function appliedRate(p: Pick<RatePair, 'rate'>): number | null {
  return p.rate;
}

export type RateStatus = 'set' | 'derived' | 'none';

export function statusOf(p: Pick<RatePair, 'rate' | 'derived'>): RateStatus {
  if (p.rate === null) return 'none';
  return p.derived ? 'derived' : 'set';
}

export const STATUS_VIEW: Record<RateStatus, { label: string; tone: Tone; hint: string }> = {
  set: { label: 'Enregistré', tone: 'ok', hint: 'Ce taux a été fixé par l’administrateur de la société.' },
  derived: {
    label: 'Calculé',
    tone: 'brand',
    hint: 'Seul le sens inverse est enregistré : ce taux en est déduit (1 ÷ taux).',
  },
  none: {
    label: 'Non configuré',
    tone: 'danger',
    hint: 'Aucun taux enregistré : le serveur refuse toute conversion qui dépend de ce couple tant que vous n’en fixez pas un.',
  },
};

export interface ParsedRate {
  value: number | null;
  error: string | null;
}

/** Lit un taux saisi à la française (« 655,957 »). Une saisie vide n'est pas une erreur : value = null. */
export function parseRate(raw: string): ParsedRate {
  const text = raw.replace(/[\s  ]/g, '').replace(',', '.');
  if (text === '') return { value: null, error: null };
  if (!/^\d+(\.\d+)?$/.test(text)) return { value: null, error: 'Saisissez un nombre, par exemple 655,957.' };
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return { value: null, error: 'Le taux doit être supérieur à zéro.' };
  if (value > MAX_RATE) return { value: null, error: 'Ce taux est trop élevé.' };
  return { value, error: null };
}

/** Variation en %, arrondie au centième comme le serveur. Null quand la base est nulle. */
export function changeBetween(next: number, previous: number): number | null {
  return previous > 0 ? Math.round(((next - previous) / previous) * 10_000) / 100 : null;
}

export function isLargeChange(change: number | null): boolean {
  return change !== null && Math.abs(change) > LARGE_CHANGE_PERCENT;
}

export function formatChange(change: number | null | undefined): string {
  if (change === null || change === undefined || !Number.isFinite(change)) return '';
  const text = Math.abs(change).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  return `${change > 0 ? '+' : change < 0 ? '−' : ''}${text} %`;
}

export function changeTone(change: number | null | undefined): Tone {
  if (change === null || change === undefined || change === 0) return 'neutral';
  return Math.abs(change) > LARGE_CHANGE_PERCENT ? 'warn' : change > 0 ? 'ok' : 'neutral';
}

export function pairTitle(base: string, quote: string): string {
  return `${base} → ${quote}`;
}


// ── Marge de change de la société ───────────────────────

/** Mêmes bornes que le serveur (rates-admin/rate-rules.ts). */
export const MAX_FX_MARGIN_PCT = 10;
export const FX_MARGIN_PRESETS: readonly number[] = [0, 0.5, 1, 1.5, 2, 3];

export interface ParsedMargin {
  value: number | null;
  error: string | null;
}

/** Lit une marge saisie à la française (« 1,5 »), 0 à 10 %, 2 décimales au plus. Saisie vide : value = null sans erreur. */
export function parseMargin(raw: string, max = MAX_FX_MARGIN_PCT): ParsedMargin {
  const text = raw.replace(/[\s  ]/g, '').replace(',', '.').replace(/%$/, '');
  if (text === '') return { value: null, error: null };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { value: null, error: 'Saisissez un pourcentage, par exemple 1,5 (2 décimales au plus).' };
  const value = Number(text);
  if (value > max) return { value: null, error: `La marge ne peut pas dépasser ${max} %.` };
  return { value, error: null };
}

export function formatMargin(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '—';
  return `${pct.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
}

/** Taux que voit le client : le taux publié diminué de la marge. */
export function customerRate(rate: number, marginPct: number): number {
  return marginPct > 0 ? rate * (1 - Math.min(marginPct, MAX_FX_MARGIN_PCT) / 100) : rate;
}

/** Couple servant d'exemple : EUR → GNF, EUR → XOF, puis le premier couple dont un taux est fixé. */
export function examplePair(pairs: readonly RatePair[]): RatePair | null {
  const ok = pairs.filter((p) => p.rate !== null);
  return ok.find((p) => p.pair === 'EUR_GNF') ?? ok.find((p) => p.pair === 'EUR_XOF') ?? ok[0] ?? null;
}
