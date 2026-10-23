// apps/backend/src/transactions/aml-scoring.ts
// =========================================================
// SCORING AML v1.0 — Direct Transf'air (non bloquant)
//
// Transaction.riskScore / isFlagged existaient mais restaient à 0 / false : rien ne les calculait. Ce scoring est
// volontairement SIMPLE, EXPLICABLE et NON BLOQUANT : il n'empêche jamais un envoi, il lève un signalement (AmlFlag) que
// la conformité examine. Un blocage automatique est une décision métier (faux positifs) : non activé.
//
// Critères (cumulés, plafonnés à 100) :
//   - montant élevé          : ≥ seuil → +40 ; ≥ la moitié du seuil → +20
//   - fractionnement         : montant juste sous le seuil (80 %–99 %) → +15
//   - vitesse (24 h)         : ≥ 5 envois → +20
//   - cumul (24 h)           : cumul ≥ 2 × seuil → +20
//   - compte récent          : créé il y a moins de 7 jours → +15
// Seuil : AML_THRESHOLD_XOF (défaut 2 000 000 XOF). Signalement à partir de AML_FLAG_SCORE (défaut 60).
// Les montants sont ramenés en XOF avec des taux APPROXIMATIFS (suffisants pour un seuil, pas pour un calcul comptable).
// =========================================================

/** Taux approximatifs vers XOF — uniquement pour comparer à un seuil. */
const APPROX_TO_XOF: Record<string, number> = {
  XOF: 1, EUR: 655.957, USD: 600, GBP: 760, GNF: 0.07,
};

export function approxXof(amount: number, currency: string): number {
  return amount * (APPROX_TO_XOF[currency.toUpperCase()] ?? 1);
}

export function amlThresholdXof(): number {
  const raw = Number(process.env.AML_THRESHOLD_XOF);
  return Number.isFinite(raw) && raw > 0 ? raw : 2_000_000;
}

export function amlFlagScore(): number {
  const raw = Number(process.env.AML_FLAG_SCORE);
  return Number.isInteger(raw) && raw >= 1 && raw <= 100 ? raw : 60;
}

export interface AmlInput {
  amount: number;
  currency: string;
  /** Envois du même expéditeur sur les dernières 24 h, sans compter celui-ci. */
  recentCount24h: number;
  /** Cumul approximatif en XOF de ces envois, sans compter celui-ci. */
  recentSumXof24h: number;
  accountCreatedAt?: Date | null;
  now?: Date;
}

export interface AmlResult {
  score: number;
  flagged: boolean;
  reasons: string[];
}

export function computeRiskScore(input: AmlInput): AmlResult {
  const threshold = amlThresholdXof();
  const amountXof = approxXof(input.amount, input.currency);
  const reasons: string[] = [];
  let score = 0;

  if (amountXof >= threshold) {
    score += 40; reasons.push(`Montant élevé (≈ ${Math.round(amountXof).toLocaleString('fr-FR')} XOF)`);
  } else if (amountXof >= threshold / 2) {
    score += 20; reasons.push('Montant important');
  }
  if (amountXof < threshold && amountXof >= threshold * 0.8) {
    score += 15; reasons.push('Montant juste sous le seuil de contrôle (fractionnement possible)');
  }
  if (input.recentCount24h >= 5) {
    score += 20; reasons.push(`${input.recentCount24h + 1} envois en 24 h`);
  }
  if (input.recentSumXof24h + amountXof >= threshold * 2) {
    score += 20; reasons.push('Cumul sur 24 h élevé');
  }
  if (input.accountCreatedAt) {
    const ageMs = (input.now ?? new Date()).getTime() - input.accountCreatedAt.getTime();
    if (ageMs < 7 * 86_400_000) { score += 15; reasons.push('Compte créé il y a moins de 7 jours'); }
  }

  score = Math.min(100, score);
  return { score, flagged: score >= amlFlagScore(), reasons };
}
