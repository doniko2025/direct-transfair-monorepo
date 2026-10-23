// packages/shared/src/treasury.ts
// =========================================================
// TRÉSORERIE — SUPER_ADMIN (ses propres portefeuilles) et COMPANY_ADMIN (portefeuilles de sa société)
//
// Contrat relevé dans apps/backend/src/{treasury,wallets,transactions,agencies}/ :
//   GET  /wallets/me                          portefeuilles de la société de l'admin (un par devise)
//   GET  /wallets/:id/ledger?page&limit       mouvements d'un portefeuille (paginé, plus récent d'abord)
//   GET  /treasury/overview                   activité du jour par devise (5 devises)
//   POST /treasury/admin/inject               COMPANY_ADMIN : crédite son portefeuille  { currency, amount, description? }
//   POST /treasury/admin/withdraw             COMPANY_ADMIN : débite son portefeuille   { currency, amount, reason? }
//   POST /treasury/transfer                   SUPER_ADMIN   : convertit entre portefeuilles { fromWalletId, toWalletId, amount, description? }
//   GET  /agencies                            agences (société de l'admin, ou toutes pour le super admin)
//   POST /transactions/admin/refill-agency    COMPANY_ADMIN : portefeuille société → agence { agencyId, amount, currency }
//   POST /transactions/agency/collect         COMPANY_ADMIN : agence → portefeuille société { agencyId, amount, note }
//   POST /transactions/b2b/declare            COMPANY_ADMIN : déclare un virement vers la plateforme { amount, ref, currency }
// Les paiements B2B déclarés se valident ou se refusent depuis api.transactions (validateB2B / rejectB2B).
// =========================================================

import type { HttpClient } from './http';
import type { Transaction } from './transactions';
import { IDEMPOTENCY_HEADER, createIdempotencyTracker, withIdempotency } from './idempotency';

export const TREASURY_CURRENCIES = ['XOF', 'EUR', 'USD', 'GNF', 'GBP'] as const;
export type TreasuryCurrency = (typeof TREASURY_CURRENCIES)[number];

export interface TreasuryWallet {
  id: string;
  currency: TreasuryCurrency;
  balance: number;
  reservedBalance: number;
  availableBalance: number;
  isDefault?: boolean;
  isActive?: boolean;
}

/** Activité du jour pour une devise. `totalReceivedToday` n'est jamais calculé par le serveur : ne pas l'afficher. */
export interface TreasuryOverviewItem {
  currency: TreasuryCurrency;
  symbol: string;
  balance: number;
  reservedBalance: number;
  availableBalance: number;
  totalSentToday: number;
  totalFeesToday: number;
  transactionCountToday: number;
}

export type LedgerEntryType = 'CREDIT' | 'DEBIT' | 'HOLD' | 'UNHOLD' | 'ADJUSTMENT';

export interface LedgerEntry {
  id: string;
  walletId: string;
  type: LedgerEntryType;
  amount: number;
  currency: TreasuryCurrency;
  description: string | null;
  balanceAfter: number;
  transactionId?: string | null;
  createdAt: string;
}

export interface LedgerPage {
  data: LedgerEntry[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface AgencyWallet {
  id: string;
  currency: TreasuryCurrency;
  balance: number;
  reservedBalance: number;
  availableBalance: number;
  isDefault?: boolean;
}

export interface TreasuryAgency {
  id: string;
  name: string;
  city: string;
  country?: string | null;
  primaryCurrency: TreasuryCurrency;
  isActive: boolean;
  clientId: number;
  /** Renseignés pour le super admin uniquement. */
  clientName?: string | null;
  clientCode?: string | null;
  wallets?: AgencyWallet[];
  agents?: { id: string; firstName: string | null; lastName: string | null }[];
}

export interface RefillAgencyResult {
  status: 'SUCCESS';
  sent: number;
  currency: TreasuryCurrency;
  agencyId: string;
  txRef: string;
  agencyWalletId: string;
}

export interface ConvertResult {
  from: TreasuryWallet;
  to: TreasuryWallet;
  rate: number;
}

function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: T[] }).data;
  }
  return [];
}

export function createTreasuryApi(http: HttpClient) {
  // ✅ audit point 3 : recharge d'agence et retrait forcé protégés contre le double envoi (voir idempotency.ts).
  const tracker = createIdempotencyTracker();
  const postOnce = <T>(path: string, body: object) =>
    withIdempotency(tracker, `${path}|${JSON.stringify(body)}`, (key) =>
      http.post<T>(path, body, { headers: { [IDEMPOTENCY_HEADER]: key } }));

  const enc = encodeURIComponent;
  return {
    wallets: async (): Promise<TreasuryWallet[]> => asList<TreasuryWallet>(await http.get<unknown>('/wallets/me')),

    ledger: (walletId: string, page = 1, limit = 20) =>
      http.get<LedgerPage>(`/wallets/${enc(walletId)}/ledger?page=${page}&limit=${limit}`),

    overview: async (): Promise<TreasuryOverviewItem[]> =>
      asList<TreasuryOverviewItem>(await http.get<unknown>('/treasury/overview')),

    inject: (input: { currency: TreasuryCurrency; amount: number; description?: string }) =>
      http.post<unknown>('/treasury/admin/inject', input),

    withdraw: (input: { currency: TreasuryCurrency; amount: number; reason?: string }) =>
      http.post<unknown>('/treasury/admin/withdraw', input),

    convert: (input: { fromWalletId: string; toWalletId: string; amount: number; description?: string }) =>
      http.post<ConvertResult>('/treasury/transfer', input),

    agencies: async (): Promise<TreasuryAgency[]> => asList<TreasuryAgency>(await http.get<unknown>('/agencies')),

    refillAgency: (input: { agencyId: string; amount: number; currency: TreasuryCurrency }) =>
      postOnce<RefillAgencyResult>('/transactions/admin/refill-agency', input),

    collectFromAgency: (input: { agencyId: string; amount: number; note: string }) =>
      postOnce<Transaction>('/transactions/agency/collect', input),

    declareB2B: (input: { amount: number; ref: string; currency: TreasuryCurrency }) =>
      http.post<Transaction>('/transactions/b2b/declare', input),
  };
}
