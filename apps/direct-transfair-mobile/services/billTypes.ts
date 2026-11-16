// apps/direct-transfair-mobile/services/billTypes.ts
// =========================================================
// PAIEMENT DE FACTURES — types partagés avec l'API /bills (lot 14).
// =========================================================

export type BillPaymentStatus = "SUBMITTED" | "PROCESSING" | "COMPLETED" | "REFUNDED";

export interface BillFieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  required: boolean;
  pattern?: string;
  options?: string[];
}

export interface BillOptions {
  enabled: boolean;
  categories: Array<{ category: string; count: number }>;
  savedCount: number;
}

export interface BillerView {
  id: string;
  name: string;
  category: string;
  country: string | null;
  currency: string;
  description: string | null;
  referenceLabel: string;
  referenceHint: string | null;
  referencePattern: string | null;
  fields: BillFieldDef[];
  amountMode: "FREE" | "FROM_LOOKUP";
  minAmount: number | null;
  maxAmount: number | null;
  feeFixed: number;
  feePct: number;
  settlementDelayHours: number;
  /** Mode simulation : aucun argent ne part vers un vrai facturier. */
  simulated: boolean;
  /** Réglé automatiquement (sinon : traité par la société dans le délai annoncé). */
  automatic: boolean;
}

export interface BillLookupResult {
  supported: boolean;
  customerName: string | null;
  amountDue: number | null;
  dueDate: string | null;
  currency: string;
}

export interface BillQuote {
  billerId: string;
  amount: number;
  fee: number;
  currency: string;
  walletCurrency: string;
  rate: number;
  amountCharged: number;
  feeCharged: number;
  totalCharged: number;
  customerName: string | null;
  balance: number;
  sufficient: boolean;
  delayHours: number;
  automatic: boolean;
  simulated: boolean;
}

export interface BillPaymentView {
  id: string;
  reference: string;
  status: BillPaymentStatus;
  biller: { id: string; name: string; category: string; currency: string };
  accountRef: string;
  referenceLabel: string;
  customerName: string | null;
  fields: Array<{ label: string; value: string }>;
  amount: number;
  fee: number;
  currency: string;
  walletCurrency: string;
  rate: number;
  amountCharged: number;
  feeCharged: number;
  totalCharged: number;
  providerRef: string | null;
  token: string | null;
  receiptNote: string | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
  refundedAt: string | null;
  expectedBy: string | null;
  simulated: boolean;
  /** Code imprimé sur le reçu : permet à un tiers de vérifier l'authenticité (reçu réglé uniquement). */
  receiptCode: string | null;
}

export interface SavedBillView {
  id: string;
  label: string;
  accountRef: string;
  customerName: string | null;
  fields: Record<string, string>;
  available: boolean;
  biller: BillerView;
}

export interface PayBillInput {
  reference: string;
  fields?: Record<string, string>;
  amount: number;
  walletCurrency?: string;
  pin: string;
  idempotencyKey: string;
  saveAs?: string;
}

// ── Factures récurrentes (lot 14b) ─────────────────────

export type BillScheduleFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
export type BillScheduleMode = "REMIND" | "AUTO";
export type BillScheduleStatus = "ACTIVE" | "PAUSED" | "ENDED";

export interface BillScheduleView {
  id: string;
  label: string;
  biller: { id: string; name: string; category: string; currency: string };
  /** Le facturier est toujours proposé par la société (sinon : les échéances ne peuvent plus être payées). */
  available: boolean;
  referenceLabel: string;
  accountRef: string;
  customerName: string | null;
  fields: Array<{ label: string; value: string }>;
  /** Valeurs saisies, par clé de champ du facturier (préremplissage de « Payer maintenant »). */
  fieldValues: Record<string, string>;
  /** Montant fixe de chaque échéance ; null si le facturier le fournit à chaque fois. */
  amount: number | null;
  amountFromBiller: boolean;
  currency: string;
  walletCurrency: string | null;
  frequency: BillScheduleFrequency;
  mode: BillScheduleMode;
  status: BillScheduleStatus;
  nextRunAt: string;
  endAt: string | null;
  failureCount: number;
  lastError: string | null;
  lastRunAt: string | null;
  lastPaymentId: string | null;
  runsCount: number;
  createdAt: string;
}

export interface BillScheduleList {
  /** Module des factures ET des programmations ouverts par la société. */
  enabled: boolean;
  /** Prélèvement automatique autorisé par la société. */
  autoDebitEnabled: boolean;
  maxPerClient: number;
  remindDaysBefore: number;
  data: BillScheduleView[];
}

export interface CreateBillScheduleInput {
  billerId: string;
  label: string;
  reference: string;
  fields?: Record<string, string>;
  customerName?: string;
  amount?: number;
  walletCurrency?: string;
  frequency: BillScheduleFrequency;
  /** AAAA-MM-JJ */
  startDate: string;
  endDate?: string;
  mode: BillScheduleMode;
  /** Obligatoire pour AUTO (consentement donné une seule fois). */
  pin?: string;
}

export interface UpdateBillScheduleInput {
  label?: string;
  amount?: number;
  /** AAAA-MM-JJ, ou "" pour retirer la date de fin. */
  endDate?: string;
  mode?: BillScheduleMode;
  pin?: string;
}

