// packages/shared/src/validationThresholds.ts
// =========================================================
// SEUIL DE VALIDATION D'UN ENVOI CASH — au-dessus du seuil, l'envoi attend la validation d'un administrateur ;
// jusqu'au seuil (inclus), il est validé d'office. Une valeur par devise, fixée par l'admin de la société.
// Lecture : COMPANY_ADMIN (sa société) et SUPER_ADMIN (?clientId, lecture seule). Écriture : COMPANY_ADMIN.
//
// Contrat : apps/backend/src/validation-thresholds/
//   GET    /validation-thresholds            { company, editable, defaultAmount, thresholds }   ?clientId (super admin)
//   GET    /validation-thresholds/history    { data: ThresholdChange[] }                        ?clientId &limit
//   PUT    /validation-thresholds/:currency  { amount }   COMPANY_ADMIN → ValidationThreshold
//   DELETE /validation-thresholds/:currency              COMPANY_ADMIN → ValidationThreshold (valeur par défaut)
//
// Sans réglage : 500 000 (valeur par défaut du serveur).
// =========================================================

import type { HttpClient } from './http';

export interface ValidationThreshold {
  currency: string;
  /** Seuil réellement appliqué (valeur réglée, sinon valeur par défaut). */
  amount: number;
  /** Faux : l'admin n'a rien réglé, `amount` est la valeur par défaut du serveur. */
  configured: boolean;
  defaultAmount: number;
  updatedAt: string | null;
}

export interface ValidationThresholds {
  company: { id: number; name: string; code: string };
  editable: boolean;
  defaultAmount: number;
  thresholds: ValidationThreshold[];
}

export interface ThresholdState {
  amount: number;
  configured: boolean;
}

export interface ThresholdChange {
  id: string;
  createdAt: string;
  currency: string | null;
  from: ThresholdState | null;
  to: ThresholdState | null;
  user: string | null;
}

export function createValidationThresholdsApi(http: HttpClient) {
  return {
    get: (clientId?: number) => http.get<ValidationThresholds>(`/validation-thresholds${clientId ? `?clientId=${clientId}` : ''}`),

    history: (clientId?: number, limit = 20) =>
      http.get<{ data: ThresholdChange[] }>(`/validation-thresholds/history?limit=${limit}${clientId ? `&clientId=${clientId}` : ''}`),

    set: (currency: string, amount: number) =>
      http.request<ValidationThreshold>(`/validation-thresholds/${encodeURIComponent(currency)}`, { method: 'PUT', body: { amount } }),

    reset: (currency: string) => http.delete<ValidationThreshold>(`/validation-thresholds/${encodeURIComponent(currency)}`),
  };
}
