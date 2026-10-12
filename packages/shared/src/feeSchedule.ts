// packages/shared/src/feeSchedule.ts
// =========================================================
// BARÈME DE FRAIS — le tarif d'envoi d'une société par tranche de montant, par pays et par mode de retrait.
// Lecture : COMPANY_ADMIN (sa société) et SUPER_ADMIN (?clientId, lecture seule). Écriture : COMPANY_ADMIN.
//
// Contrat : apps/backend/src/fee-schedule/
//   GET    /fees-admin/rules           { company, editable, rules }       ?clientId (super admin)
//   GET    /fees-admin/rules/history   { data: FeeRuleChange[] }          ?clientId &limit
//   POST   /fees-admin/rules           FeeRuleInput → FeeRule
//   PATCH  /fees-admin/rules/:id       FeeRuleInput → FeeRule (remplace tous les champs)
//   DELETE /fees-admin/rules/:id       { id }
//   GET    /fees-admin/quote           frais exacts d'un envoi (même calcul que le serveur)
//
// Règle applicable : tous les critères renseignés correspondent et le montant est dans la tranche
// [minAmount ; maxAmount[. La plus spécifique gagne (pays de réception > pays d'envoi > mode).
// Tranche et frais fixe sont exprimés dans la devise de la règle ; le frais fixe est converti dans la devise
// de l'envoi. Sans règle : tarif plat du mode de retrait (page Frais), puis 1,5 %.
// =========================================================

import type { HttpClient } from './http';
import type { CurrencyCode } from './companies';

export interface FeeRule {
  id: string;
  label: string | null;
  /** null = tous les modes taxés. */
  payoutMethod: string | null;
  /** Codes ISO alpha-2 ; null = tous les pays. */
  sendCountry: string | null;
  receiveCountry: string | null;
  currency: CurrencyCode;
  minAmount: number;
  /** null = sans plafond. */
  maxAmount: number | null;
  /** Pourcentage du montant envoyé (1,5 = 1,5 %). */
  feeRate: number;
  fixedFee: number;
  isActive: boolean;
  updatedAt: string;
}

export interface FeeRuleInput {
  label: string | null;
  payoutMethod: string | null;
  sendCountry: string | null;
  receiveCountry: string | null;
  currency: CurrencyCode;
  minAmount: number;
  maxAmount: number | null;
  feeRate: number;
  fixedFee: number;
  isActive: boolean;
}

export interface FeeRules {
  company: { id: number; name: string; code: string };
  editable: boolean;
  rules: FeeRule[];
}

export interface FeeRuleChange {
  id: string;
  createdAt: string;
  op: 'create' | 'update' | 'delete' | string;
  label: string | null;
  from: FeeRule | null;
  to: FeeRule | null;
  user: string | null;
}

export type FeeSource = 'RULE' | 'METHOD' | 'DEFAULT' | 'FREE';

export interface FeeQuote {
  fees: number;
  total: number;
  currency: CurrencyCode;
  feeRatePct: number;
  /** Frais fixe dans la devise de l'envoi. */
  fixedFee: number;
  fixedFeeOriginal: { amount: number; currency: CurrencyCode } | null;
  source: FeeSource;
  rule: { id: string; label: string | null } | null;
  sendCountry: string | null;
  receiveCountry: string | null;
}

export interface FeeQuoteInput {
  amount: number;
  currency: CurrencyCode;
  payoutMethod: string;
  receiveCountry?: string | null;
  /** Simulation par un administrateur. */
  sendCountry?: string | null;
  /** Super admin : société simulée. */
  clientId?: number;
}

export function createFeeScheduleApi(http: HttpClient) {
  const scope = (clientId?: number) => (clientId ? `clientId=${clientId}` : '');
  return {
    rules: (clientId?: number) => http.get<FeeRules>(`/fees-admin/rules${clientId ? `?${scope(clientId)}` : ''}`),

    history: (clientId?: number, limit = 20) =>
      http.get<{ data: FeeRuleChange[] }>(`/fees-admin/rules/history?limit=${limit}${clientId ? `&${scope(clientId)}` : ''}`),

    create: (input: FeeRuleInput) => http.post<FeeRule>('/fees-admin/rules', input),

    update: (id: string, input: FeeRuleInput) => http.patch<FeeRule>(`/fees-admin/rules/${encodeURIComponent(id)}`, input),

    remove: (id: string) => http.delete<{ id: string }>(`/fees-admin/rules/${encodeURIComponent(id)}`),

    quote: (q: FeeQuoteInput) => {
      const p = new URLSearchParams({ amount: String(q.amount), currency: q.currency, payoutMethod: q.payoutMethod });
      if (q.receiveCountry) p.set('receiveCountry', q.receiveCountry);
      if (q.sendCountry) p.set('sendCountry', q.sendCountry);
      if (q.clientId) p.set('clientId', String(q.clientId));
      return http.get<FeeQuote>(`/fees-admin/quote?${p.toString()}`);
    },
  };
}
