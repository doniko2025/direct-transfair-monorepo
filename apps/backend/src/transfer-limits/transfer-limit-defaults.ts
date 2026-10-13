// apps/backend/src/transfer-limits/transfer-limit-defaults.ts
// =========================================================
// Plafonds d'envoi par défaut — appliqués tant que l'admin de la société n'a rien réglé pour
// (niveau KYC, devise). Fonctions pures, sans accès à la base.
//
// Base en euros (par envoi / par jour / par mois / par an), mise à l'échelle par devise :
//   EUR, USD, GBP : même chiffres · XOF : × 650 (1 € ≈ 656 XOF) · GNF : × 10 000
// =========================================================

export const KYC_LEVELS = ['LEVEL_0', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3'] as const;
export type KycLevelName = (typeof KYC_LEVELS)[number];

export interface Limits {
  /** Montant maximal d'un seul envoi. null = pas de plafond. */
  perTransaction: number | null;
  daily: number | null;
  monthly: number | null;
  yearly: number | null;
}

export const LIMIT_KEYS = ['perTransaction', 'daily', 'monthly', 'yearly'] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];

const BASE_EUR: Record<KycLevelName, Limits> = {
  LEVEL_0: { perTransaction: 100, daily: 200, monthly: 500, yearly: 2_000 },
  LEVEL_1: { perTransaction: 500, daily: 1_000, monthly: 3_000, yearly: 15_000 },
  LEVEL_2: { perTransaction: 2_000, daily: 3_000, monthly: 10_000, yearly: 60_000 },
  LEVEL_3: { perTransaction: 5_000, daily: 10_000, monthly: 30_000, yearly: 200_000 },
};

const SCALE: Record<string, number> = { EUR: 1, USD: 1, GBP: 1, XOF: 650, GNF: 10_000 };

export function isKycLevel(v: string): v is KycLevelName {
  return (KYC_LEVELS as readonly string[]).includes(v);
}

export function defaultLimits(level: KycLevelName, currency: string): Limits {
  const base = BASE_EUR[level];
  const k = SCALE[currency] ?? 1;
  return {
    perTransaction: base.perTransaction === null ? null : base.perTransaction * k,
    daily: base.daily === null ? null : base.daily * k,
    monthly: base.monthly === null ? null : base.monthly * k,
    yearly: base.yearly === null ? null : base.yearly * k,
  };
}

export interface Usage {
  daily: number;
  monthly: number;
  yearly: number;
}

export interface Breach {
  limit: LimitKey;
  max: number;
  /** Déjà envoyé sur la période (0 pour le plafond par envoi). */
  used: number;
  /** Ce qu'il reste à envoyer avant d'atteindre le plafond. */
  remaining: number;
}

const PERIOD_LABEL: Record<LimitKey, string> = {
  perTransaction: 'par envoi',
  daily: 'journalier',
  monthly: 'mensuel',
  yearly: 'annuel',
};

export function periodLabel(k: LimitKey): string {
  return PERIOD_LABEL[k];
}

/**
 * Premier plafond dépassé par un envoi de `amount`, ou null si l'envoi passe.
 * Ordre : par envoi, jour, mois, an. Un plafond null n'est pas contrôlé.
 */
export function evaluateLimits(limits: Limits, usage: Usage, amount: number): Breach | null {
  if (limits.perTransaction !== null && amount > limits.perTransaction) {
    return { limit: 'perTransaction', max: limits.perTransaction, used: 0, remaining: limits.perTransaction };
  }
  for (const k of ['daily', 'monthly', 'yearly'] as const) {
    const max = limits[k];
    if (max === null) continue;
    const used = usage[k];
    if (used + amount > max) return { limit: k, max, used, remaining: Math.max(0, Math.round((max - used) * 100) / 100) };
  }
  return null;
}

/** Les plafonds renseignés doivent croître : par envoi ≤ jour ≤ mois ≤ an. Renvoie le message d'erreur, ou null. */
export function checkLimitOrder(limits: Limits): string | null {
  const chain: [LimitKey, number][] = [];
  for (const k of LIMIT_KEYS) {
    const v = limits[k];
    if (v !== null) chain.push([k, v]);
  }
  for (let i = 1; i < chain.length; i++) {
    if (chain[i][1] < chain[i - 1][1]) {
      return `Le plafond ${periodLabel(chain[i][0])} ne peut pas être inférieur au plafond ${periodLabel(chain[i - 1][0])}.`;
    }
  }
  return null;
}

export const equalLimits = (a: Limits, b: Limits): boolean => LIMIT_KEYS.every((k) => a[k] === b[k]);
