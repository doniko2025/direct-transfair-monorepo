// src/lib/deskRules.ts
// Règles d'affichage et de saisie du guichet de l'agent (dépôt, retrait, envoi cash, remise).
// Le serveur reste l'autorité : ici on évite d'envoyer ce qu'il refuserait et on montre ce qu'il va appliquer.

import type { AgentDesk, DeskCurrencyTotal, DeskWallet } from '@direct-transfair/shared';
import { formatAmount } from './companyRules';
import { COUNTRIES } from './countries';
import { DIAL_CODES, dialOf } from './dialCodes';

/** La caisse utilisée par le serveur pour un dépôt, un envoi ou une remise : la caisse par défaut, sinon la première. */
export function mainWallet(desk: AgentDesk | null | undefined): DeskWallet | null {
  if (!desk) return null;
  return desk.wallets.find((w) => w.isDefault) ?? desk.wallets[0] ?? null;
}

/** Caisse dans une devise donnée (ex. celle d'un code de retrait), sans repli sur une autre devise. */
export function walletIn(desk: AgentDesk | null | undefined, currency: string): DeskWallet | null {
  return desk?.wallets.find((w) => w.currency === currency) ?? null;
}

/** Début de la journée de l'agent, à son fuseau horaire (le serveur borne la valeur à 36 h). */
export function startOfLocalDayIso(now: Date = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function totalsLabel(totals: readonly DeskCurrencyTotal[]): string {
  return totals.length === 0 ? '—' : totals.map((t) => formatAmount(t.total, t.currency)).join(' + ');
}

export function personName(p: { firstName?: string | null; lastName?: string | null }): string {
  return [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
}

// ─── Téléphone ───────────────────────────────────────────
export interface ParsedPhone {
  /** Numéro au format international (« +224620000000 »), ou null tant que la saisie est vide ou invalide. */
  value: string | null;
  error: string | null;
}

/**
 * Compose « +indicatif numéro » à partir de l'indicatif choisi et de la saisie.
 * Une saisie qui commence par « + » ou « 00 » est prise telle quelle (numéro déjà international).
 */
export function parsePhone(dial: string, raw: string): ParsedPhone {
  const text = raw.trim();
  if (text === '') return { value: null, error: null };
  if (!/^[+\d][\d\s().-]*$/.test(text)) return { value: null, error: 'Le numéro ne doit contenir que des chiffres.' };
  const digits = text.replace(/\D/g, '');
  let international: string;
  if (text.startsWith('+')) international = digits;
  else if (digits.startsWith('00')) international = digits.slice(2);
  else international = `${dial}${digits.replace(/^0+/, '')}`;
  if (international.length < 8 || international.length > 15) {
    return { value: null, error: 'Numéro incomplet ou trop long. Vérifiez les chiffres.' };
  }
  return { value: `+${international}`, error: null };
}

// ─── Code de retrait ─────────────────────────────────────
export function cleanCode(raw: string): string {
  return raw.trim().replace(/\s+/g, '');
}

// ─── Statut d'un code de retrait ─────────────────────────
export type CodeVerdict = 'payable' | 'waiting' | 'paid' | 'cancelled' | 'other';

export function verdictOf(status: string): CodeVerdict {
  switch (status) {
    case 'VALIDATED':
      return 'payable';
    case 'PENDING':
      return 'waiting';
    case 'PAID':
      return 'paid';
    case 'CANCELLED':
    case 'FAILED':
    case 'REFUNDED':
    case 'EXPIRED':
      return 'cancelled';
    default:
      return 'other';
  }
}

// ─── Pays ────────────────────────────────────────────────
/** Code ISO d'un pays donné en code (« GN ») ou en nom (« Guinée »), null s'il n'est pas dans la liste. */
export function countryCodeOf(raw: string | null | undefined): string | null {
  const text = (raw ?? '').trim().toLowerCase();
  if (!text) return null;
  return COUNTRIES.find((c) => c.code.toLowerCase() === text || c.name.toLowerCase() === text)?.code ?? null;
}

/** Indicatif proposé par défaut : celui du pays de l'agence, sinon le premier de la liste. */
export function defaultDial(agencyCountry: string | null | undefined): string {
  const code = countryCodeOf(agencyCountry);
  return (code ? dialOf(code) : null) ?? DIAL_CODES[0]?.dial ?? '224';
}
