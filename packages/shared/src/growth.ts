// packages/shared/src/growth.ts
// =========================================================
// CROISSANCE (lot 16) — contrat de apps/backend/src/growth/
//   Client (application mobile) :
//     POST  /rate-locks                    taux garanti quelques minutes → joindre `rateLockId` à POST /transactions
//     POST  /money-requests                demander de l'argent à un autre client
//     GET   /money-requests                demandes reçues / envoyées
//     PATCH /money-requests/:id/decline    refuser   |   PATCH /money-requests/:id/cancel   annuler
//     GET   /referrals/me                  code de parrainage, filleuls, envois sans frais restants
//   Administrateur de société :
//     GET|PUT /referrals-admin/config      réglages du programme de parrainage
//     GET     /referrals-admin/stats       filleuls, récompenses, meilleurs parrains
// =========================================================

import type { HttpClient } from './http';

export interface RateLock {
  id: string;
  currency: string;
  targetCurrency: string;
  amount: number;
  /** Taux brut (montant reçu / montant envoyé). */
  rate: number;
  receivedAmount: number;
  expiresAt: string;
  secondsLeft: number;
}

export interface QuoteRateLockInput {
  amount: number;
  currency: string;
  targetCurrency: string;
}

export type MoneyRequestStatus = 'PENDING' | 'PAID' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

export interface MoneyRequestView {
  id: string;
  /** SENT : j'ai demandé de l'argent ; RECEIVED : on m'en demande. */
  direction: 'SENT' | 'RECEIVED';
  status: MoneyRequestStatus;
  amount: number;
  currency: string;
  note: string | null;
  counterpartId: string;
  counterpartName: string;
  /** Téléphone de l'autre partie (pour régler une demande reçue en un geste). */
  counterpartPhone: string | null;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
  /** Envoi qui a réglé la demande (null tant qu'elle n'est pas réglée). Le montant demandé (`amount`) reste celui de la demande. */
  settlement: MoneyRequestSettlement | null;
}

/** Ce qui a réellement circulé pour régler la demande : peut dépasser le montant demandé. */
export interface MoneyRequestSettlement {
  transactionId: string;
  /** Montant envoyé par le payeur, dans sa devise. */
  sentAmount: number;
  sentCurrency: string;
  /** Montant reçu par le demandeur, dans la devise de la demande. */
  receivedAmount: number;
  receivedCurrency: string;
}

export interface MoneyRequestsOverview {
  received: MoneyRequestView[];
  sent: MoneyRequestView[];
  pendingToPay: number;
}

export interface CreateMoneyRequestInput {
  payerPhone: string;
  amount: number;
  currency: string;
  note?: string;
}

export interface ReferralSettings {
  isActive: boolean;
  /** Envois sans frais offerts au filleul à son inscription. */
  refereeWaivers: number;
  /** Envois sans frais offerts au parrain au premier envoi de son filleul. */
  referrerWaivers: number;
  /** Exprimé dans la devise principale de la société (`minFirstTransferCurrency`) : le montant du premier envoi y est converti avant comparaison. */
  minFirstTransfer: number;
  /** Lecture seule (renvoyée par le serveur) : devise du minimum ci-dessus. */
  minFirstTransferCurrency?: string | null;
  rewardValidityDays: number;
  maxRewardsPerMonth: number;
}

export type ReferralRewardKind = 'REFEREE_WELCOME' | 'REFERRER_BONUS';

export interface MyReferral {
  code: string | null;
  program: { active: boolean; refereeWaivers: number; referrerWaivers: number; validityDays: number; minFirstTransfer: number; minFirstTransferCurrency?: string | null };
  referredCount: number;
  freeTransfersLeft: number;
  nextExpiry: string | null;
  rewards: { id: string; kind: ReferralRewardKind; status: 'AVAILABLE' | 'USED' | 'EXPIRED'; remaining: number; expiresAt: string; createdAt: string }[];
}

export interface ReferralStats {
  config: ReferralSettings;
  referredTotal: number;
  referredMonth: number;
  rewardsGiven: { referee: number; referrer: number };
  rewardsAvailable: number;
  rewardsUsed: number;
  rewardsUsedAtLeastOnce: number;
  topReferrers: { userId: string; name: string; referred: number }[];
}

export function createGrowthApi(http: HttpClient) {
  return {
    quoteRate: (input: QuoteRateLockInput) => http.post<RateLock>('/rate-locks', input),

    moneyRequests: () => http.get<MoneyRequestsOverview>('/money-requests'),
    requestMoney: (input: CreateMoneyRequestInput) => http.post<MoneyRequestView>('/money-requests', input),
    declineRequest: (id: string) => http.patch<{ id: string; status: MoneyRequestStatus }>(`/money-requests/${encodeURIComponent(id)}/decline`, {}),
    cancelRequest: (id: string) => http.patch<{ id: string; status: MoneyRequestStatus }>(`/money-requests/${encodeURIComponent(id)}/cancel`, {}),

    myReferral: () => http.get<MyReferral>('/referrals/me'),

    referralConfig: () => http.get<ReferralSettings>('/referrals-admin/config'),
    saveReferralConfig: (input: Partial<ReferralSettings>) => http.request<ReferralSettings>('/referrals-admin/config', { method: 'PUT', body: input }),
    referralStats: () => http.get<ReferralStats>('/referrals-admin/stats'),
  };
}
