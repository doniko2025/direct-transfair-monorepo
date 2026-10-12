// packages/shared/src/rates.ts
// =========================================================
// TAUX DE CHANGE — globaux à la plateforme. Écriture : SUPER_ADMIN ; lecture : SUPER_ADMIN et COMPANY_ADMIN.
//
// Contrat : apps/backend/src/rates-admin/ (module créé avec cette phase). Les anciennes routes
// (POST /rates, PATCH /exchange-rates/:pair) n'ont ni historique ni audit : le web ne les utilise pas.
//   GET   /rates-admin                       un couple par paire (EUR_XOF…), taux appliqué + taux de secours
//   GET   /rates-admin/:pair/history?limit   historique, le plus récent d'abord
//   PATCH /rates-admin/:pair                 { rate, confirmLargeChange? } — le sens inverse se déduit
//
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
  /** Valeur de 1 base en quote. Null tant qu'aucun taux n'est enregistré (le taux de secours s'applique alors). */
  rate: number | null;
  /** Le taux vient du sens inverse (1 / taux) : rien n'est enregistré dans ce sens. */
  derived: boolean;
  /** Taux intégré au serveur, appliqué tant qu'aucun taux n'est enregistré. */
  fallbackRate: number;
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
    list: () => http.get<RatesOverview>('/rates-admin'),

    history: (pair: string, limit = 50) =>
      http.get<RateHistory>(`/rates-admin/${encodeURIComponent(pair)}/history?limit=${limit}`),

    set: (pair: string, rate: number, confirmLargeChange = false) =>
      http.patch<RatePair>(`/rates-admin/${encodeURIComponent(pair)}`, {
        rate,
        ...(confirmLargeChange ? { confirmLargeChange: true } : {}),
      }),
  };
}
