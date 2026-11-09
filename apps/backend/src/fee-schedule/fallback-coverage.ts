// apps/backend/src/fee-schedule/fallback-coverage.ts
// =========================================================
// Quels modes de retrait n'ont AUCUN tarif configuré ? Pour ceux-là, les frais tombent sur le taux de repli de la société
// (company.fees.fallbackFeeRatePct, 1,5 % d'usine) — sans que personne ne l'ait choisi. On le signale à l'administrateur.
//
// Un mode est « couvert » s'il est gratuit, ou s'il existe une règle de barème ACTIVE qui le vise (ou vise tous les modes),
// ou un tarif plat (page « Frais par mode »). Les conditions de pays et de tranche ne sont pas examinées ici : l'avertissement
// porte sur l'absence totale de tarif, pas sur une tranche non couverte (le simulateur de la page sert à les vérifier).
// Fonction pure — voir fallback-coverage.spec.ts.
// =========================================================

export const TAXABLE_PAYOUT_METHODS = ['CASH_PICKUP', 'BANK_DEPOSIT', 'MOBILE_MONEY', 'WALLET', 'IBAN_TRANSFER'] as const;

export interface FallbackNotice {
  /** Taux appliqué quand rien n'est configuré (en %). */
  feeRatePct: number;
  /** Aucune règle de barème active. */
  noActiveRules: boolean;
  /** Modes taxés sans aucun tarif configuré : le taux de repli s'y applique. */
  uncoveredMethods: string[];
}

export function fallbackNotice(input: {
  fallbackFeeRatePct: number;
  freeMethods: string[];
  rules: Array<{ isActive: boolean; payoutMethod: string | null }>;
  flatMethods: Array<string | null>;
}): FallbackNotice {
  const free = new Set(input.freeMethods.map((m) => m.toUpperCase()));
  const active = input.rules.filter((r) => r.isActive);
  const anyMode = active.some((r) => !r.payoutMethod);
  const ruled = new Set(active.filter((r) => r.payoutMethod).map((r) => String(r.payoutMethod).toUpperCase()));
  const flat = new Set(input.flatMethods.filter((m): m is string => !!m).map((m) => m.toUpperCase()));
  const uncoveredMethods = anyMode
    ? []
    : TAXABLE_PAYOUT_METHODS.filter((m) => !free.has(m) && !ruled.has(m) && !flat.has(m));
  return { feeRatePct: input.fallbackFeeRatePct, noActiveRules: active.length === 0, uncoveredMethods: [...uncoveredMethods] };
}
