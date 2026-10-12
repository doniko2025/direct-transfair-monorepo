// src/lib/feeRules.ts
// Frais d'envoi : saisie, calcul d'exemple et libellés.
// Les bornes sont celles du serveur (apps/backend/src/fees-admin/fee-rules.ts).

import type { FeeMethod, FeeValues } from '@direct-transfair/shared';
import type { IconName } from '../components/Icon';

export const DEFAULT_FEE_RATE = 1.5;
export const MAX_FEE_RATE = 25;
export const MAX_FIXED_FEE = 10_000_000;

export const FEE_ICON: Record<string, IconName> = {
  CASH_PICKUP: 'wallet',
  BANK_DEPOSIT: 'building',
  IBAN_TRANSFER: 'globe',
  MOBILE_MONEY: 'send',
  WALLET: 'swap',
};

export function feeIcon(method: string): IconName {
  return FEE_ICON[method] ?? 'percent';
}

const nf = (max: number) => (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: max });
export const formatNumber = nf(2);

export function formatPercent(n: number): string {
  return `${nf(2)(n)} %`;
}

/** « 1,5 % + 200 fixes », « 2 % », « 150 fixes », « Aucun frais » */
export function feeSummary(v: Pick<FeeValues, 'feeRate' | 'fixedFee'>): string {
  const parts: string[] = [];
  if (v.feeRate > 0) parts.push(formatPercent(v.feeRate));
  if (v.fixedFee > 0) parts.push(`${v.feeRate > 0 ? '+ ' : ''}${formatNumber(v.fixedFee)} fixes`);
  return parts.length ? parts.join(' ') : 'Aucun frais';
}

/** Frais prélevés sur un envoi, arrondis au centième (le frais fixe s'ajoute tel quel). */
export function computeFee(amount: number, v: Pick<FeeValues, 'feeRate' | 'fixedFee'>): number {
  return Math.round((amount * v.feeRate) / 100 * 100) / 100 + v.fixedFee;
}

export interface ParsedNumber {
  value: number | null;
  error: string | null;
}

function parseDecimal(raw: string, max: number, what: string, positive: boolean): ParsedNumber {
  const text = raw.replace(/[\s  ]/g, '').replace(',', '.');
  if (text === '') return { value: null, error: null };
  if (!/^\d+(\.\d+)?$/.test(text)) return { value: null, error: 'Saisissez un nombre, par exemple 1,5.' };
  const value = Number(text);
  if (!Number.isFinite(value)) return { value: null, error: 'Saisissez un nombre, par exemple 1,5.' };
  if (positive && value <= 0) return { value: null, error: 'Le montant doit être supérieur à zéro.' };
  if (value > max) return { value: null, error: `${what} ne peut pas dépasser ${formatNumber(max)}.` };
  if (Math.round(value * 100) / 100 !== value) return { value: null, error: 'Deux décimales au maximum.' };
  return { value, error: null };
}

export const parseFeeRate = (raw: string) => parseDecimal(raw, MAX_FEE_RATE, 'Le taux', false);
export const parseFixedFee = (raw: string) => parseDecimal(raw, MAX_FIXED_FEE, 'Le frais fixe', false);
/** Montant d'exemple : strictement positif. */
export const parseExample = (raw: string) => parseDecimal(raw, 1_000_000_000_000, 'Le montant', true);

/** Saisie pré-remplie à partir d'un nombre (virgule française, sans séparateur de milliers). */
export function toInput(n: number): string {
  return String(n).replace('.', ',');
}

export const isCharged = (m: FeeMethod): boolean => m.charged;
