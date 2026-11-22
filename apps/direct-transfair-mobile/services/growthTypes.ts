// apps/direct-transfair-mobile/services/growthTypes.ts
// =========================================================
// CROISSANCE (lot 16) — types des routes /rate-locks, /money-requests et /referrals/me.
// Même contrat que packages/shared/src/growth.ts et apps/backend/src/growth/.
// =========================================================

export interface RateLock {
  id: string;
  currency: string;
  targetCurrency: string;
  amount: number;
  /** Taux brut (montant reçu ÷ montant envoyé). */
  rate: number;
  receivedAmount: number;
  expiresAt: string;
  secondsLeft: number;
}

export type MoneyRequestStatus = "PENDING" | "PAID" | "DECLINED" | "CANCELLED" | "EXPIRED";

export interface MoneyRequestView {
  id: string;
  /** SENT : j'ai demandé de l'argent ; RECEIVED : on m'en demande. */
  direction: "SENT" | "RECEIVED";
  status: MoneyRequestStatus;
  amount: number;
  currency: string;
  note: string | null;
  counterpartId: string;
  counterpartName: string;
  counterpartPhone: string | null;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
  /** Envoi qui a réglé la demande (null tant qu'elle n'est pas réglée). `amount` reste le montant demandé. */
  settlement: MoneyRequestSettlement | null;
}

/** Ce qui a réellement circulé pour régler la demande : peut dépasser le montant demandé. */
export interface MoneyRequestSettlement {
  transactionId: string;
  /** Envoyé par le payeur, dans sa devise. */
  sentAmount: number;
  sentCurrency: string;
  /** Reçu par le demandeur, dans la devise de la demande. */
  receivedAmount: number;
  receivedCurrency: string;
}

export interface MoneyRequestsOverview {
  received: MoneyRequestView[];
  sent: MoneyRequestView[];
  pendingToPay: number;
}

export interface MyReferral {
  code: string | null;
  program: { active: boolean; refereeWaivers: number; referrerWaivers: number; validityDays: number; minFirstTransfer: number; minFirstTransferCurrency?: string | null };
  referredCount: number;
  freeTransfersLeft: number;
  nextExpiry: string | null;
  rewards: Array<{ id: string; kind: "REFEREE_WELCOME" | "REFERRER_BONUS"; status: "AVAILABLE" | "USED" | "EXPIRED"; remaining: number; expiresAt: string; createdAt: string }>;
}
