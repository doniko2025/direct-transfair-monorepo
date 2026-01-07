// apps/direct-transfair-mobile/services/types.ts

// --- AUTH & USER ---
// ✅ Rôles mis à jour pour le SaaS
export type Role = "SUPER_ADMIN" | "COMPANY_ADMIN" | "AGENT" | "USER";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;

  // Identité
  firstName?: string;
  lastName?: string;
  phone?: string;

  // Adresse
  addressStreet?: string;
  postalCode?: string;
  city?: string;
  country?: string;

  // État Civil & Profession
  gender?: "M" | "F";
  nationality?: string;
  birthDate?: string;
  birthPlace?: string;
  jobTitle?: string;

  // ✅ SaaS
  clientId: number;   
  agencyId?: string;  
  balance?: number;   
};

export type LoginPayload = { 
  email: string; 
  password: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
};

export type LoginResponse = {
  access_token: string;
  user: AuthUser;
};

// --- BÉNÉFICIAIRES ---
export type Beneficiary = {
  id: string;
  fullName: string;
  country: string;
  city: string;
  phone?: string | null;
  createdAt?: string;
  clientId?: number;
};

export type CreateBeneficiaryPayload = {
  fullName: string;
  country: string;
  city: string;
  phone?: string | null;
};

// --- TRANSACTIONS ---
export type TransactionStatus = "PENDING" | "VALIDATED" | "PAID" | "CANCELLED";
export type PayoutMethod = "CASH_PICKUP" | "BANK_DEPOSIT" | "MOBILE_MONEY" | "WALLET";

export type Transaction = {
  id: string;
  reference: string;
  amount: string | number;
  fees: string | number;
  total: string | number;
  currency: string;
  status: TransactionStatus;
  payoutMethod: PayoutMethod;
  createdAt: string;
  paidAt?: string | null;
  cancelledAt?: string | null;
};

export type CreateTransactionPayload = {
  amount: number;
  currency: string;
  beneficiaryId: string;
  payoutMethod: PayoutMethod;
};

// --- PAIEMENTS & RETRAITS ---
export type PaymentMethod = "WALLET" | "ORANGE_MONEY" | "SENDWAVE" | "CARD" | "CASH";

export type InitiatePaymentPayload = {
  transactionId: string;
  paymentMethod: PaymentMethod;
};

export type WithdrawalMethod = "CASH_PICKUP" | "MOBILE_MONEY" | "WALLET";

export type CreateWithdrawalPayload = {
  transactionId: string;
  method: WithdrawalMethod;
};

export type WithdrawalStatus = "PENDING" | "APPROVED" | "PAID" | "REJECTED";

export type UpdateWithdrawalStatusPayload = {
  status: WithdrawalStatus;
};

// --- TAUX DE CHANGE ---
export type ExchangeRate = {
    pair: string;
    rate: number;
};