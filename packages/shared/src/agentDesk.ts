// packages/shared/src/agentDesk.ts
// =========================================================
// GUICHET DE L'AGENT — dépôt, paiement d'un code de retrait, envoi cash, remise.
//
// Contrat relevé dans le backend :
//   GET  /agent-desk/me                    agence, caisse (un portefeuille par devise), opérations du jour  (?since=ISO)
//   GET  /agent-desk/clients/lookup        client wallet de sa société, par téléphone  (?phone=)
//   GET  /agent-desk/send-preview          frais, taux, montant reçu d'un envoi cash  (?amount&receiveCountry)
//   POST /transactions/deposit             { amount, userPhone }  → Transaction
//   POST /withdrawals/agent/check          { code }               → WithdrawalCheck
//   POST /withdrawals/agent/pay            { code, phoneDigits? } → WithdrawalPayResult (phoneDigits : derniers chiffres du
//                                          téléphone du bénéficiaire, exigés si WithdrawalCheck.requiresPhoneCheck)
//   POST /beneficiaries                    { fullName, country, city, phone? } → Beneficiary (propre à l'agent)
//   POST /transactions                     { amount, currency, payoutMethod:'CASH_PICKUP', beneficiaryId, sender* } → Transaction
//   POST /transactions/agency/remit        { amount, note? }      → Transaction (devise = celle de l'agence)
//
// Le code de retrait d'un envoi est la `reference` de la transaction.
// Les montants Decimal des transactions arrivent en chaîne ; ceux de /agent-desk en nombre.
// =========================================================

import type { HttpClient } from './http';
import type { Transaction } from './transactions';
import { IDEMPOTENCY_HEADER, createIdempotencyTracker, withIdempotency } from './idempotency';

// ─── /agent-desk/me ──────────────────────────────────────
export interface DeskAgency {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  primaryCurrency: string;
  isActive: boolean;
  type: string;
}

export interface DeskWallet {
  id: string;
  currency: string;
  balance: number;
  reservedBalance: number;
  availableBalance: number;
  isDefault: boolean;
  isFrozen: boolean;
}

export interface DeskCurrencyTotal {
  currency: string;
  total: number;
}

export interface DeskSummary {
  count: number;
  totals: DeskCurrencyTotal[];
}

export interface DeskToday {
  since: string;
  deposits: DeskSummary;
  sends: DeskSummary & { fees: DeskCurrencyTotal[] };
  payouts: DeskSummary;
  remittances: DeskSummary;
}

export interface AgentDesk {
  agent: { id: string; firstName: string | null; lastName: string | null };
  /** null : l'agent n'est rattaché à aucune agence (ou son agence est introuvable). */
  agency: DeskAgency | null;
  wallets: DeskWallet[];
  today: DeskToday | null;
}

// ─── /agent-desk/clients/lookup ──────────────────────────
export interface DeskClient {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  country?: string | null;
  /** Faux : compte désactivé ou suspendu, le dépôt serait refusé. */
  canReceive: boolean;
}

// ─── /agent-desk/send-preview ────────────────────────────
export interface SendPreview {
  amount: number;
  currency: string;
  fees: number;
  total: number;
  feeRatePct?: number | null;
  /** D'où vient le tarif : mode gratuit, règle du barème, tarif du mode de retrait ou 1,5 %. */
  feeSource?: string | null;
  rule?: unknown;
  targetCurrency: string;
  exchangeRate: number;
  receivedAmount: number;
  available: number;
  /** Faux : la caisse ne couvre pas montant + frais. */
  enough: boolean;
  /** Vrai : l'envoi attendra la validation d'un administrateur avant de pouvoir être payé. */
  needsValidation: boolean;
  validationThreshold: number;
}

// ─── Retrait ─────────────────────────────────────────────
export interface WithdrawalCheck {
  valid: boolean;
  amount: string | number;
  currency: string;
  receivedAmount?: string | number | null;
  targetCurrency?: string | null;
  senderName: string;
  beneficiary?: { fullName?: string | null; country?: string | null; city?: string | null; phone?: string | null } | null;
  transactionId: string;
  status: string;
  originCountry?: string;
  reference: string;
  /** La société exige les derniers chiffres du téléphone du bénéficiaire pour payer (réglage « Codes de retrait »). */
  requiresPhoneCheck?: boolean;
  /** Nombre de chiffres à saisir quand requiresPhoneCheck est vrai. */
  phoneCheckDigits?: number | null;
}

export interface WithdrawalPayResult {
  success: boolean;
  message: string;
  currency: string;
  /** Montant remis en espèces au bénéficiaire. */
  amountPaid: number;
  feesConverted?: number;
  commissions?: {
    payerAgency?: { amount: number; share: number };
    senderAgency?: { amount: number; share: number };
    companyAdmin?: { amount: number; share: number };
  };
}

// ─── Envoi cash ──────────────────────────────────────────
export interface NewBeneficiary {
  fullName: string;
  country: string;
  city: string;
  phone?: string;
}

export interface Beneficiary extends NewBeneficiary {
  id: string;
}

export type CounterIdType = 'NATIONAL_ID' | 'PASSPORT' | 'DRIVER_LICENSE' | 'RESIDENCE_PERMIT';

export const COUNTER_ID_TYPES: readonly { value: CounterIdType; label: string }[] = [
  { value: 'NATIONAL_ID', label: "Carte nationale d'identité" },
  { value: 'PASSPORT', label: 'Passeport' },
  { value: 'DRIVER_LICENSE', label: 'Permis de conduire' },
  { value: 'RESIDENCE_PERMIT', label: 'Titre de séjour' },
];

/** Codes d'erreur propres à l'envoi au comptoir (champ `code` de la réponse). */
export const COUNTER_ERROR_CODES = ['COUNTER_ID_REQUIRED', 'COUNTER_ID_PHOTO_REQUIRED', 'COUNTER_ID_PHOTO_INVALID', 'COUNTER_ID_MISMATCH', 'COUNTER_LIMIT_EXCEEDED'] as const;

export interface CashSendInput {
  amount: number;
  currency: string;
  beneficiaryId: string;
  /**
   * Le client de passage qui remet l'argent au guichet. Depuis le lot 7 le serveur EXIGE son identité : prénom, nom,
   * téléphone, date de naissance (18 ans révolus) et références d'une pièce en cours de validité. Sans quoi : 400
   * COUNTER_ID_REQUIRED. La même pièce déclarée avec un autre nom/une autre date de naissance : 403 COUNTER_ID_MISMATCH.
   * Plafonds cumulés par personne : 403 COUNTER_LIMIT_EXCEEDED.
   */
  senderFirstName?: string;
  senderLastName?: string;
  senderPhone?: string;
  /** AAAA-MM-JJ */
  senderBirthDate?: string;
  senderIdType?: CounterIdType;
  senderIdNumber?: string;
  /** AAAA-MM-JJ */
  senderIdExpiry?: string;
  senderIdCountry?: string;
  /**
   * Lot 8 — photo de la pièce (data-URL ou base64, JPEG/PNG/WEBP, 6 Mo au plus). Obligatoire au 1er envoi de cette personne (et si
   * la pièce a été renouvelée) ; le verso l'est pour une carte d'identité, un permis ou un titre de séjour. Sans quoi : 400
   * COUNTER_ID_PHOTO_REQUIRED. Les envois suivants avec la même pièce n'ont plus à la rephotographier.
   */
  senderIdFront?: string;
  senderIdBack?: string;
  note?: string;
}

export function createAgentDeskApi(http: HttpClient) {
  // ✅ audit point 3 : un double-tap ou un nouvel essai après coupure ne crée pas un second débit (voir idempotency.ts).
  const tracker = createIdempotencyTracker();
  // La clé d'idempotence ne retient que l'empreinte (taille + extrémités) des photos : pas 16 Mo de base64 gardés en mémoire.
  const fingerprint = (v: unknown): unknown =>
    typeof v === 'string' && v.length > 256 ? `#${v.length}:${v.slice(0, 48)}:${v.slice(-48)}` : v;
  const postOnce = <T>(path: string, body: object) =>
    withIdempotency(tracker, `${path}|${JSON.stringify(body, (_k, v) => fingerprint(v))}`, (key) =>
      http.post<T>(path, body, { headers: { [IDEMPOTENCY_HEADER]: key } }));

  const enc = encodeURIComponent;
  return {
    me: (since?: string) => http.get<AgentDesk>(`/agent-desk/me${since ? `?since=${enc(since)}` : ''}`),

    lookupClient: (phone: string) =>
      http.get<{ client: DeskClient | null }>(`/agent-desk/clients/lookup?phone=${enc(phone)}`),

    sendPreview: (amount: number, receiveCountry: string) =>
      http.get<SendPreview>(`/agent-desk/send-preview?amount=${enc(String(amount))}&receiveCountry=${enc(receiveCountry)}`),

    deposit: (input: { amount: number; userPhone: string }) => postOnce<Transaction>('/transactions/deposit', input),

    checkWithdrawal: (code: string) => http.post<WithdrawalCheck>('/withdrawals/agent/check', { code }),

    payWithdrawal: (code: string, phoneDigits?: string) =>
      http.post<WithdrawalPayResult>('/withdrawals/agent/pay', phoneDigits ? { code, phoneDigits } : { code }),

    createBeneficiary: (input: NewBeneficiary) => http.post<Beneficiary>('/beneficiaries', input),

    sendCash: (input: CashSendInput) =>
      postOnce<Transaction>('/transactions', { ...input, payoutMethod: 'CASH_PICKUP' }),

    remit: (input: { amount: number; note?: string }) => postOnce<Transaction>('/transactions/agency/remit', input),
  };
}
