// apps/direct-transfair-mobile/services/merchantTypes.ts
// Lot 11 — types du compte marchand et des paiements QR / téléphone (contrat : apps/backend/src/merchants).

export type MerchantStatus = "ACTIVE" | "SUSPENDED";
export type PaymentMethod = "PHONE" | "QR";
export type PaymentStatus = "PENDING" | "PAID" | "DECLINED" | "EXPIRED" | "CANCELLED";
export type PayoutMethod = "ORANGE_MONEY" | "BANK_TRANSFER";
export type PayoutStatus = "PENDING" | "PAID" | "REJECTED" | "FAILED";

export interface MerchantSettingsPublic {
  enabled: boolean;
  paymentFeePct: number;
  payoutFeePct: number;
  qrValidityMinutes: number;
  phoneRequestValidityMinutes: number;
  payoutCooldownHours: number;
  payoutMethods: string[];
  minPayment: Record<string, number>;
  maxPayment: Record<string, number>;
  minPayout: Record<string, number>;
}

export interface MerchantProfileView {
  businessName: string;
  category: string | null;
  address: string | null;
  city: string | null;
  status: MerchantStatus;
  suspendedReason: string | null;
  orangeMoneyPhone: string | null;
  orangeMoneyMasked: string;
  bank: { holderName: string | null; ibanMasked: string; bic: string | null } | null;
  destinationChangedAt: string | null;
  payoutLockedUntil: string | null;
  createdAt: string;
}

export interface MerchantMe {
  isMerchant: boolean;
  accountType: "PERSONAL" | "MERCHANT";
  canActivate: boolean;
  profile: MerchantProfileView | null;
  availablePayoutMethods: PayoutMethod[];
  settings: MerchantSettingsPublic;
  categories: string[];
  /** Devise du compte (GNF, XOF, EUR…). Détermine si Orange Money est proposé. */
  currency?: string;
  /** Orange Money n'existe que pour les comptes GNF / XOF. */
  orangeMoneyAllowed?: boolean;
  /** Le numéro Orange enregistré ne correspond plus à la devise du compte : il faut le corriger. */
  orangeNeedsUpdate?: boolean;
}

export interface MerchantSummary {
  /** Solde du COMMERCE (portefeuille propre, distinct de celui du client). Vide = rien encaissé = 0. */
  wallets: { currency: string; balance: number; reserved: number; available: number }[];
  today: { currency: string; count: number; gross: number; net: number }[];
  total: { currency: string; count: number; net: number }[];
  pendingRequests: number;
  pendingPayouts: number;
}

export interface PaymentRequestView {
  id: string;
  reference: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  /** Visibles du marchand seulement. */
  fee?: number;
  netAmount?: number;
  currency: string;
  note: string | null;
  merchant: { id: string; businessName: string; city: string | null; category: string | null };
  payer: { id: string; name: string } | null;
  payerPhone?: string | null;
  /** Lien à encoder dans le QR code (marchand, demande QR encore ouverte). */
  qrPayload?: string;
  expiresAt: string;
  secondsLeft: number;
  createdAt: string;
  paidAt: string | null;
  failureReason: string | null;
  isMine: "PAYEE" | "PAYER";
  transactionId?: string;
}

export interface PayoutView {
  id: string;
  reference: string;
  method: PayoutMethod;
  status: PayoutStatus;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  destination: string;
  destinationLabel: string | null;
  providerRef: string | null;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface Paged<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface MerchantProfileInput {
  businessName: string;
  category?: string;
  address?: string;
  city?: string;
  orangeMoneyPhone: string;
}
