// packages/shared/src/contracts.ts
// =========================================================
// CONTRATS (location / achat de l'application) — signature électronique
//
// Contrat relevé dans apps/backend/src/contracts/contracts.controller.ts :
//   Espace Grand Chef (SUPER_ADMIN)
//     GET  /contracts                     liste (?status= &clientId= &q=)
//     GET  /contracts/:id                 détail
//     GET  /contracts/:id/pdf             PDF (signé si signé, sinon aperçu)
//     POST /contracts                     émettre un contrat pour une société existante
//     POST /contracts/:id/resend          nouveau lien de signature + e-mail
//     POST /contracts/:id/resend-signed   renvoyer le contrat signé par e-mail
//     POST /contracts/:id/cancel          annuler un contrat non signé
//   Page publique de signature (sans connexion, jeton du lien)
//     GET  /contracts/sign/:token         contrat à lire
//     POST /contracts/sign/:token         signer
// =========================================================

import type { CurrencyCode, SubscriptionType } from './companies';
import type { HttpClient } from './http';

export type ContractStatus = 'PENDING' | 'SIGNED' | 'CANCELLED' | 'EXPIRED';
export type ContractKind = SubscriptionType; // RENTAL = location, PURCHASE = achat
export type BillingPeriod = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

/** Conditions commerciales. Location : redevance par période ; achat : prix forfaitaire. */
export interface ContractTermsInput {
  amount: number;
  currency: CurrencyCode;
  billingPeriod?: BillingPeriod;
  commitmentMonths?: number;
  maintenanceFeeYearly?: number;
  paymentDays?: number;
  /** AAAA-MM-JJ */
  effectiveDate?: string;
}

export interface ContractTerms extends ContractTermsInput {
  paymentDays: number;
  effectiveDate: string;
}

export interface ContractParty {
  role: string;
  name: string;
  lines: string[];
  representative: string;
}

export interface ContractArticle {
  number: number;
  title: string;
  paragraphs: string[];
}

export interface ContractContent {
  kind: ContractKind;
  title: string;
  subtitle: string;
  reference: string;
  issuedAt: string;
  provider: ContractParty;
  customer: ContractParty;
  summary: { label: string; value: string }[];
  preamble: string[];
  articles: ContractArticle[];
  closing: string[];
}

export interface ContractCompanyRef {
  id: number;
  name: string;
  code: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

export interface ContractSummary {
  id: string;
  reference: string;
  type: ContractKind;
  status: ContractStatus;
  version: string;
  terms: ContractTerms;
  recipientEmail: string;
  recipientName: string | null;
  tokenExpiresAt: string;
  sentAt: string | null;
  reminderCount: number;
  signedAt: string | null;
  signerName: string | null;
  signedMailedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  client: ContractCompanyRef;
}

export interface ContractDetail extends ContractSummary {
  content: ContractContent;
  contentHash: string;
  signatureImage: string | null;
  signerIp: string | null;
  signerUserAgent: string | null;
  signedPdfHash: string | null;
  cancelReason: string | null;
}

export interface IssueContractInput {
  clientId: number;
  kind?: ContractKind;
  terms: ContractTermsInput;
  recipientEmail?: string;
  /** Envoyer tout de suite le lien par e-mail (défaut : oui). */
  notify?: boolean;
}

export interface IssueContractResult {
  id: string;
  reference: string;
  signUrl: string | null;
  expiresAt: string;
  recipientEmail: string;
}

export interface ResendLinkResult {
  signUrl: string | null;
  emailed: boolean;
  expiresAt: string;
  recipientEmail: string;
}

/** Ce que voit le signataire sur la page publique. */
export interface PublicContract {
  reference: string;
  kind: ContractKind;
  status: ContractStatus;
  canSign: boolean;
  expiresAt: string;
  companyName: string;
  recipientName: string | null;
  recipientEmail: string;
  signedAt: string | null;
  signerName: string | null;
  content: ContractContent;
}

export interface SignContractInput {
  signerName: string;
  /** Signature dessinée, PNG en data URL. */
  signature: string;
  accept: boolean;
}

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  PENDING: 'En attente de signature',
  SIGNED: 'Signé',
  EXPIRED: 'Lien expiré',
  CANCELLED: 'Annulé',
};

export const CONTRACT_KIND_LABEL: Record<ContractKind, string> = {
  RENTAL: 'Location',
  PURCHASE: 'Achat',
};

export const BILLING_PERIOD_LABEL: Record<BillingPeriod, string> = {
  MONTHLY: 'par mois',
  QUARTERLY: 'par trimestre',
  YEARLY: 'par an',
};

export interface ContractFilter {
  status?: ContractStatus;
  clientId?: number;
  q?: string;
}

export function createContractsApi(http: HttpClient) {
  const enc = encodeURIComponent;
  return {
    list: (filter: ContractFilter = {}) => {
      const qs = new URLSearchParams();
      if (filter.status) qs.set('status', filter.status);
      if (filter.clientId) qs.set('clientId', String(filter.clientId));
      if (filter.q?.trim()) qs.set('q', filter.q.trim());
      const query = qs.toString();
      return http.get<ContractSummary[]>(`/contracts${query ? `?${query}` : ''}`);
    },

    get: (id: string) => http.get<ContractDetail>(`/contracts/${enc(id)}`),

    /** PDF du contrat (signé s'il l'est, sinon aperçu), avec l'authentification du Grand Chef. */
    pdf: (id: string) =>
      http.request<Blob>(`/contracts/${enc(id)}/pdf`, { responseType: 'blob', headers: { Accept: 'application/pdf' } }),

    issue: (input: IssueContractInput) => http.post<IssueContractResult>('/contracts', input),

    resend: (id: string) => http.post<ResendLinkResult>(`/contracts/${enc(id)}/resend`, {}),

    resendSigned: (id: string) =>
      http.post<{ ok: boolean; recipientEmail: string }>(`/contracts/${enc(id)}/resend-signed`, {}),

    cancel: (id: string, reason?: string) =>
      http.post<{ ok: boolean }>(`/contracts/${enc(id)}/cancel`, { reason }),

    /** Page publique de signature : aucune connexion, le jeton du lien fait foi. */
    publicView: (token: string) =>
      http.get<PublicContract>(`/contracts/sign/${enc(token)}`, { auth: false }),

    publicSign: (token: string, input: SignContractInput) =>
      http.post<{ reference: string; status: 'SIGNED'; signedAt: string }>(`/contracts/sign/${enc(token)}`, input, {
        auth: false,
      }),

    /** Adresse directe du PDF d'un lien de signature (ouverte dans le navigateur, sans authentification). */
    publicPdfPath: (token: string, download = false) => `/contracts/sign/${enc(token)}/pdf${download ? '?download=1' : ''}`,
  };
}
