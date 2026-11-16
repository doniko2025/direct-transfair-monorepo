// packages/shared/src/companySettings.ts
// =========================================================
// PARAMÈTRES D'UNE SOCIÉTÉ — tout ce que l'administrateur de la société règle lui-même (rien n'est codé en dur).
//
// Contrat : apps/backend/src/company-settings/
//   GET    /company-settings            { company, editable, settings, defaults, overridden, options, updatedAt }
//   GET    /company-settings/history    { data: CompanySettingsChange[] }
//   PATCH  /company-settings            modification partielle { fees?, commissions?, pickup?, alerts? } → même vue
//   DELETE /company-settings            retour à tous les défauts → même vue
// Lecture : COMPANY_ADMIN et SUPER_ADMIN (?clientId). Écriture : COMPANY_ADMIN uniquement.
// =========================================================

import type { HttpClient } from './http';

export interface CompanySplitSettings {
  payerShare: number;
  senderShare: number;
  platformShare: number;
}

export interface CompanySettings {
  fees: {
    /** Modes d'envoi sans frais. Par défaut : uniquement WALLET (wallet → wallet). */
    freeMethods: string[];
    fallbackFeeRatePct: number;
  };
  commissions: { defaultSplit: CompanySplitSettings };
  pickup: {
    validityMonths: number;
    maxFailedChecks: number;
    lockMinutes: number;
    requireBeneficiaryPhoneCheck: boolean;
    phoneCheckDigits: number;
  };
  alerts: { lowBalance: Record<string, number> };
  /** Moyens de recharge du wallet ouverts aux clients (CARD, ORANGE_MONEY, SENDWAVE). Liste vide = recharge fermée. */
  recharge: { enabledMethods: string[] };
  /** Comptes marchands : encaissements par téléphone / QR code et retraits. */
  merchant: CompanyMerchantSettings;
  /** Remboursements et rappels d'envois. */
  refunds: CompanyRefundSettings;
  /** Paiement de factures (électricité, eau, assurance, scolarité, loyer…). */
  bills: CompanyBillSettings;
}

export interface CompanyBillSettings {
  /** Paiement de factures ouvert aux clients de la société (fermé par défaut). */
  enabled: boolean;
  /** Facture non réglée : les frais payés par le client lui sont rendus avec le montant. */
  refundFeeOnFailure: boolean;
  /** Par devise du facturier : plus grosse facture payable en une fois. */
  maxPerPayment: Record<string, number>;
  /** Par devise du facturier : total payable par un même client sur 24 h glissantes. */
  maxPerDay: Record<string, number>;
  /** Factures récurrentes et rappels d'échéance. */
  recurring: CompanyBillRecurringSettings;
}

export interface CompanyBillRecurringSettings {
  /** Le client peut programmer des factures récurrentes. */
  enabled: boolean;
  /** Prélèvement automatique autorisé (fermé par défaut). */
  autoDebitEnabled: boolean;
  /** Nombre maximum de factures programmées actives par client. */
  maxPerClient: number;
  /** Rappel envoyé N jours avant l'échéance. */
  remindDaysBefore: number;
  /** Échecs consécutifs avant mise en pause. */
  maxFailures: number;
}

export interface CompanyRefundSettings {
  /** Remboursement d'un paiement marchand : la commission d'encaissement est rendue au marchand (prélevée sur le wallet de la société). */
  returnMerchantCommission: boolean;
  /** Rappel d'un envoi wallet → wallet : les frais sont rendus à l'expéditeur. */
  returnFeesOnRecall: boolean;
  /** Délai (jours) pendant lequel un envoi wallet → wallet déjà crédité peut être rappelé. 0 = rappel fermé. */
  recallWindowDays: number;
}

export interface CompanyMerchantSettings {
  enabled: boolean;
  /** Commission (%) retenue sur chaque encaissement, à la charge du marchand. */
  paymentFeePct: number;
  qrValidityMinutes: number;
  phoneRequestValidityMinutes: number;
  /** Commission (%) retenue sur chaque retrait. */
  payoutFeePct: number;
  /** ORANGE_MONEY, BANK_TRANSFER. */
  payoutMethods: string[];
  /** MANUAL : l'administrateur confirme chaque retrait. SANDBOX : essai uniquement (refusé en production). */
  payoutMode: string;
  payoutCooldownHours: number;
  minPayment: Record<string, number>;
  maxPayment: Record<string, number>;
  minPayout: Record<string, number>;
}

export interface CompanySettingsPatch {
  fees?: { freeMethods?: string[]; fallbackFeeRatePct?: number };
  commissions?: { defaultSplit?: { payerShare: number; senderShare: number } };
  pickup?: Partial<CompanySettings['pickup']>;
  /** `null` retire la surcharge de la devise (retour au défaut). */
  alerts?: { lowBalance?: Record<string, number | null> };
  recharge?: { enabledMethods?: string[] };
  merchant?: {
    enabled?: boolean;
    paymentFeePct?: number;
    qrValidityMinutes?: number;
    phoneRequestValidityMinutes?: number;
    payoutFeePct?: number;
    payoutMethods?: string[];
    payoutMode?: string;
    payoutCooldownHours?: number;
    /** `null` retire la surcharge de la devise (retour au défaut). */
    minPayment?: Record<string, number | null>;
    maxPayment?: Record<string, number | null>;
    minPayout?: Record<string, number | null>;
  };
  refunds?: Partial<CompanyRefundSettings>;
  bills?: {
    enabled?: boolean;
    refundFeeOnFailure?: boolean;
    /** `null` retire la surcharge de la devise (retour au défaut). */
    maxPerPayment?: Record<string, number | null>;
    maxPerDay?: Record<string, number | null>;
    recurring?: Partial<CompanyBillRecurringSettings>;
  };
}

export interface CompanySettingsView {
  company: { id: number; name: string; code: string };
  editable: boolean;
  /** Valeurs réellement appliquées (défauts + surcharges). */
  settings: CompanySettings;
  defaults: CompanySettings;
  /** Ce que la société a modifié. */
  overridden: CompanySettingsPatch;
  updatedAt: string | null;
  options: {
    feeMethods: { key: string; label: string }[];
    rechargeMethods: { key: string; label: string }[];
    currencies: string[];
    limits: Record<string, { min: number; max: number }>;
  };
}

export interface CompanySettingsChange {
  id: string;
  createdAt: string;
  from: CompanySettings | null;
  to: CompanySettings | null;
  user: string | null;
}

export function createCompanySettingsApi(http: HttpClient) {
  return {
    get: (clientId?: number) => http.get<CompanySettingsView>(`/company-settings${clientId ? `?clientId=${clientId}` : ''}`),

    history: (clientId?: number, limit = 20) =>
      http.get<{ data: CompanySettingsChange[] }>(`/company-settings/history?limit=${limit}${clientId ? `&clientId=${clientId}` : ''}`),

    update: (patch: CompanySettingsPatch) => http.patch<CompanySettingsView>('/company-settings', patch),

    reset: () => http.delete<CompanySettingsView>('/company-settings'),
  };
}
