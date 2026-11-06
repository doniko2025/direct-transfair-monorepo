// src/lib/companySettingsRules.ts
// Paramètres de la société : conversion formulaire ⇄ API, contrôles de saisie et libellés.
// Mêmes bornes que le serveur (apps/backend/src/company-settings/) : le serveur reste juge.

import type { CompanySettings, CompanySettingsPatch } from '@direct-transfair/shared';

export interface SettingsForm {
  freeMethods: string[];
  fallbackFeeRatePct: string;
  payerShare: string;
  senderShare: string;
  validityMonths: string;
  maxFailedChecks: string;
  lockMinutes: string;
  requirePhoneCheck: boolean;
  phoneCheckDigits: string;
  lowBalance: Record<string, string>;
  rechargeMethods: string[];
}

export interface Limits {
  validityMonths: { min: number; max: number };
  maxFailedChecks: { min: number; max: number };
  lockMinutes: { min: number; max: number };
  phoneCheckDigits: { min: number; max: number };
  lowBalance: { min: number; max: number };
}

export const FALLBACK_LIMITS: Limits = {
  validityMonths: { min: 1, max: 36 },
  maxFailedChecks: { min: 1, max: 50 },
  lockMinutes: { min: 1, max: 1440 },
  phoneCheckDigits: { min: 3, max: 8 },
  lowBalance: { min: 0, max: 1_000_000_000_000 },
};

export const MAX_FEE_RATE = 25;

const text = (n: number): string => String(n).replace('.', ',');

export function toForm(s: CompanySettings): SettingsForm {
  return {
    freeMethods: [...s.fees.freeMethods],
    fallbackFeeRatePct: text(s.fees.fallbackFeeRatePct),
    payerShare: text(s.commissions.defaultSplit.payerShare),
    senderShare: text(s.commissions.defaultSplit.senderShare),
    validityMonths: String(s.pickup.validityMonths),
    maxFailedChecks: String(s.pickup.maxFailedChecks),
    lockMinutes: String(s.pickup.lockMinutes),
    requirePhoneCheck: s.pickup.requireBeneficiaryPhoneCheck,
    phoneCheckDigits: String(s.pickup.phoneCheckDigits),
    lowBalance: Object.fromEntries(Object.entries(s.alerts.lowBalance).map(([k, v]) => [k, text(v)])),
    rechargeMethods: [...s.recharge.enabledMethods],
  };
}

/** Nombre saisi (espaces, virgule acceptés) ; null si vide ou illisible. */
export function parseNumber(raw: string): number | null {
  const t = raw.replace(/[\s  ]/g, '').replace(',', '.');
  if (t === '' || !/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const twoDecimals = (n: number): boolean => Math.round(n * 100) / 100 === n;
const round2 = (n: number): number => Math.round(n * 100) / 100;

export type FormErrors = Partial<Record<keyof SettingsForm | `lowBalance.${string}`, string>>;

function intIn(raw: string, r: { min: number; max: number }, label: string): string | undefined {
  const n = parseNumber(raw);
  if (n === null || !Number.isInteger(n) || n < r.min || n > r.max) return `${label} : entier entre ${r.min} et ${r.max}.`;
  return undefined;
}

export function validate(f: SettingsForm, limits: Limits = FALLBACK_LIMITS): FormErrors {
  const e: FormErrors = {};

  const rate = parseNumber(f.fallbackFeeRatePct);
  if (rate === null || rate > MAX_FEE_RATE) e.fallbackFeeRatePct = `Taux entre 0 et ${MAX_FEE_RATE} %.`;
  else if (!twoDecimals(rate)) e.fallbackFeeRatePct = 'Deux décimales au maximum.';

  const payer = parseNumber(f.payerShare);
  const sender = parseNumber(f.senderShare);
  if (payer === null || payer > 100) e.payerShare = 'Part entre 0 et 100 %.';
  else if (!twoDecimals(payer)) e.payerShare = 'Deux décimales au maximum.';
  if (sender === null || sender > 100) e.senderShare = 'Part entre 0 et 100 %.';
  else if (!twoDecimals(sender)) e.senderShare = 'Deux décimales au maximum.';
  if (payer !== null && sender !== null && !e.payerShare && !e.senderShare && round2(payer + sender) > 100) {
    e.senderShare = 'La somme des parts ne peut pas dépasser 100 %.';
  }

  const v = intIn(f.validityMonths, limits.validityMonths, 'Validité');
  if (v) e.validityMonths = v;
  const m = intIn(f.maxFailedChecks, limits.maxFailedChecks, 'Essais');
  if (m) e.maxFailedChecks = m;
  const l = intIn(f.lockMinutes, limits.lockMinutes, 'Blocage');
  if (l) e.lockMinutes = l;
  const d = intIn(f.phoneCheckDigits, limits.phoneCheckDigits, 'Chiffres');
  if (d) e.phoneCheckDigits = d;

  for (const [cur, raw] of Object.entries(f.lowBalance)) {
    const n = parseNumber(raw);
    if (n === null || n < limits.lowBalance.min || n > limits.lowBalance.max) e[`lowBalance.${cur}`] = 'Montant positif (0 = pas d’alerte).';
    else if (!twoDecimals(n)) e[`lowBalance.${cur}`] = 'Deux décimales au maximum.';
  }
  return e;
}

/** Part de la société déduite des deux autres. */
export function platformShare(f: SettingsForm): number | null {
  const payer = parseNumber(f.payerShare);
  const sender = parseNumber(f.senderShare);
  if (payer === null || sender === null) return null;
  const rest = round2(100 - payer - sender);
  return rest < 0 ? null : rest;
}

/** Corps de la modification : tout le formulaire (le serveur ne retient que ce qui change vraiment). */
export function toPatch(f: SettingsForm): CompanySettingsPatch {
  const n = (raw: string): number => parseNumber(raw) ?? 0;
  return {
    fees: { freeMethods: f.freeMethods, fallbackFeeRatePct: n(f.fallbackFeeRatePct) },
    commissions: { defaultSplit: { payerShare: n(f.payerShare), senderShare: n(f.senderShare) } },
    pickup: {
      validityMonths: n(f.validityMonths),
      maxFailedChecks: n(f.maxFailedChecks),
      lockMinutes: n(f.lockMinutes),
      requireBeneficiaryPhoneCheck: f.requirePhoneCheck,
      phoneCheckDigits: n(f.phoneCheckDigits),
    },
    alerts: { lowBalance: Object.fromEntries(Object.entries(f.lowBalance).map(([k, raw]) => [k, n(raw)])) },
    recharge: { enabledMethods: f.rechargeMethods },
  };
}

export function sameForm(a: SettingsForm, b: SettingsForm): boolean {
  const norm = (f: SettingsForm) => JSON.stringify({ ...f, freeMethods: [...f.freeMethods].sort(), rechargeMethods: [...f.rechargeMethods].sort() });
  return norm(a) === norm(b);
}

export const CURRENCY_NAME: Record<string, string> = {
  XOF: 'Franc CFA (XOF)',
  GNF: 'Franc guinéen (GNF)',
  EUR: 'Euro (EUR)',
  USD: 'Dollar US (USD)',
  GBP: 'Livre sterling (GBP)',
};
