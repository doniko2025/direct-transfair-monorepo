// apps/backend/src/fees-admin/fee-rules.ts
// =========================================================
// Règles des frais d'envoi (par société et par mode de retrait).
//
// Ce qui est réellement appliqué par transactions.service.ts (create) :
//   - CASH_PICKUP, BANK_DEPOSIT, IBAN_TRANSFER : frais = montant × taux % + frais fixe.
//     Sans configuration, le taux par défaut est 1,5 % et le frais fixe 0.
//   - MOBILE_MONEY et WALLET : AUCUN frais (isWalletTransfer), quoi qu'une configuration enregistrée dise.
//
// Le frais fixe est ajouté tel quel, dans la devise de l'envoi (le code ne le convertit pas).
// =========================================================

export type FeeMethodKey = 'CASH_PICKUP' | 'BANK_DEPOSIT' | 'IBAN_TRANSFER' | 'MOBILE_MONEY' | 'WALLET';

export interface FeeMethodDef {
  key: FeeMethodKey;
  label: string;
  /** Faux : le serveur ne prélève jamais de frais sur ce mode. */
  charged: boolean;
}

export const FEE_METHODS: readonly FeeMethodDef[] = [
  { key: 'CASH_PICKUP', label: 'Retrait cash', charged: true },
  { key: 'BANK_DEPOSIT', label: 'Virement bancaire', charged: true },
  { key: 'IBAN_TRANSFER', label: 'Virement IBAN (Europe)', charged: true },
  { key: 'MOBILE_MONEY', label: 'Mobile Money', charged: false },
  { key: 'WALLET', label: 'Wallet vers wallet', charged: false },
];

export const FEE_METHOD_KEYS: readonly string[] = FEE_METHODS.map((m) => m.key);

/** Modes sur lesquels le serveur prélève des frais : les seuls qu'un barème peut viser. */
export const CHARGED_METHOD_KEYS: readonly string[] = FEE_METHODS.filter((m) => m.charged).map((m) => m.key);

/** Taux appliqué par transactions.service.ts tant que la société n'a rien configuré. */
export const DEFAULT_FEE_RATE = 1.5;

/** Au-delà, c'est presque sûrement une erreur de saisie (25 % de frais sur un envoi d'argent). */
export const MAX_FEE_RATE = 25;
export const MAX_FIXED_FEE = 10_000_000;

/** Code de la société système (plateforme) : elle n'envoie pas d'argent, elle n'a pas de frais. */
export const PLATFORM_CODE = 'DONIKO';

/** Vrai si le nombre a au plus deux décimales. */
export const hasAtMostTwoDecimals = (n: number): boolean => Math.round(n * 100) / 100 === n;
