// apps/direct-transfair-mobile/services/types.ts
// --- ENUMS & TYPES DE BASE ---
export type Role = "SUPER_ADMIN" | "COMPANY_ADMIN" | "AGENT" | "USER";

// --- AUTHENTIFICATION & UTILISATEUR ---
export interface AuthUser {
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

  // Données SaaS
  clientId: number;
  agencyId?: string;
  balance?: number;

  // Objet Client (Société)
  client?: {
    name: string;
    code: string;
    primaryColor?: string;
  };
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

// ✅ On garde fullName ici pour compatibilité avec le Backend actuel
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
}

export interface CreateTransactionPayload {
  amount: number;
  currency: string;
  beneficiaryId: string;
  payoutMethod: PayoutMethod;
}

// --- PAIEMENTS & RETRAITS ---
export type PaymentMethod = "WALLET" | "ORANGE_MONEY" | "SENDWAVE" | "CARD" | "CASH";

export interface InitiatePaymentPayload {
  amount: number;
  currency: string;
  method: string;
  phone: string;
  transactionId?: string;
}

export type WithdrawalMethod = "CASH_PICKUP" | "MOBILE_MONEY" | "WALLET";

export interface CreateWithdrawalPayload {
  amount: number;
  transactionReference: string;
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
// ✅ AGENCES & COMMISSIONS
// ============================================================

// Le backend n'a pas de champ "type" dans Prisma Agency.
// On le garde côté front pour l'UI, mais il n'est pas garanti au retour.
export type AgencyType = "PRIVATE" | "PARTNER";

export interface Agency {
  id: string;
  name: string;
  city: string;
  address: string;
  phone?: string | null;

  // compat UI (peut être absent selon backend)
  type?: AgencyType;

  // Prisma Decimal => peut remonter en string selon sérialisation
  balance: number | string;

  clientId: number;
  createdAt: string;
}

// ✅ DOIT matcher CreateAgencyDto (backend)
export interface CreateAgencyPayload {
  name: string;
  city: string;
  address: string;

  // backend accepte optionnel
  phone?: string;

  // backend exige email (login agent)
  email: string;

  // options agent
  country?: string;
  managerName?: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminPassword?: string;

  // champs tolérés
  code?: string;
  status?: string;
  subscriptionType?: string;

  // compat UI
  type?: AgencyType;
}

// 2. Configuration des commissions (Règles de partage)
export interface CommissionConfig {
  senderPart: number;
  payerPart: number;
  platformPart: number;
}

// 3. Historique des commissions (Traçabilité)
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
