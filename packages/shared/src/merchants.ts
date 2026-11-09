// packages/shared/src/merchants.ts
// =========================================================
// COMPTES MARCHANDS (lot 11) — encaissement par numéro de téléphone ou par QR code, portefeuille marchand, retraits.
//
// Contrat : apps/backend/src/merchants
//   ADMIN  GET   /merchants-admin[?search&status&page]          marchands de la société
//          GET   /merchants-admin/payouts[?status&page]         retraits (PENDING = à traiter)
//          POST  /merchants-admin/payouts/:id/paid              { providerRef? } l'argent a été envoyé
//          POST  /merchants-admin/payouts/:id/reject            { reason } le marchand est recrédité
//          GET   /merchants-admin/:userId                       fiche + derniers encaissements / retraits
//          PATCH /merchants-admin/:userId/suspend | reactivate
//   Les réglages (commission, durées, plafonds, retraits) se règlent dans /company-settings → section « merchant ».
//   MOBILE (clients) : /merchants/*, /merchant-payments/* — voir apps/direct-transfair-mobile/services/api.ts
// =========================================================

import type { HttpClient } from './http';

export type MerchantStatus = 'ACTIVE' | 'SUSPENDED';
export type PaymentRequestStatus = 'PENDING' | 'PAID' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
export type PaymentRequestMethod = 'PHONE' | 'QR';
export type MerchantPayoutMethod = 'ORANGE_MONEY' | 'BANK_TRANSFER';
export type MerchantPayoutStatus = 'PENDING' | 'PAID' | 'REJECTED' | 'FAILED';

export const PAYOUT_METHOD_LABEL: Record<MerchantPayoutMethod, string> = {
  ORANGE_MONEY: 'Orange Money',
  BANK_TRANSFER: 'Virement bancaire',
};
export const PAYOUT_STATUS_LABEL: Record<MerchantPayoutStatus, string> = {
  PENDING: 'À traiter',
  PAID: 'Payé',
  REJECTED: 'Refusé',
  FAILED: 'Échoué',
};
export const PAYMENT_STATUS_LABEL: Record<PaymentRequestStatus, string> = {
  PENDING: 'En attente',
  PAID: 'Payé',
  DECLINED: 'Refusé',
  EXPIRED: 'Expiré',
  CANCELLED: 'Annulé',
};
export const MERCHANT_STATUS_LABEL: Record<MerchantStatus, string> = { ACTIVE: 'Actif', SUSPENDED: 'Suspendu' };

export interface MerchantListItem {
  userId: string;
  businessName: string;
  category: string | null;
  city: string | null;
  /** Numéro RCCM (nul pour un compte antérieur à la règle « RCCM obligatoire »). */
  rccm?: string | null;
  status: MerchantStatus;
  owner: { firstName: string | null; lastName: string | null; email: string; phone: string | null; kycLevel: string };
  orangeMoneyMasked: string;
  hasBank: boolean;
  sales: { currency: string; count: number; gross: number }[];
  pendingPayouts: number;
  createdAt: string;
}

export interface MerchantAdminDetail {
  userId: string;
  businessName: string;
  category: string | null;
  address: string | null;
  city: string | null;
  /** Coordonnées du COMMERCE (distinctes de celles du client) : quartier, code postal (facultatif), pays, téléphone, NIF / IFU. */
  district?: string | null;
  postalCode?: string | null;
  country?: string | null;
  businessPhone?: string | null;
  taxId?: string | null;
  /** Numéro RCCM (nul pour un compte antérieur à la règle « RCCM obligatoire »). */
  rccm?: string | null;
  status: MerchantStatus;
  suspendedReason: string | null;
  orangeMoneyMasked: string;
  bank: { holderName: string | null; ibanMasked: string; bic: string | null } | null;
  destinationChangedAt: string | null;
  payoutLockedUntil: string | null;
  createdAt: string;
  owner: { id: string; firstName: string | null; lastName: string | null; email: string; phone: string | null; kycLevel: string };
  recentPayments: { id: string; reference: string; method: PaymentRequestMethod; status: PaymentRequestStatus; amount: number; fee: number; currency: string; createdAt: string }[];
  recentPayouts: { id: string; reference: string; method: MerchantPayoutMethod; status: MerchantPayoutStatus; amount: number; currency: string; createdAt: string }[];
}

export interface MerchantPayoutAdmin {
  id: string;
  reference: string;
  method: MerchantPayoutMethod;
  status: MerchantPayoutStatus;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  /** Destination complète : l'administrateur en a besoin pour envoyer l'argent. */
  destination: string;
  destinationLabel: string | null;
  providerRef: string | null;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
  merchant: { userId: string; businessName: string | null; name: string; phone: string | null };
}

export interface MerchantPaged<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; pages: number };
}

const qs = (q: Record<string, string | number | boolean | undefined | null>): string => {
  const p = Object.entries(q)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return p.length ? `?${p.join('&')}` : '';
};

export function createMerchantApi(http: HttpClient) {
  const enc = encodeURIComponent;
  return {
    list: (q: { search?: string; status?: MerchantStatus; page?: number; limit?: number; clientId?: number } = {}) =>
      http.get<MerchantPaged<MerchantListItem>>(`/merchants-admin${qs(q)}`),
    get: (userId: string, clientId?: number) => http.get<MerchantAdminDetail>(`/merchants-admin/${enc(userId)}${qs({ clientId })}`),
    suspend: (userId: string, reason: string, clientId?: number) => http.patch<MerchantAdminDetail>(`/merchants-admin/${enc(userId)}/suspend${qs({ clientId })}`, { reason }),
    reactivate: (userId: string, clientId?: number) => http.patch<MerchantAdminDetail>(`/merchants-admin/${enc(userId)}/reactivate${qs({ clientId })}`, {}),

    payouts: (q: { status?: MerchantPayoutStatus; page?: number; limit?: number; clientId?: number } = {}) =>
      http.get<MerchantPaged<MerchantPayoutAdmin> & { pendingCount: number }>(`/merchants-admin/payouts${qs(q)}`),
    markPayoutPaid: (id: string, providerRef?: string, clientId?: number) =>
      http.post<unknown>(`/merchants-admin/payouts/${enc(id)}/paid${qs({ clientId })}`, { providerRef }),
    rejectPayout: (id: string, reason: string, clientId?: number) =>
      http.post<unknown>(`/merchants-admin/payouts/${enc(id)}/reject${qs({ clientId })}`, { reason }),
  };
}
