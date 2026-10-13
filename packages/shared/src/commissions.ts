// packages/shared/src/commissions.ts
// =========================================================
// COMMISSIONS GAGNÉES — ce qui a réellement été crédité (écritures du grand livre), pas un recalcul.
//
// Contrat : apps/backend/src/commissions/commissions.controller.ts
//   GET /commissions/ledger/company?period   COMPANY_ADMIN : { platform, agencies, entries, page, limit, hasMore }
//   GET /commissions/ledger/mine?period      AGENT         : { totalsByCurrency, count, entries, page, limit, hasMore }
//
// Pagination (phase 6) : ?page=1&limit=100 (500 max). Les totaux et `count` portent sur TOUTE la période,
// `entries` sur la page demandée ; `hasMore` indique qu'une page suivante existe.

// period : day | week | month | quarter | year ; toute autre valeur = depuis le début.
// =========================================================

import type { HttpClient } from './http';

export type CommissionPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';

export interface CurrencyTotal {
  currency: string;
  total: number;
}

export interface CommissionEntry {
  id: string;
  createdAt: string;
  amount: number;
  currency: string;
  description: string | null;
  balanceAfter: number;
  transactionId: string | null;
  transactionRef: string | null;
  /** Agence, expéditeur ou bénéficiaire à l'origine de la commission. */
  origin: string;
  grossAmount: number | null;
  grossFees: number | null;
}

export interface CompanyCommissionEntry extends CommissionEntry {
  /** platform = créditée à la société ; agency = créditée à une agence. */
  scope: 'platform' | 'agency';
}

export interface CompanyCommissions {
  platform: { totalsByCurrency: CurrencyTotal[]; count: number };
  agencies: { agencyId: string; name: string; count: number; totalsByCurrency: CurrencyTotal[] }[];
  entries: CompanyCommissionEntry[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface MyCommissions {
  totalsByCurrency: CurrencyTotal[];
  count: number;
  entries: CommissionEntry[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CommissionPageOptions {
  page?: number;
  limit?: number;
}

function pagingQuery(opts?: CommissionPageOptions): string {
  if (!opts) return '';
  const parts: string[] = [];
  if (opts.page) parts.push(`page=${Math.floor(opts.page)}`);
  if (opts.limit) parts.push(`limit=${Math.floor(opts.limit)}`);
  return parts.length ? `&${parts.join('&')}` : '';
}

export function createCommissionsApi(http: HttpClient) {
  return {
    company: (period: CommissionPeriod, opts?: CommissionPageOptions) =>
      http.get<CompanyCommissions>(`/commissions/ledger/company?period=${period}${pagingQuery(opts)}`),
    mine: (period: CommissionPeriod, opts?: CommissionPageOptions) =>
      http.get<MyCommissions>(`/commissions/ledger/mine?period=${period}${pagingQuery(opts)}`),
  };
}
