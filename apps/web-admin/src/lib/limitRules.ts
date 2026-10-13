// src/lib/limitRules.ts
// Plafonds d'envoi par niveau KYC : libellés, saisie, cohérence entre les périodes.
// Mêmes règles que le serveur (apps/backend/src/transfer-limits/) : le serveur reste juge.

import type { KycLevel, LimitChange, LimitKey, LimitValues } from '@direct-transfair/shared';
import { formatAmount } from './companyRules';
import { currencyLabel, parseThreshold } from './thresholdRules';

export { currencyLabel };

export const LIMIT_KEYS: readonly LimitKey[] = ['perTransaction', 'daily', 'monthly', 'yearly'];

export const LIMIT_LABEL: Record<LimitKey, string> = {
  perTransaction: 'Par envoi',
  daily: 'Par jour',
  monthly: 'Par mois',
  yearly: 'Par an',
};

/** Libellé court d'une période, pour les messages (« le plafond journalier … »). */
const PERIOD_ADJ: Record<LimitKey, string> = {
  perTransaction: 'par envoi',
  daily: 'journalier',
  monthly: 'mensuel',
  yearly: 'annuel',
};

export const LEVEL_TITLE: Record<KycLevel, string> = {
  LEVEL_0: 'Niveau 0',
  LEVEL_1: 'Niveau 1',
  LEVEL_2: 'Niveau 2',
  LEVEL_3: 'Niveau 3',
};

export const LEVEL_HINT: Record<KycLevel, string> = {
  LEVEL_0: 'Aucune vérification',
  LEVEL_1: 'Pièce d’identité',
  LEVEL_2: 'Pièce d’identité et justificatif de domicile',
  LEVEL_3: 'Vérification complète',
};

export const KYC_LEVELS: readonly KycLevel[] = ['LEVEL_0', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3'];

export function limitText(v: number | null, currency: string): string {
  return v === null ? 'Sans plafond' : formatAmount(v, currency);
}

export interface LimitFormEntry {
  text: string;
  unlimited: boolean;
}

export type LimitForm = Record<LimitKey, LimitFormEntry>;

export function formOf(values: LimitValues): LimitForm {
  const entry = (v: number | null): LimitFormEntry => ({ text: v === null ? '' : String(v).replace('.', ','), unlimited: v === null });
  return { perTransaction: entry(values.perTransaction), daily: entry(values.daily), monthly: entry(values.monthly), yearly: entry(values.yearly) };
}

export interface ParsedForm {
  values: LimitValues | null;
  errors: Partial<Record<LimitKey, string>>;
  /** Incohérence entre périodes (ex. plafond journalier plus petit que le plafond par envoi). */
  order: string | null;
}

export function parseForm(form: LimitForm): ParsedForm {
  const errors: Partial<Record<LimitKey, string>> = {};
  const out: Partial<LimitValues> = {};
  for (const k of LIMIT_KEYS) {
    const e = form[k];
    if (e.unlimited) {
      out[k] = null;
      continue;
    }
    const p = parseThreshold(e.text);
    if (p.error) errors[k] = p.error;
    else if (p.value === null) errors[k] = 'Saisissez un montant, ou cochez « Sans plafond ».';
    else out[k] = p.value;
  }
  if (Object.keys(errors).length > 0) return { values: null, errors, order: null };
  const values = out as LimitValues;
  return { values, errors, order: orderError(values) };
}

export function orderError(v: LimitValues): string | null {
  let prev: [LimitKey, number] | null = null;
  for (const k of LIMIT_KEYS) {
    const x = v[k];
    if (x === null) continue;
    if (prev && x < prev[1]) return `Le plafond ${PERIOD_ADJ[k]} ne peut pas être inférieur au plafond ${PERIOD_ADJ[prev[0]]}.`;
    prev = [k, x];
  }
  return null;
}

export const sameValues = (a: LimitValues, b: LimitValues): boolean => LIMIT_KEYS.every((k) => a[k] === b[k]);

export function changeTitle(c: Pick<LimitChange, 'kycLevel' | 'currency'>): string {
  const level = c.kycLevel ? LEVEL_TITLE[c.kycLevel] : 'Niveau';
  return c.currency ? `${level} · ${currencyLabel(c.currency)}` : level;
}

export function summary(v: LimitValues | null, currency: string | null): string {
  if (!v) return '—';
  const cur = currency ?? 'XOF';
  return LIMIT_KEYS.map((k) => `${LIMIT_LABEL[k].toLowerCase()} ${limitText(v[k], cur)}`).join(' · ');
}
