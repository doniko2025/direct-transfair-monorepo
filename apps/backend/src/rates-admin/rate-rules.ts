// apps/backend/src/rates-admin/rate-rules.ts
// =========================================================
// Règles communes de validation des taux de change.
//
// Les taux sont GLOBAUX à la plateforme (la table exchange_rates n'a pas de clientId) :
// seuls les super admins les modifient.
//
// On ne gère qu'UN sens par couple de devises (la devise « forte » en base), l'autre sens
// se déduit (1 / taux). Deux sens saisis séparément pouvaient être incohérents
// (EUR→XOF = 656 et XOF→EUR = 0,0016 au lieu de 0,001524) et ouvraient un arbitrage :
// convertir dans un sens puis dans l'autre rapportait de l'argent.
// =========================================================

import { BadRequestException } from '@nestjs/common';

/** Ordre de priorité : la première devise d'un couple est la base de la paire (EUR_XOF, jamais XOF_EUR). */
export const RATE_CURRENCIES = ['EUR', 'GBP', 'USD', 'XOF', 'GNF'] as const;
export type RateCurrency = (typeof RATE_CURRENCIES)[number];

export interface CanonicalPair {
  base: RateCurrency;
  quote: RateCurrency;
  /** Forme stockée : toujours avec underscore. */
  pair: string;
}

export const CANONICAL_PAIRS: readonly CanonicalPair[] = RATE_CURRENCIES.flatMap((base, i) =>
  RATE_CURRENCIES.slice(i + 1).map((quote) => ({ base, quote, pair: `${base}_${quote}` })),
);

/** Au-delà de cette variation, le serveur exige une confirmation explicite. */
export const LARGE_CHANGE_PERCENT = 25;

export const MAX_RATE = 1_000_000_000;

export function normalizePair(raw: string): string {
  return String(raw ?? '')
    .toUpperCase()
    .trim()
    .replace(/[/\-\s]/g, '_');
}

const isCurrency = (c: string): c is RateCurrency => (RATE_CURRENCIES as readonly string[]).includes(c);

function split(raw: string): [RateCurrency, RateCurrency] {
  const m = /^([A-Z]{3})_([A-Z]{3})$/.exec(normalizePair(raw));
  if (!m || !isCurrency(m[1]) || !isCurrency(m[2])) {
    throw new BadRequestException(`Paire inconnue : « ${raw} ». Devises prises en charge : ${RATE_CURRENCIES.join(', ')}.`);
  }
  if (m[1] === m[2]) throw new BadRequestException('Une paire doit associer deux devises différentes.');
  return [m[1], m[2]];
}

/** Paire dans le sens géré par l'administration (EUR_XOF). L'autre sens est refusé avec la bonne indication. */
export function parseCanonicalPair(raw: string): CanonicalPair {
  const [base, quote] = split(raw);
  if (RATE_CURRENCIES.indexOf(base) > RATE_CURRENCIES.indexOf(quote)) {
    throw new BadRequestException(`Ce taux se gère dans l'autre sens : utilisez ${quote}_${base}. Le sens inverse est calculé automatiquement.`);
  }
  return { base, quote, pair: `${base}_${quote}` };
}

/** Paire valide dans un sens ou dans l'autre — pour les anciennes routes, qui acceptaient n'importe quoi. */
export function parseAnyPair(raw: string): string {
  const [base, quote] = split(raw);
  return `${base}_${quote}`;
}

/** Un taux est un nombre fini, strictement positif et raisonnable. */
export function assertValidRate(value: unknown): number {
  const rate = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(rate) || rate <= 0) throw new BadRequestException('Le taux doit être un nombre supérieur à zéro.');
  if (rate > MAX_RATE) throw new BadRequestException('Ce taux est trop élevé.');
  return rate;
}
