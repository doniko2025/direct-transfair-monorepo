// apps/direct-transfair-mobile/services/types.ts
// --- ENUMS & TYPES DE BASE ---
export type Role = "SUPER_ADMIN" | "COMPANY_ADMIN" | "AGENT" | "USER";

// --- AUTHENTIFICATION & UTILISATEUR ---
export interface AuthUser {
  id: string;
  email: string;
  role: Role;

  firstName?: string;
  lastName?: string;
  phone?: string;

  addressStreet?: string;
  postalCode?: string;
  city?: string;
  country?: string;

  gender?: "M" | "F";
  nationality?: string;
  birthDate?: string;
  birthPlace?: string;

  jobTitle?: string;

  // ✅ AJOUT ADMIN (corrige ton erreur TS)
  agencyName?: string;

  clientId: number;
  agencyId?: string;
  balance?: number;

  // Relations
  client?: {
    name: string;
    code: string;
    primaryColor?: string;
  };
  agency?: Agency;
}

// Alias utile si d'autres fichiers importent "User"
export type User = AuthUser;

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  tenantCode?: string;
  country?: string;
  city?: string;
}

export interface LoginResponse {
  access_token: string;
  user: AuthUser;
}

// --- BÉNÉFICIAIRES ---
export interface Beneficiary {
  id: string;
  fullName: string;
  country: string;
  city: string;
  phone?: string | null;
  createdAt?: string;
  clientId?: number;
  userId: string;
}

export interface CreateBeneficiaryPayload {
  fullName: string;
  country: string;
  city: string;
  phone?: string | null;
}

// --- TRANSACTIONS ---
export type TransactionStatus =
  | "PENDING"
  | "VALIDATED"
  | "PAID"
  | "CANCELLED";

export type PayoutMethod =
  | "CASH_PICKUP"
  | "BANK_DEPOSIT"
  | "MOBILE_MONEY"
  | "WALLET";

export type PaymentMethod =
  | "WALLET"
  | "ORANGE_MONEY"
  | "SENDWAVE"
  | "CARD"
  | "CASH"
  | "BANK_TRANSFER";

// ✅ Ajout UI
export type TransactionType =
  | "SERVICE_PAYMENT"
  | "TRANSFER"
  | "DEPOSIT"
  | "WITHDRAWAL";

export type WithdrawalStatus =
  | "PENDING"
  | "APPROVED"
  | "PAID"
  | "REJECTED"
  | "FAILED"
  | "CANCELLED";

export interface Transaction {
  id: string;
  reference: string;

  // UI optionnels
  type?: TransactionType | string;
  paymentMethod?: PaymentMethod | string;

  // Montants
  amount: number;
  fees: number;
  total: number;

  receivedAmount?: number;
  targetCurrency?: string;
  exchangeRate?: number;

  currency: string;
  status: TransactionStatus;
  payoutMethod: PayoutMethod;

  createdAt: string;
  paidAt?: string | null;
  cancelledAt?: string | null;

  beneficiaryId?: string;
  senderId?: string;
  recipientId?: string;

  providerRef?: string | null;

  senderFirstName?: string;
  senderLastName?: string;

  // Relations
  sender?: AuthUser;
  beneficiary?: Beneficiary | null;

  withdrawal?:
    | {
        id: string;
        status: WithdrawalStatus;
        method: PayoutMethod;
        processedById?: string | null;
        processedAt?: string | null;
        requestedAt?: string;
        code?: string;
      }
    | null;
}

export interface CreateTransactionPayload {
  amount: number;
  currency: string;
  beneficiaryId: string;
  payoutMethod: string;

  senderFirstName?: string;
  senderLastName?: string;
  senderPhone?: string;
}

export interface CreateDepositPayload {
  amount: number;
  userPhone: string;
}

// --- PAIEMENTS & RETRAITS ---
export interface InitiatePaymentPayload {
  transactionId: string;
  provider: "ORANGE_MONEY" | "WAVE";
  phone: string;
}

export type WithdrawalMethod =
  | "CASH_PICKUP"
  | "MOBILE_MONEY"
  | "WALLET";

export interface CreateWithdrawalPayload {
  amount?: number;
  transactionId?: string;
}

export interface UpdateWithdrawalStatusPayload {
  status: WithdrawalStatus;
}

// --- TAUX DE CHANGE ---
export interface ExchangeRate {
  pair: string;
  rate: number;
  updatedAt?: string;
}

// ============================================================
// AGENCES
// ============================================================

export type AgencyType =
  | "SUBSIDIARY"
  | "PARTNER"
  | "PRIVATE";

export interface Agency {
  id: string | number;
  name: string;
  city: string;
  address: string;
  phone?: string | null;

  email?: string;
  code?: string;
  isActive?: boolean;

  type?: AgencyType;
  currency?: string;
  balance?: number;
  clientId: number;
  createdAt?: string;
  agents?: AuthUser[];
}

export interface CreateAgencyPayload {
  name: string;
  city: string;
  address: string;
  email: string;
  phone?: string;
  code?: string;
  country?: string;
  managerName?: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminPassword?: string;
  status?: string;
  subscriptionType?: string;
  type?: AgencyType;
}

// --- COMMISSIONS ---
export interface CommissionConfig {
  senderPart: number;
  payerPart: number;
  platformPart: number;
}

export interface CommissionLog {
  id: string;
  transactionId: string;
  transactionReference: string;
  totalFee: number;
  senderAgencyId?: string;
  senderAgencyName?: string;
  senderAgencyType?: AgencyType;
  senderCommission: number;
  payerAgencyId?: string;
  payerAgencyName?: string;
  payerAgencyType?: AgencyType;
  payerCommission: number;
  platformCommission: number;
  createdAt: string;
}
