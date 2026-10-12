// packages/shared/src/commissionRules.ts
// =========================================================
// RÉPARTITION DES FRAIS — quand un retrait est payé en agence, les frais de l'envoi sont partagés entre
// l'agence d'envoi, l'agence qui paie le cash et la société.
// Lecture : COMPANY_ADMIN (sa société) et SUPER_ADMIN (?clientId, lecture seule). Écriture : COMPANY_ADMIN.
//
// Contrat : apps/backend/src/commission-rules/
//   GET /commission-rules                  { company, editable, rules }   ?clientId (super admin)
//   GET /commission-rules/history          { data: SplitChange[] }        ?clientId &limit
//   PUT /commission-rules/:source/:dest    { senderShare, payerShare }    COMPANY_ADMIN → SplitRule
//
// 6 combinaisons : expéditeur (client, filiale, partenaire) × agence payeuse (filiale, partenaire).
// Sans ligne enregistrée : 20 % agence d'envoi, 40 % agence payeuse, 40 % société.
// =========================================================

import type { HttpClient } from './http';

export type SplitSource = 'WALLET' | 'SUBSIDIARY' | 'PARTNER';
export type SplitDest = 'SUBSIDIARY' | 'PARTNER';

export interface Shares {
  senderShare: number;
  payerShare: number;
  platformShare: number;
}

export interface SplitRule extends Shares {
  sourceType: SplitSource;
  destType: SplitDest;
  /** Faux : aucune ligne en base, les parts par défaut du serveur s'appliquent. */
  configured: boolean;
  /** Parts réellement perçues : pour un client expéditeur, la part d'envoi revient à la société. */
  effective: Shares;
  updatedAt: string | null;
}

export interface SplitRules {
  company: { id: number; name: string; code: string };
  editable: boolean;
  rules: SplitRule[];
}

export interface SplitChange {
  id: string;
  createdAt: string;
  sourceType: SplitSource | null;
  destType: SplitDest | null;
  from: (Shares & { configured?: boolean }) | null;
  to: Shares | null;
  user: string | null;
}

export function createCommissionRulesApi(http: HttpClient) {
  return {
    get: (clientId?: number) => http.get<SplitRules>(`/commission-rules${clientId ? `?clientId=${clientId}` : ''}`),

    history: (clientId?: number, limit = 20) =>
      http.get<{ data: SplitChange[] }>(`/commission-rules/history?limit=${limit}${clientId ? `&clientId=${clientId}` : ''}`),

    set: (source: SplitSource, dest: SplitDest, shares: { senderShare: number; payerShare: number }) =>
      http.request<SplitRule>(`/commission-rules/${source}/${dest}`, { method: 'PUT', body: shares }),
  };
}
