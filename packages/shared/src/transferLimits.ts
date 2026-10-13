// packages/shared/src/transferLimits.ts
// =========================================================
// PLAFONDS D'ENVOI — par niveau KYC et par devise, fixés par l'admin de la société. Ils s'appliquent aux envois
// d'un client (rôle USER) : par envoi, par jour, par mois, par an. `null` = pas de plafond sur la période.
// Lecture : COMPANY_ADMIN (sa société) et SUPER_ADMIN (?clientId, lecture seule). Écriture : COMPANY_ADMIN.
//
// Contrat : apps/backend/src/transfer-limits/
//   GET    /transfer-limits                          { company, editable, currencies, levels, limits }   ?clientId
//   GET    /transfer-limits/history                  { data: LimitChange[] }                             ?clientId &limit
//   PUT    /transfer-limits/:level/:currency         { perTransaction, daily, monthly, yearly }  → TransferLimit
//   DELETE /transfer-limits/:level/:currency         → TransferLimit (plafonds par défaut)
//   PATCH  /transfer-limits/users/:userId/kyc-level  { kycLevel } → { userId, kycLevel, changed }
//
// Un envoi refusé répond 403 avec `code: "LIMIT_EXCEEDED"` (+ limit, max, used, remaining, currency).
// =========================================================

import type { HttpClient } from './http';
import type { KycLevel } from './users';

export interface LimitValues {
  perTransaction: number | null;
  daily: number | null;
  monthly: number | null;
  yearly: number | null;
}

export type LimitKey = keyof LimitValues;

export interface TransferLimit extends LimitValues {
  kycLevel: KycLevel;
  currency: string;
  /** Faux : aucune ligne enregistrée, les plafonds par défaut du serveur s'appliquent. */
  configured: boolean;
  defaults: LimitValues;
  updatedAt: string | null;
}

export interface TransferLimits {
  company: { id: number; name: string; code: string };
  editable: boolean;
  currencies: string[];
  levels: KycLevel[];
  limits: TransferLimit[];
}

export interface LimitChange {
  id: string;
  createdAt: string;
  kycLevel: KycLevel | null;
  currency: string | null;
  from: (LimitValues & { configured?: boolean }) | null;
  to: (LimitValues & { configured?: boolean }) | null;
  user: string | null;
}

export function createTransferLimitsApi(http: HttpClient) {
  return {
    get: (clientId?: number) => http.get<TransferLimits>(`/transfer-limits${clientId ? `?clientId=${clientId}` : ''}`),

    history: (clientId?: number, limit = 20) =>
      http.get<{ data: LimitChange[] }>(`/transfer-limits/history?limit=${limit}${clientId ? `&clientId=${clientId}` : ''}`),

    set: (level: KycLevel, currency: string, values: LimitValues) =>
      http.request<TransferLimit>(`/transfer-limits/${level}/${encodeURIComponent(currency)}`, { method: 'PUT', body: values }),

    reset: (level: KycLevel, currency: string) =>
      http.delete<TransferLimit>(`/transfer-limits/${level}/${encodeURIComponent(currency)}`),

    setKycLevel: (userId: string, kycLevel: KycLevel) =>
      http.request<{ userId: string; kycLevel: KycLevel; changed: boolean }>(`/transfer-limits/users/${encodeURIComponent(userId)}/kyc-level`, {
        method: 'PATCH',
        body: { kycLevel },
      }),
  };
}
