// apps/direct-transfair-mobile/services/merchantTypes.ts
// Lot 11 — types du compte marchand et des paiements QR / téléphone (contrat : apps/backend/src/merchants).

export type MerchantStatus = "ACTIVE" | "SUSPENDED";
export type PaymentMethod = "PHONE" | "QR";
export type PaymentStatus = "PENDING" | "PAID" | "DECLINED" | "EXPIRED" | "CANCELLED";
/** Moyen d'encaissement tel que rangé dans les rapports : le QR de caisse permanent a sa propre ligne. */
export type SaleMethod = "PHONE" | "QR" | "STATIC_QR";
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
  /** Coordonnées du COMMERCE (jamais celles du client) : quartier, code postal (facultatif), pays, téléphone du commerce, NIF / IFU. */
  district?: string | null;
  postalCode?: string | null;
  country?: string | null;
  businessPhone?: string | null;
  taxId?: string | null;
  /** Numéro RCCM — nul pour un compte créé avant que ce numéro soit obligatoire (à renseigner dans les réglages). */
  rccm?: string | null;
  status: MerchantStatus;
  suspendedReason: string | null;
  orangeMoneyPhone: string | null;
  orangeMoneyMasked: string;
  bank: { holderName: string | null; ibanMasked: string; bic: string | null } | null;
  destinationChangedAt: string | null;
  payoutLockedUntil: string | null;
  createdAt: string;
  /** Lot 13 — identifiant public du commerce (logo, QR de caisse, équipe). */
  shopId?: string;
  /** Empreinte du logo : nulle = pas de logo. Ne retélécharger que si elle change. */
  logoVersion?: string | null;
  hasStaticQr?: boolean;
  alerts?: { lowBalanceThreshold: number | null; failureAlertsEnabled: boolean };
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
  /** `net` = encaissé après commission, MOINS les remboursements du jour (refundsTotal). */
  today: { currency: string; count: number; gross: number; net: number; refundsTotal?: number; refundsCount?: number }[];
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
  merchant: { id: string; businessName: string; city: string | null; category: string | null; shopId?: string; address?: string | null; logoVersion?: string | null };
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
  /** Lot 13 */
  viaStaticQr?: boolean;
  refunded?: boolean;
  refundedAt?: string | null;
  refundReason?: string | null;
  /** Le demandeur connecté a le droit de rembourser ce paiement (propriétaire, ou caissier autorisé). */
  canRefund?: boolean;
  /** Lot 14 — code signé du reçu (paiements payés) : encodé en QR sur le PDF pour que le serveur confirme les vraies données. */
  verifyCode?: string;
  /** Aperçu d'un QR de caisse : le client choisit lui-même le montant. */
  staticQr?: boolean;
  minAmount?: number | null;
  maxAmount?: number | null;
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
  /** Adresse et ville du commerce : obligatoires à l'activation. */
  address?: string;
  city?: string;
  /** Facultatifs : une chaîne vide retire la valeur (modification de la fiche). */
  district?: string;
  postalCode?: string;
  country?: string;
  /** Téléphone du commerce, avec indicatif (+224…). */
  businessPhone?: string;
  taxId?: string;
  /** Obligatoire à l'activation d'un compte marchand. */
  rccm?: string;
  orangeMoneyPhone?: string;
}


// ── Lot 13 : QR de caisse, logo, caissiers, clôture, alertes ─────────────────────────────────────────

export interface StaticQrView {
  payload: string;
  shopId: string;
  businessName: string;
  city: string | null;
  currency: string | null;
  logoVersion: string | null;
}

export interface StaffMember {
  id: string;
  userId: string;
  name: string;
  phoneMasked: string;
  active: boolean;
  canRefund: boolean;
  maxAmount: number | null;
  createdAt: string;
}

export interface StaffList {
  data: StaffMember[];
  max: number;
}

/** Un commerce où la personne connectée est caissier. */
export interface StaffMembership {
  shopId: string;
  businessName: string;
  city: string | null;
  logoVersion: string | null;
  available: boolean;
  canRefund: boolean;
  maxAmount: number | null;
  currency: string;
  minPayment: number | null;
  maxPayment: number | null;
  qrValidityMinutes: number;
}

export interface StaffDay {
  day: string;
  totals: { currency: string; count: number; gross: number }[];
}

export interface CurrencyTotalsView {
  currency: string;
  count: number;
  gross: number;
  fees: number;
  net: number;
  refundsCount: number;
  refundsTotal: number;
  balanceChange: number;
  byMethod: Record<SaleMethod, number>;
  byCashier: { userId: string | null; count: number; gross: number }[];
  byCashierNamed: { userId: string | null; name: string; count: number; gross: number }[];
}

export interface ReportPayment {
  id: string;
  reference: string;
  at: string | null;
  currency: string;
  amount: number;
  fee: number;
  net: number;
  method: SaleMethod;
  payer: string | null;
  cashier: string | null;
  note: string | null;
  refunded: boolean;
}

export interface ReportRefund {
  id: string;
  reference: string;
  at: string | null;
  currency: string;
  amount: number;
  payer: string | null;
  reason: string | null;
}

export interface MerchantReport {
  shop: { id: string; businessName: string; city: string | null };
  period: { from: string; to: string; tz: number };
  totals: CurrencyTotalsView[];
  truncated: boolean;
  payments: ReportPayment[];
  refunds: ReportRefund[];
}

export interface ClosingView {
  id: string;
  day: string;
  currency: string;
  count: number;
  gross: number;
  fees: number;
  net: number;
  refundsCount: number;
  refundsTotal: number;
  balanceChange: number;
  details: { byMethod?: Record<SaleMethod, number>; byCashier?: { name: string; count: number; gross: number }[] } | null;
  closedAt: string;
}

export interface DayView {
  shop: { id: string; businessName: string };
  day: string;
  tz: number;
  live: CurrencyTotalsView[];
  closings: ClosingView[];
  /** Un paiement ou remboursement est arrivé APRÈS la clôture. */
  drift: boolean;
}

/** Réponse de la page publique de vérification d'un reçu (lot 14). */
export type ReceiptCheck =
  | {
      valid: true;
      reference: string;
      businessName: string;
      city: string | null;
      amount: number;
      currency: string;
      paidAt: string;
      method: SaleMethod;
      status: "PAID" | "REFUNDED";
      refundedAt: string | null;
    }
  | { valid: false };
