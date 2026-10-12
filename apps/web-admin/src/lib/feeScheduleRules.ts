// src/lib/feeScheduleRules.ts
// Barème de frais : libellés, tri, saisie et détection des tranches qui se chevauchent.
// Mêmes règles que le serveur (apps/backend/src/fee-schedule/) : le serveur reste juge, ces contrôles évitent
// seulement un aller-retour inutile.

import type { CurrencyCode, FeeQuote, FeeRule, FeeRuleInput } from '@direct-transfair/shared';
import { formatNumber } from './feeRules';
import { countryName } from './countries';

export const MAX_RULE_AMOUNT = 1_000_000_000_000;

/** Les seuls modes sur lesquels le serveur prélève des frais. */
export const CHARGED_METHODS: readonly { value: string; label: string }[] = [
  { value: 'CASH_PICKUP', label: 'Retrait cash' },
  { value: 'BANK_DEPOSIT', label: 'Virement bancaire' },
  { value: 'IBAN_TRANSFER', label: 'Virement IBAN (Europe)' },
];

export const METHOD_NAME: Record<string, string> = Object.fromEntries(CHARGED_METHODS.map((m) => [m.value, m.label]));

/** Pour simuler un envoi : les modes gratuits aussi, pour montrer qu'ils ne coûtent rien. */
export const SIMULATOR_METHODS: readonly { value: string; label: string }[] = [
  ...CHARGED_METHODS,
  { value: 'MOBILE_MONEY', label: 'Mobile Money (gratuit)' },
  { value: 'WALLET', label: 'Wallet vers wallet (gratuit)' },
];

export const SOURCE_LABEL: Record<FeeQuote['source'], string> = {
  RULE: 'Règle du barème',
  METHOD: 'Tarif du mode de retrait',
  DEFAULT: 'Taux par défaut de la plateforme',
  FREE: 'Mode gratuit',
};

export function money(value: number, currency: string): string {
  const digits = currency === 'XOF' || currency === 'GNF' ? 0 : 2;
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: digits })} ${currency}`;
}

/** « France → Guinée », « Tous les envois vers la Guinée », « Retrait cash », « Tous les envois ». */
export function ruleTitle(r: Pick<FeeRule, 'label' | 'payoutMethod' | 'sendCountry' | 'receiveCountry'>): string {
  if (r.label) return r.label;
  const from = countryName(r.sendCountry);
  const to = countryName(r.receiveCountry);
  if (from && to) return `${from} → ${to}`;
  if (to) return `Envois vers ${to}`;
  if (from) return `Envois depuis ${from}`;
  if (r.payoutMethod) return METHOD_NAME[r.payoutMethod] ?? r.payoutMethod;
  return 'Tous les envois';
}

/** Les critères de la règle, un libellé par critère renseigné. Vide = elle s'applique à tous les envois. */
export function ruleCriteria(r: Pick<FeeRule, 'payoutMethod' | 'sendCountry' | 'receiveCountry'>): string[] {
  const out: string[] = [];
  if (r.sendCountry) out.push(`Depuis ${countryName(r.sendCountry)}`);
  if (r.receiveCountry) out.push(`Vers ${countryName(r.receiveCountry)}`);
  if (r.payoutMethod) out.push(METHOD_NAME[r.payoutMethod] ?? r.payoutMethod);
  return out;
}

/** « De 100 à 1 000 EUR », « Moins de 100 EUR », « À partir de 1 000 EUR », « Tous les montants (EUR) ». */
export function rangeLabel(r: Pick<FeeRule, 'minAmount' | 'maxAmount' | 'currency'>): string {
  const cur = r.currency;
  if (r.minAmount <= 0 && r.maxAmount === null) return `Tous les montants (${cur})`;
  if (r.minAmount <= 0 && r.maxAmount !== null) return `Moins de ${money(r.maxAmount, cur)}`;
  if (r.maxAmount === null) return `À partir de ${money(r.minAmount, cur)}`;
  return `De ${formatNumber(r.minAmount)} à ${money(r.maxAmount, cur)}`;
}

/** « 3 % + 1 EUR », « 2 % », « 500 XOF », « Gratuit ». */
export function ruleFee(r: Pick<FeeRule, 'feeRate' | 'fixedFee' | 'currency'>): string {
  const parts: string[] = [];
  if (r.feeRate > 0) parts.push(`${formatNumber(r.feeRate)} %`);
  if (r.fixedFee > 0) parts.push(`${r.feeRate > 0 ? '+ ' : ''}${money(r.fixedFee, r.currency)}`);
  return parts.length ? parts.join(' ') : 'Gratuit';
}

const weight = (r: Pick<FeeRule, 'payoutMethod' | 'sendCountry' | 'receiveCountry'>): number =>
  (r.receiveCountry ? 4 : 0) + (r.sendCountry ? 2 : 0) + (r.payoutMethod ? 1 : 0);

/** Les règles les plus ciblées d'abord (ce sont celles qui l'emportent), puis par critères et tranche croissante. */
export function sortRules(rules: readonly FeeRule[]): FeeRule[] {
  return [...rules].sort(
    (a, b) =>
      weight(b) - weight(a) ||
      (a.receiveCountry ?? '').localeCompare(b.receiveCountry ?? '') ||
      (a.sendCountry ?? '').localeCompare(b.sendCountry ?? '') ||
      (a.payoutMethod ?? '').localeCompare(b.payoutMethod ?? '') ||
      a.currency.localeCompare(b.currency) ||
      a.minAmount - b.minAmount,
  );
}

// ─── Saisie ──────────────────────────────────────────────
export interface Parsed {
  value: number | null;
  error: string | null;
}

/** Montant positif ou nul, jusqu'à deux décimales. Vide : value = null, sans erreur. */
export function parseBound(raw: string): Parsed {
  const text = raw.replace(/[\s  ]/g, '').replace(',', '.');
  if (text === '') return { value: null, error: null };
  if (!/^\d+(\.\d+)?$/.test(text)) return { value: null, error: 'Saisissez un nombre, par exemple 100 ou 99,5.' };
  const value = Number(text);
  if (!Number.isFinite(value)) return { value: null, error: 'Saisissez un nombre, par exemple 100.' };
  if (value > MAX_RULE_AMOUNT) return { value: null, error: 'Ce montant est trop élevé.' };
  if (Math.round(value * 100) / 100 !== value) return { value: null, error: 'Deux décimales au maximum.' };
  return { value, error: null };
}

// ─── Chevauchement ───────────────────────────────────────
type Criteria = Pick<FeeRuleInput, 'payoutMethod' | 'sendCountry' | 'receiveCountry' | 'currency' | 'minAmount' | 'maxAmount' | 'isActive'>;

/** Deux tranches [min ; max[ se chevauchent. */
export function rangesOverlap(a: Pick<Criteria, 'minAmount' | 'maxAmount'>, b: Pick<Criteria, 'minAmount' | 'maxAmount'>): boolean {
  const aBeforeB = a.maxAmount !== null && a.maxAmount <= b.minAmount;
  const bBeforeA = b.maxAmount !== null && b.maxAmount <= a.minAmount;
  return !aBeforeB && !bBeforeA;
}

/** La règle déjà en place qui entrerait en conflit (mêmes critères et même devise, tranches qui se recouvrent). */
export function findOverlap(draft: Criteria, rules: readonly FeeRule[], selfId?: string): FeeRule | null {
  if (!draft.isActive) return null;
  return (
    rules.find(
      (r) =>
        r.id !== selfId &&
        r.isActive &&
        r.currency === draft.currency &&
        r.payoutMethod === draft.payoutMethod &&
        r.sendCountry === draft.sendCountry &&
        r.receiveCountry === draft.receiveCountry &&
        rangesOverlap(draft, r),
    ) ?? null
  );
}

export function toInput(n: number | null): string {
  return n === null ? '' : String(n).replace('.', ',');
}

export const CURRENCIES: readonly CurrencyCode[] = ['EUR', 'XOF', 'GNF', 'USD', 'GBP'];

/** Libellé court d'un changement du journal : « Création », « Modification », « Suppression ». */
export const OP_LABEL: Record<string, string> = { create: 'Règle ajoutée', update: 'Règle modifiée', delete: 'Règle supprimée' };
