// packages/shared/src/rates.ts
// =========================================================
// TAUX DE CHANGE — PAR SOCIÉTÉ : chaque société fixe ses propres taux, indépendamment des autres.
// Écriture : COMPANY_ADMIN (ses taux uniquement). Lecture : COMPANY_ADMIN (les siens) et SUPER_ADMIN (LECTURE SEULE, ?clientId=).
//
// Contrat : apps/backend/src/rates-admin/ (module créé avec cette phase). Les anciennes routes
// d'écriture (POST /rates, PATCH /exchange-rates/:pair) ont été supprimées : /rates-admin est le seul point d'écriture.
//   GET   /rates-admin[?clientId]                       un couple par paire (EUR_XOF…), taux enregistré (null tant qu'aucun n'est fixé)
//   GET   /rates-admin/:pair/history?limit[&clientId]   historique, le plus récent d'abord
//   PATCH /rates-admin/:pair                            { rate, confirmLargeChange? } — le sens inverse se déduit (COMPANY_ADMIN)
// `clientId` n'est lu que pour le super admin (société consultée) ; un admin de société agit toujours sur SA société.
//
// Aucun taux n'est écrit en dur : tant qu'une paire n'est pas fixée, les conversions qui en dépendent sont refusées (503).
// On ne gère qu'UN sens par couple (la première devise de EUR, GBP, USD, XOF, GNF).
// Le serveur répond 400 { code: 'LARGE_CHANGE', changePercent } au-delà de 25 % de variation sans confirmation.
// =========================================================

import type { HttpClient } from './http';

export const RATE_CURRENCIES = ['EUR', 'GBP', 'USD', 'XOF', 'GNF'] as const;
export type RateCurrency = (typeof RATE_CURRENCIES)[number];

export interface RatePair {
  /** Forme EUR_XOF : la devise de base d'abord. */
  pair: string;
  base: RateCurrency;
  quote: RateCurrency;
  /** Valeur de 1 base en quote. Null tant qu'aucun taux n'est enregistré : les conversions de ce couple sont alors refusées par le serveur. */
  rate: number | null;
  /** Le taux vient du sens inverse (1 / taux) : rien n'est enregistré dans ce sens. */
  derived: boolean;
  /** Les deux sens sont enregistrés mais ne sont pas inverses l'un de l'autre. Réenregistrer le taux les aligne. */
  inverseMismatch: boolean;
  previousRate: number | null;
  /** Variation du dernier changement, en pourcentage. */
  changePercent: number | null;
  source: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface RatesOverview {
  pairs: RatePair[];
}

export interface RateHistoryEntry {
  id: string;
  rate: number;
  source: string | null;
  recordedAt: string;
}

export interface RateHistory {
  pair: string;
  base: RateCurrency;
  quote: RateCurrency;
  data: RateHistoryEntry[];
}

export function createRatesApi(http: HttpClient) {
  return {
    list: (clientId?: number) => http.get<RatesOverview>(`/rates-admin${clientId ? `?clientId=${clientId}` : ''}`),

    history: (pair: string, limit = 50, clientId?: number) =>
      http.get<RateHistory>(`/rates-admin/${encodeURIComponent(pair)}/history?limit=${limit}${clientId ? `&clientId=${clientId}` : ''}`),

    set: (pair: string, rate: number, confirmLargeChange = false) =>
      http.patch<RatePair>(`/rates-admin/${encodeURIComponent(pair)}`, {
        rate,
        ...(confirmLargeChange ? { confirmLargeChange: true } : {}),
      }),
  };
}
