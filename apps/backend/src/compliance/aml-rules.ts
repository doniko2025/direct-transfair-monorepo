// apps/backend/src/compliance/aml-rules.ts
// =========================================================
// RÈGLES AML ÉTENDUES (lot 17) — fonctions pures.
// Elles COMPLÈTENT le score de base (transactions/aml-scoring.ts) avec des critères réglables par société :
//   • pays à risque          : envoi vers un pays de la liste de la société → +25
//   • fractionnement         : N envois ou plus « juste sous le seuil » en 24 h → +25
//   • regroupement de fonds  : N expéditeurs différents vers le même bénéficiaire en 24 h → +25
// Chaque critère explique sa raison : la conformité voit POURQUOI une opération est signalée.
// =========================================================

export interface AmlSettingsLike {
  amlThresholdXof: number | null;
  amlFlagScore: number | null;
  highRiskCountries: string[];
  structuringCount: number;
  fanInSenders: number;
}

export interface ExtraRulesInput {
  /** Pays (ISO-2 ou nom) du bénéficiaire. */
  destinationCountry?: string | null;
  /** Montant en XOF ; null = conversion impossible (rien n'est deviné). */
  amountXof: number | null;
  threshold: number;
  /** Envois de la même personne en 24 h compris entre 80 % et 100 % du seuil, sans compter celui-ci. */
  nearThresholdCount24h: number;
  /** Expéditeurs distincts (autres que celui-ci) ayant envoyé au même bénéficiaire en 24 h. */
  otherSendersToRecipient24h: number;
}

export interface ExtraRulesResult {
  points: number;
  reasons: string[];
  rules: string[];
}

export const NEAR_THRESHOLD_RATIO = 0.8;

export function normalizeCountry(raw: string | null | undefined): string {
  return String(raw ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
}

export function evaluateExtraRules(settings: AmlSettingsLike, input: ExtraRulesInput): ExtraRulesResult {
  const reasons: string[] = [];
  const rules: string[] = [];
  let points = 0;

  const country = normalizeCountry(input.destinationCountry);
  if (country && settings.highRiskCountries.some((c) => normalizeCountry(c) === country)) {
    points += 25; rules.push('HIGH_RISK_COUNTRY'); reasons.push(`Envoi vers un pays à risque (${country})`);
  }

  // Le présent envoi compte s'il est lui-même juste sous le seuil.
  if (input.amountXof !== null) {
    const near = input.amountXof < input.threshold && input.amountXof >= input.threshold * NEAR_THRESHOLD_RATIO ? 1 : 0;
    const total = input.nearThresholdCount24h + near;
    if (settings.structuringCount >= 2 && near === 1 && total >= settings.structuringCount) {
      points += 25; rules.push('STRUCTURING'); reasons.push(`${total} envois juste sous le seuil en 24 h (fractionnement probable)`);
    }
  }

  const senders = input.otherSendersToRecipient24h + 1;
  if (settings.fanInSenders >= 2 && senders >= settings.fanInSenders) {
    points += 25; rules.push('FAN_IN'); reasons.push(`${senders} expéditeurs différents vers un même bénéficiaire en 24 h`);
  }

  return { points, reasons, rules };
}
