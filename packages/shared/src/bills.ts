// packages/shared/src/bills.ts
// =========================================================
// PAIEMENT DE FACTURES (lot 14) — catalogue des facturiers de la société et file des factures à régler.
//
// Contrat : apps/backend/src/bills (réservé au COMPANY_ADMIN : un super-administrateur ne voit rien des opérations d'une société)
//   GET    /bills-admin/meta                       connecteurs disponibles sur le serveur
//   GET    /bills-admin/billers                    catalogue (avec suivi du partenariat et nombre de factures à régler)
//   POST   /bills-admin/billers                    ajouter un facturier
//   PATCH  /bills-admin/billers/:id                modifier
//   DELETE /bills-admin/billers/:id                supprimer (refusé s'il a déjà reçu des paiements : le suspendre)
//   GET    /bills-admin/stats                      à régler, en retard, montants par facturier
//   GET    /bills-admin/payments[?status&late&billerId&q&from&to&page&limit]
//   GET    /bills-admin/payments/export.csv        mêmes filtres
//   POST   /bills-admin/payments/:id/process       { action: PROCESSING | COMPLETE | FAIL, providerRef?, token?, receiptNote?, reason? }
//   POST   /bills-admin/reconcile                  { billerId, csv, mapping?, delimiter?, from?, to?, tolerance? } → rapport d'écarts (lot 14b)
//   POST   /bills-admin/reconcile/export.csv       mêmes paramètres : les écarts en CSV
//   L'ouverture de la fonction, les plafonds et les factures récurrentes se règlent dans /company-settings → section « bills ».
//   MOBILE (clients) : /bills/* — voir apps/direct-transfair-mobile/services/api.ts
// =========================================================

import type { HttpClient } from './http';

export type BillerStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED';
export type BillPartnership = 'NONE' | 'NEGOTIATING' | 'SIGNED';
export type BillAmountMode = 'FREE' | 'FROM_LOOKUP';
export type BillPaymentStatus = 'SUBMITTED' | 'PROCESSING' | 'COMPLETED' | 'REFUNDED';
export type BillFieldType = 'text' | 'number' | 'select';

export const BILLER_STATUS_LABEL: Record<BillerStatus, string> = { DRAFT: 'Brouillon', ACTIVE: 'Ouvert aux clients', SUSPENDED: 'Suspendu' };
export const BILL_PARTNERSHIP_LABEL: Record<BillPartnership, string> = { NONE: 'Aucun accord', NEGOTIATING: 'En négociation', SIGNED: 'Accord signé' };
export const BILL_AMOUNT_MODE_LABEL: Record<BillAmountMode, string> = { FREE: 'Le client saisit le montant', FROM_LOOKUP: 'Montant donné par le facturier' };
export const BILL_PAYMENT_STATUS_LABEL: Record<BillPaymentStatus, string> = {
  SUBMITTED: 'À régler',
  PROCESSING: 'En cours',
  COMPLETED: 'Réglée',
  REFUNDED: 'Remboursée',
};

/** Catégories proposées par défaut (une société peut en saisir d'autres : MAJUSCULES et « _ »). */
export const BILL_CATEGORY_LABEL: Record<string, string> = {
  ELECTRICITY: 'Électricité',
  WATER: 'Eau',
  GAS: 'Gaz',
  INTERNET_TV: 'Internet et TV',
  TELECOM: 'Téléphone',
  INSURANCE_AUTO: 'Assurance auto',
  INSURANCE_MOTO: 'Assurance moto',
  INSURANCE_HOME: 'Assurance habitation',
  INSURANCE_HEALTH: 'Assurance santé',
  SCHOOL_FEES: 'Frais de scolarité',
  UNIVERSITY_FEES: 'Frais universitaires',
  RENT: 'Loyer',
  TAXES: 'Impôts et taxes',
  HEALTH: 'Santé',
  TRANSPORT: 'Transport',
  OTHER: 'Autres factures',
};

export interface BillFieldDef {
  key: string;
  label: string;
  type: BillFieldType;
  required: boolean;
  pattern?: string;
  options?: string[];
}

export interface BillerAdmin {
  id: string;
  name: string;
  category: string;
  country: string | null;
  currency: string;
  description: string | null;
  status: BillerStatus;
  connectorKey: string;
  referenceLabel: string;
  referenceHint: string | null;
  referencePattern: string | null;
  fields: BillFieldDef[];
  amountMode: BillAmountMode;
  minAmount: number | null;
  maxAmount: number | null;
  feeFixed: number;
  feePct: number;
  partnershipStatus: BillPartnership;
  settlementInfo: string | null;
  settlementDelayHours: number;
  internalNote: string | null;
  sortOrder: number;
  openPayments?: number;
  createdAt: string;
  updatedAt: string;
}

/** Données envoyées à la création / modification d'un facturier. */
export interface BillerInput {
  name?: string;
  category?: string;
  country?: string | null;
  currency?: string;
  description?: string | null;
  status?: BillerStatus;
  connectorKey?: string;
  referenceLabel?: string;
  referenceHint?: string | null;
  referencePattern?: string | null;
  fields?: BillFieldDef[];
  amountMode?: BillAmountMode;
  minAmount?: number | null;
  maxAmount?: number | null;
  feeFixed?: number;
  feePct?: number;
  partnershipStatus?: BillPartnership;
  settlementInfo?: string | null;
  settlementDelayHours?: number;
  internalNote?: string | null;
  sortOrder?: number;
}

export interface BillPaymentAdmin {
  id: string;
  reference: string;
  status: BillPaymentStatus;
  late: boolean;
  biller: { id: string; name: string; category: string; settlementInfo: string | null };
  accountRef: string;
  referenceLabel: string;
  fields: Record<string, string>;
  customerName: string | null;
  amount: number;
  currency: string;
  totalCharged: number;
  walletCurrency: string;
  feeCharged: number;
  payer: { id: string; name: string; phone: string | null };
  providerRef: string | null;
  token: string | null;
  receiptNote: string | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
  refundedAt: string | null;
  simulated: boolean;
}

export interface BillsPaged<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface BillsStats {
  toSettle: number;
  processing: number;
  late: number;
  completed30: number;
  refunded30: number;
  byBiller: Array<{ billerId: string; name: string; currency: string; count: number; amount: number; late: number }>;
}

export interface BillPaymentsQuery {
  /** OPEN = à régler + en cours. */
  status?: BillPaymentStatus | 'OPEN';
  late?: boolean;
  billerId?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export type BillProcessInput =
  | { action: 'PROCESSING'; providerRef?: string }
  | { action: 'COMPLETE'; providerRef: string; token?: string; receiptNote?: string }
  | { action: 'FAIL'; reason: string };

const qs = (q: Record<string, string | number | boolean | undefined | null>): string => {
  const p = Object.entries(q)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return p.length ? `?${p.join('&')}` : '';
};

// ── Rapprochement du relevé d'un facturier (lot 14b) ───

export type BillReconcileKind = 'MATCHED' | 'AMOUNT_MISMATCH' | 'MISSING_AT_BILLER' | 'UNKNOWN_AT_BILLER' | 'DUPLICATE_LINE';

export const BILL_RECONCILE_KIND_LABEL: Record<BillReconcileKind, string> = {
  MATCHED: 'Concordant',
  AMOUNT_MISMATCH: 'Montant différent',
  MISSING_AT_BILLER: 'Absent chez le facturier',
  UNKNOWN_AT_BILLER: 'Inconnu chez nous',
  DUPLICATE_LINE: 'Ligne en double',
};

export interface BillColumnMapping {
  /** Intitulé de la colonne du montant, tel qu'écrit dans l'en-tête du fichier. */
  amount: string;
  providerRef?: string | null;
  reference?: string | null;
  date?: string | null;
}

export interface BillReconcileInput {
  billerId: string;
  /** Contenu du fichier CSV du facturier (texte). */
  csv: string;
  mapping?: BillColumnMapping;
  delimiter?: ';' | ',' | '\t' | '|';
  /** AAAA-MM-JJ : période des factures comparées (sinon déduite du fichier). */
  from?: string;
  to?: string;
  tolerance?: number;
}

export interface BillReconcileRow {
  kind: BillReconcileKind;
  line: number | null;
  fileAmount: number | null;
  fileRef: string | null;
  fileProviderRef: string | null;
  fileDate: string | null;
  paymentId: string | null;
  paymentReference: string | null;
  paymentAccountRef: string | null;
  paymentProviderRef: string | null;
  paymentAmount: number | null;
  diff: number | null;
}

/** Réponse quand les colonnes n'ont pas pu être devinées : l'administrateur les choisit puis relance. */
export interface BillReconcileNeedsMapping {
  needsMapping: true;
  biller: { id: string; name: string; currency: string };
  delimiter: string;
  headers: string[];
  sample: string[][];
}

export interface BillReconcileReport {
  needsMapping: false;
  biller: { id: string; name: string; currency: string };
  delimiter: string;
  headers: string[];
  mapping: BillColumnMapping | null;
  period: { from: string; to: string };
  fileLines: number;
  ourPayments: number;
  invalidAmountLines: number[];
  invalidAmountCount: number;
  counts: Record<BillReconcileKind, number>;
  totals: { matched: number; amountMismatch: number; missingAtBiller: number; unknownAtBiller: number };
  /** Plus de 500 lignes dans une catégorie : seules les 500 premières sont listées (les compteurs restent exacts). */
  truncated: boolean;
  rows: BillReconcileRow[];
}

export type BillReconcileResult = BillReconcileNeedsMapping | BillReconcileReport;

export function createBillsApi(http: HttpClient) {
  const enc = encodeURIComponent;
  return {
    meta: () => http.get<{ connectors: Array<{ key: string; label: string; automatic: boolean; lookup: boolean }> }>('/bills-admin/meta'),
    billers: () => http.get<BillerAdmin[]>('/bills-admin/billers'),
    createBiller: (input: BillerInput) => http.post<BillerAdmin>('/bills-admin/billers', input),
    updateBiller: (id: string, input: BillerInput) => http.patch<BillerAdmin>(`/bills-admin/billers/${enc(id)}`, input),
    removeBiller: (id: string) => http.delete<{ removed: boolean }>(`/bills-admin/billers/${enc(id)}`),
    stats: () => http.get<BillsStats>('/bills-admin/stats'),
    payments: (q: BillPaymentsQuery = {}) => http.get<BillsPaged<BillPaymentAdmin>>(`/bills-admin/payments${qs({ ...q })}`),
    /** Export CSV : octets demandés avec le jeton de l'administrateur (enregistrés par le navigateur). */
    exportCsv: (q: BillPaymentsQuery = {}) => http.get<Blob>(`/bills-admin/payments/export.csv${qs({ ...q, page: undefined, limit: undefined })}`, { responseType: 'blob' }),
    process: (id: string, input: BillProcessInput) => http.post<BillPaymentAdmin>(`/bills-admin/payments/${enc(id)}/process`, input),
    /** Rapproche le relevé CSV d'un facturier des factures réglées (rien n'est conservé côté serveur). */
    reconcile: (input: BillReconcileInput) => http.post<BillReconcileResult>('/bills-admin/reconcile', input),
    /** Les écarts du rapprochement, en CSV. */
    reconcileCsv: (input: BillReconcileInput) => http.post<Blob>('/bills-admin/reconcile/export.csv', input, { responseType: 'blob' }),
  };
}
