// src/lib/thresholdRules.ts
// Seuil de validation d'un envoi cash : saisie du montant, libellés des devises.
// Mêmes règles que le serveur (apps/backend/src/validation-thresholds/) : le serveur reste juge.

import type { ThresholdChange, ThresholdState } from '@direct-transfair/shared';
import { formatAmount } from './companyRules';

/** Plafond de saisie, identique au serveur. */
export const MAX_THRESHOLD = 1_000_000_000_000;

export const CURRENCY_LABEL: Record<string, string> = {
  XOF: 'Franc CFA (XOF)',
  GNF: 'Franc guinéen (GNF)',
  EUR: 'Euro (EUR)',
  USD: 'Dollar US (USD)',
  GBP: 'Livre sterling (GBP)',
};

export function currencyLabel(code: string): string {
  return CURRENCY_LABEL[code] ?? code;
}

/** Ordre d'affichage stable. */
export function sortThresholds<T extends { currency: string }>(list: readonly T[]): T[] {
  const order = Object.keys(CURRENCY_LABEL);
  const rank = (c: string) => (order.includes(c) ? order.indexOf(c) : order.length);
  return [...list].sort((a, b) => rank(a.currency) - rank(b.currency) || a.currency.localeCompare(b.currency));
}

export interface ParsedAmount {
  value: number | null;
  error: string | null;
}

/** Montant ≥ 0, deux décimales au plus, espaces et virgule acceptés (« 1 500 000 », « 250,5 »). */
export function parseThreshold(raw: string): ParsedAmount {
  const t = raw.replace(/[\s  ]/g, '').replace(',', '.');
  if (t === '') return { value: null, error: null };
  if (!/^\d+(\.\d+)?$/.test(t)) return { value: null, error: 'Saisissez un montant, par exemple 500000 ou 1 500,50.' };
  const n = Number(t);
  if (!Number.isFinite(n) || n > MAX_THRESHOLD) return { value: null, error: 'Montant trop élevé.' };
  if (Math.round(n * 100) / 100 !== n) return { value: null, error: 'Deux décimales au maximum.' };
  return { value: n, error: null };
}

export function toAmountInput(n: number): string {
  return String(n).replace('.', ',');
}

export function stateLine(s: ThresholdState | null, currency: string | null): string {
  if (!s) return '—';
  const cur = currency ?? 'XOF';
  return s.configured ? formatAmount(s.amount, cur) : `${formatAmount(s.amount, cur)} (par défaut)`;
}

export function changeTitle(c: Pick<ThresholdChange, 'currency'>): string {
  return c.currency ? `Seuil de validation en ${currencyLabel(c.currency)}` : 'Seuil de validation';
}
