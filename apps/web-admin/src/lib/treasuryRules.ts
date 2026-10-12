// src/lib/treasuryRules.ts
// Montants, devises et libellés de la trésorerie.

import type { LedgerEntryType, TreasuryAgency, TreasuryCurrency, TreasuryWallet } from '@direct-transfair/shared';
import type { StatusTone } from './companyRules';

export const CURRENCY_NAME: Record<TreasuryCurrency, string> = {
  XOF: 'Franc CFA (XOF)',
  EUR: 'Euro (EUR)',
  USD: 'Dollar américain (USD)',
  GNF: 'Franc guinéen (GNF)',
  GBP: 'Livre sterling (GBP)',
};

export const CURRENCY_OPTIONS = (Object.keys(CURRENCY_NAME) as TreasuryCurrency[]).map((value) => ({
  value,
  label: CURRENCY_NAME[value],
}));

/** Les francs n'ont pas de centimes : on refuse une saisie qui serait arrondie en silence. */
export function maxDecimals(currency: string): number {
  return currency === 'GNF' || currency === 'XOF' ? 0 : 2;
}

const MAX_AMOUNT = 1_000_000_000_000;

export interface ParsedAmount {
  value: number | null;
  error: string | null;
}

/** Lit un montant saisi à la française (« 1 250,50 »). Une saisie vide n'est pas une erreur : value = null. */
export function parseAmount(raw: string, currency: string): ParsedAmount {
  const text = raw.replace(/[\s  ]/g, '').replace(',', '.');
  if (text === '') return { value: null, error: null };
  if (!/^\d+(\.\d+)?$/.test(text)) return { value: null, error: 'Saisissez un nombre, par exemple 1250 ou 1250,50.' };
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return { value: null, error: 'Le montant doit être supérieur à zéro.' };
  if (value > MAX_AMOUNT) return { value: null, error: 'Ce montant est trop élevé.' };
  const decimals = (text.split('.')[1] ?? '').length;
  const allowed = maxDecimals(currency);
  if (decimals > allowed) {
    return {
      value: null,
      error: allowed === 0 ? `Le ${currency} n’a pas de centimes : saisissez un montant entier.` : 'Deux décimales au maximum.',
    };
  }
  return { value, error: null };
}

export const LEDGER_LABEL: Record<LedgerEntryType, string> = {
  CREDIT: 'Entrée',
  DEBIT: 'Sortie',
  HOLD: 'Fonds réservés',
  UNHOLD: 'Réservation levée',
  ADJUSTMENT: 'Ajustement',
};

export const LEDGER_TONE: Record<LedgerEntryType, StatusTone> = {
  CREDIT: 'ok',
  DEBIT: 'neutral',
  HOLD: 'warn',
  UNHOLD: 'brand',
  ADJUSTMENT: 'brand',
};

/** Signe affiché devant le montant d'une écriture. */
export function ledgerSign(type: LedgerEntryType): '+' | '−' | '' {
  if (type === 'CREDIT') return '+';
  if (type === 'DEBIT') return '−';
  return '';
}

export function walletOf(wallets: readonly TreasuryWallet[], currency: string): TreasuryWallet | undefined {
  return wallets.find((w) => w.currency === currency);
}

/**
 * Portefeuille que le serveur utilise pour récupérer des fonds d'une agence : le portefeuille par défaut,
 * sinon le premier (voir AgencyTreasuryService.resolveAgencyCurrency). On suit la même règle pour
 * afficher le solde réellement concerné.
 */
export function agencyWallet(agency: TreasuryAgency) {
  const list = agency.wallets ?? [];
  return list.find((w) => w.isDefault) ?? list[0] ?? null;
}

export function agencyLabel(a: TreasuryAgency, withCompany: boolean): string {
  const base = `${a.name} — ${a.city}`;
  return withCompany && a.clientName ? `${base} (${a.clientName})` : base;
}
