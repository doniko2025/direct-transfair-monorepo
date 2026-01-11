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
// ✅ NOUVELLE SECTION : AGENCES & COMMISSIONS
// ============================================================

// 1. Type d'agence
export type AgencyType = 'PRIVATE' | 'PARTNER';

export interface Agency {
    id: string;
    name: string;
    city: string;
    type: AgencyType;
    balance: number; // Solde caisse virtuelle
    clientId: number; // Lié à la société mère
    createdAt: string;
}

export interface CreateAgencyPayload {
    name: string;
    city: string;
    type: AgencyType;
}

// 2. Configuration des commissions (Règles de partage)
export interface CommissionConfig {
    senderPart: number;   // % pour l'agence qui envoie (ex: 20%)
    payerPart: number;    // % pour l'agence qui paie le retrait (ex: 20%)
    platformPart: number; // % restant pour la société (ex: 60%)
}

// 3. Historique des commissions (Traçabilité)
export interface CommissionLog {
    id: string;
    transactionId: string;
    transactionReference: string;
    totalFee: number; // Le montant total des frais payés par le client
    
    // Part Expéditeur
    senderAgencyId?: string;
    senderAgencyName?: string;
    senderAgencyType?: AgencyType;
    senderCommission: number; // Montant gagné

    // Part Payeur (si retrait effectué)
    payerAgencyId?: string;
    payerAgencyName?: string;
    payerAgencyType?: AgencyType;
    payerCommission: number; // Montant gagné

    // Part Plateforme
    platformCommission: number; // Montant gagné par la société
    
    createdAt: string;
}