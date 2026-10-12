// packages/shared/src/fees.ts
// =========================================================
// FRAIS D'ENVOI — le tarif de chaque société, par mode de retrait.
// Lecture : COMPANY_ADMIN (sa société) et SUPER_ADMIN (toutes, lecture seule). Écriture : COMPANY_ADMIN.
//
// Contrat : apps/backend/src/fees-admin/ (module créé avec cette phase).
//   GET   /fees-admin/mine          { company, methods }          COMPANY_ADMIN
//   GET   /fees-admin/companies     { companies: [...] }          SUPER_ADMIN
//   GET   /fees-admin/history       { data: FeeChange[] }         ?clientId (super admin) &limit
//   PATCH /fees-admin/:method       { feeRate, fixedFee }         COMPANY_ADMIN → FeeMethod
//
// Seuls CASH_PICKUP, BANK_DEPOSIT et IBAN_TRANSFER portent des frais. MOBILE_MONEY et WALLET sont gratuits :
// le serveur n'y prélève jamais rien (charged = false).
// Le frais fixe est ajouté tel quel, dans la devise de l'envoi.
// =========================================================

import type { HttpClient } from './http';

export type FeeMethodKey = 'CASH_PICKUP' | 'BANK_DEPOSIT' | 'IBAN_TRANSFER' | 'MOBILE_MONEY' | 'WALLET';

export interface FeeMethod {
  payoutMethod: FeeMethodKey | string;
  label: string;
  charged: boolean;
  /** Faux : aucune ligne en base, le taux par défaut du serveur (1,5 %) s'applique. */
  configured: boolean;
  /** Pourcentage prélevé sur le montant envoyé (1,5 = 1,5 %). */
  feeRate: number;
  fixedFee: number;
  /** Mode gratuit mais portant un taux enregistré (par l'ancienne application) : il n'est jamais appliqué. */
  storedFeeRate: number | null;
  updatedAt: string | null;
}

export interface FeeCompany {
  id: number;
  name: string;
  code: string;
}

export interface MyFees {
  company: FeeCompany;
  methods: FeeMethod[];
}

export interface CompanyFees extends FeeCompany {
  subscriptionStatus: string;
  methods: FeeMethod[];
}

export interface FeeValues {
  feeRate: number;
  fixedFee: number;
  /** Avant la première modification : le taux par défaut s'appliquait. */
  configured?: boolean;
}

export interface FeeChange {
  id: string;
  createdAt: string;
  payoutMethod: string | null;
  from: FeeValues | null;
  to: FeeValues | null;
  user: string | null;
  company: string | null;
}

export function createFeesApi(http: HttpClient) {
  return {
    mine: () => http.get<MyFees>('/fees-admin/mine'),

    companies: () => http.get<{ companies: CompanyFees[] }>('/fees-admin/companies'),

    history: (clientId?: number, limit = 30) =>
      http.get<{ data: FeeChange[] }>(`/fees-admin/history?limit=${limit}${clientId ? `&clientId=${clientId}` : ''}`),

    set: (method: string, values: { feeRate: number; fixedFee: number }) =>
      http.patch<FeeMethod>(`/fees-admin/${encodeURIComponent(method)}`, values),
  };
}
