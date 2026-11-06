// apps/backend/src/fees-admin/fee-rules.ts
// =========================================================
// ✅ phase 7 : PLATFORM_CODE (constante « DONIKO ») remplacé par getPlatformCode(), qui lit la configuration plateforme.
// Règles des frais d'envoi (par société et par mode de retrait).
//
// Ce qui est réellement appliqué par FeeScheduleService.quote() (appelé par transactions.service.ts :: create) :
//   - mode listé dans « Modes gratuits » des paramètres de la société (company-settings, par défaut : WALLET seul, c'est-à-dire
//     wallet → wallet) : AUCUN frais, quoi qu'une configuration enregistrée dise ;
//   - tous les autres : frais = montant × taux % + frais fixe (règle du barème, sinon tarif plat du mode, sinon taux de repli
//     des paramètres de la société — 1,5 % tant que l'administrateur n'a rien réglé).
//
// Le frais fixe d'un tarif plat est exprimé dans la devise par défaut de la société et converti dans la devise de l'envoi.
// =========================================================

import { platform } from '../common/platform.config';

export type FeeMethodKey = 'CASH_PICKUP' | 'BANK_DEPOSIT' | 'IBAN_TRANSFER' | 'MOBILE_MONEY' | 'WALLET';

export interface FeeMethodDef {
  key: FeeMethodKey;
  label: string;
}

export const FEE_METHODS: readonly FeeMethodDef[] = [
  { key: 'CASH_PICKUP', label: 'Retrait cash' },
  { key: 'BANK_DEPOSIT', label: 'Virement bancaire' },
  { key: 'IBAN_TRANSFER', label: 'Virement IBAN (Europe)' },
  { key: 'MOBILE_MONEY', label: 'Mobile Money' },
  { key: 'WALLET', label: 'Wallet vers wallet' },
];

export const FEE_METHOD_KEYS: readonly string[] = FEE_METHODS.map((m) => m.key);

/** Taux de repli par défaut (modifiable par l'administrateur de la société : paramètres, fees.fallbackFeeRatePct). */
export const DEFAULT_FEE_RATE = 1.5;

/** Au-delà, c'est presque sûrement une erreur de saisie (25 % de frais sur un envoi d'argent). */
export const MAX_FEE_RATE = 25;
export const MAX_FIXED_FEE = 10_000_000;

/**
 * Code de la société système (plateforme) : elle n'envoie pas d'argent, elle n'a pas de frais.
 * ✅ phase 7 : lu dans la configuration (PLATFORM_TENANT_CODE) à chaque appel, plus écrit en dur.
 */
export const getPlatformCode = (): string => platform.code;

/** Vrai si le nombre a au plus deux décimales. */
export const hasAtMostTwoDecimals = (n: number): boolean => Math.round(n * 100) / 100 === n;
