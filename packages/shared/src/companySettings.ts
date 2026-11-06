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
}

export interface CompanySettingsPatch {
  fees?: { freeMethods?: string[]; fallbackFeeRatePct?: number };
  commissions?: { defaultSplit?: { payerShare: number; senderShare: number } };
  pickup?: Partial<CompanySettings['pickup']>;
  /** `null` retire la surcharge de la devise (retour au défaut). */
  alerts?: { lowBalance?: Record<string, number | null> };
  recharge?: { enabledMethods?: string[] };
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
