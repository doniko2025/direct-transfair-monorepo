// packages/shared/src/transactions.ts
// =========================================================
// TRANSACTIONS — SUPER_ADMIN (toute la plateforme), COMPANY_ADMIN (sa société)
// et AGENT (ses propres opérations).
//
// Contrat relevé dans apps/backend/src/transactions/transactions.controller.ts :
//   GET   /transactions/admin               liste complète (AdminGuard), non paginée, la plus récente d'abord
//   GET   /transactions                     liste « mes transactions » (périmètre selon le rôle, agent compris)
//   GET   /transactions/:id                 détail dans le périmètre du rôle (404 sinon)
//   PATCH /transactions/admin/status/:id    changement de statut { status } (SUPER_ADMIN, COMPANY_ADMIN de la société)
//   PATCH /transactions/b2b/validate/:id    validation d'un paiement B2B (SUPER_ADMIN)
//   PATCH /transactions/b2b/reject/:id      rejet d'un paiement B2B avec remboursement (SUPER_ADMIN)
//
// Les montants Decimal arrivent en chaîne de caractères.
// =========================================================

import type { CurrencyCode } from './companies';
import type { HttpClient } from './http';

export type TransactionStatus =
  | 'PENDING'
  | 'VALIDATED'
  | 'PROCESSING'
  | 'PAID'
  | 'CANCELLED'
  | 'FAILED'
  | 'REFUNDED'
  | 'ON_HOLD'
  | 'EXPIRED';

export type TransactionType =
  | 'TRANSFER'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'SERVICE_PAYMENT'
  | 'INTERNAL_TRANSFER'
  | 'FEE_COLLECTION'
  | 'EXCHANGE'
  | 'AGENCY_REFILL'
  | 'AGENCY_REMITTANCE'
  | 'AGENCY_COLLECTION'
  | 'REFUND'
  | 'LOYALTY_CREDIT'
  | 'SCHEDULED';

export type PayoutMethod = 'CASH_PICKUP' | 'BANK_DEPOSIT' | 'MOBILE_MONEY' | 'WALLET' | 'IBAN_TRANSFER' | 'CRYPTO';

export type PaymentMethod =
  | 'WALLET'
  | 'ORANGE_MONEY'
  | 'SENDWAVE'
  | 'CARD'
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'APPLE_PAY'
  | 'GOOGLE_PAY'
  | 'PAYPAL';

export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

type Amount = string | number;

/** Expéditeur. La liste « mes transactions » n'en renvoie que l'identité et le téléphone. */
export interface TransactionSender {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone?: string | null;
  email?: string | null;
  role?: string;
}

export interface TransactionBeneficiary {
  id: string;
  fullName: string;
  country?: string | null;
  city?: string | null;
  phone?: string | null;
  mobileMoneyOperator?: string | null;
}

export interface TransactionWithdrawal {
  id: string;
  method: PayoutMethod;
  status: WithdrawalStatus;
  requestedAt?: string;
  processedAt?: string | null;
  processedById?: string | null;
  rejectionReason?: string | null;
}

export interface Transaction {
  id: string;
  reference: string;
  type: TransactionType;
  direction?: 'INBOUND' | 'OUTBOUND';
  status: TransactionStatus;

  amount: Amount;
  fees: Amount;
  total: Amount;
  currency: CurrencyCode;
  targetCurrency?: CurrencyCode | null;
  exchangeRate?: number | null;
  receivedAmount?: Amount | null;

  senderCommission?: Amount | null;
  payerCommission?: Amount | null;
  platformCommission?: Amount | null;

  payoutMethod?: PayoutMethod | null;
  paymentMethod?: PaymentMethod | null;

  isFlagged?: boolean;
  riskScore?: number;
  note?: string | null;
  /** Pour un paiement B2B : la référence du virement bancaire saisie par la société. */
  providerRef?: string | null;

  senderId: string;
  recipientId?: string | null;
  clientId?: number;

  createdAt: string;
  validatedAt?: string | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
  failedAt?: string | null;
  expiresAt?: string | null;

  sender?: TransactionSender | null;
  beneficiary?: TransactionBeneficiary | null;
  withdrawal?: TransactionWithdrawal | null;
  /** Société (renvoyée par la liste administrateur uniquement). */
  client?: { id?: number; name: string; code: string } | null;

  /**
   * Agence dont la caisse est mouvementée par l'opération : recharge, remontée de fonds, retrait forcé,
   * dépôt client ou envoi fait par un agent. Absent pour un envoi de client. Ce n'est pas l'agence qui paie un retrait.
   */
  agencyId?: string | null;
  agency?: { id: string; name: string; city?: string | null } | null;
}

/** Statuts qu'un administrateur peut demander (le serveur valide la transition). */
export type AdminTargetStatus = Extract<TransactionStatus, 'VALIDATED' | 'PAID' | 'CANCELLED' | 'FAILED'>;

function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: T[] }).data;
  }
  return [];
}

export function createTransactionsApi(http: HttpClient) {
  const enc = encodeURIComponent;
  return {
    /** Administrateurs : toute la plateforme (super admin) ou la société (admin de société). */
    listAdmin: async (): Promise<Transaction[]> =>
      asList<Transaction>(await http.get<unknown>('/transactions/admin')),

    /** Agents : leurs propres opérations (envois, dépôts, retraits payés, recharges de caisse). */
    listMine: async (): Promise<Transaction[]> => asList<Transaction>(await http.get<unknown>('/transactions')),

    get: (id: string) => http.get<Transaction>(`/transactions/${enc(id)}`),

    setStatus: (id: string, status: AdminTargetStatus) =>
      http.patch<Transaction>(`/transactions/admin/status/${enc(id)}`, { status }),

    /** Paiement B2B : le super admin encaisse. */
    validateB2B: (id: string) => http.patch<Transaction>(`/transactions/b2b/validate/${enc(id)}`, {}),

    /** Paiement B2B : le super admin refuse, l'expéditeur est remboursé. */
    rejectB2B: (id: string) => http.patch<Transaction>(`/transactions/b2b/reject/${enc(id)}`, {}),
  };
}
