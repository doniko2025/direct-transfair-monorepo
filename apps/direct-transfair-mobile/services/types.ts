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
  clientId: number;
  agencyId?: string;
  balance?: number;
  client?: {
    name: string;
    code: string;
    primaryColor?: string;
  };
  agency?: Agency;
}

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
export type TransactionStatus = "PENDING" | "VALIDATED" | "PAID" | "CANCELLED";
export type PayoutMethod = "CASH_PICKUP" | "BANK_DEPOSIT" | "MOBILE_MONEY" | "WALLET";

export interface Transaction {
  id: string;
  reference: string;
  amount: number;
  fees: number;
  total: number;
  currency: string;
  status: TransactionStatus;
  payoutMethod: PayoutMethod;
  createdAt: string;
  paidAt?: string | null;
  cancelledAt?: string | null;
  beneficiaryId?: string;
  senderId?: string;
  senderName?: string;
}

export interface CreateTransactionPayload {
  amount: number;
  currency: string;
  beneficiaryId: string;
  payoutMethod: string;
}

// --- PAIEMENTS & RETRAITS ---
export type PaymentMethod = "WALLET" | "ORANGE_MONEY" | "SENDWAVE" | "CARD" | "CASH";

export interface InitiatePaymentPayload {
  transactionId: string;
  provider: 'ORANGE_MONEY' | 'WAVE';
  phone: string;
}

export type WithdrawalMethod = "CASH_PICKUP" | "MOBILE_MONEY" | "WALLET";

export interface CreateWithdrawalPayload {
  amount?: number;
  transactionId?: string;
}

export type WithdrawalStatus = "PENDING" | "APPROVED" | "PAID" | "REJECTED";

export interface UpdateWithdrawalStatusPayload {
  status: WithdrawalStatus;
}

// --- TAUX DE CHANGE ---
export interface ExchangeRate {
  pair: string;
  rate: number;
}

// ============================================================
// ✅ AGENCES
// ============================================================

export type AgencyType = "PRIVATE" | "PARTNER";

export interface Agency {
  id: string | number;
  name: string;
  city: string;
  address: string;
  phone?: string | null;
  
  // ✅ Ces champs sont indispensables pour l'écran Edit
  email?: string;
  code?: string;
  isActive?: boolean;
  
  type?: AgencyType;
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

// 2. Configuration des commissions
export interface CommissionConfig {
  senderPart: number;
  payerPart: number;
  platformPart: number;
}

// 3. Historique des commissions
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