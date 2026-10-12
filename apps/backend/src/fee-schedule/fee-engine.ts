// apps/backend/src/fee-schedule/fee-engine.ts
// =========================================================
// Moteur du barème de frais — fonctions pures (aucun accès base ni réseau), testables seules.
//
// Choix de la règle : parmi les règles actives de la société dont tous les critères renseignés
// correspondent à l'envoi (mode de retrait, pays d'envoi, pays de réception) ET dont la tranche
// contient le montant, on garde la plus spécifique. Poids : pays de réception 4, pays d'envoi 2,
// mode de retrait 1 — un corridor précis l'emporte donc sur un tarif de pays d'envoi, qui l'emporte
// sur un tarif par mode. À poids égal, la règle modifiée en dernier gagne.
//
// Frais = montant × taux % + frais fixe converti dans la devise de l'envoi, arrondi à l'unité de la
// devise (0 décimale pour XOF et GNF, 2 pour les autres), à l'unité supérieure la plus proche en cas
// d'égalité (arrondi commercial).
// =========================================================

export interface FeeRuleLike {
  id: string;
  label: string | null;
  payoutMethod: string | null;
  sendCountry: string | null;
  receiveCountry: string | null;
  currency: string;
  minAmount: number;
  maxAmount: number | null;
  feeRate: number;
  fixedFee: number;
  updatedAt: Date;
}

export interface FeeContext {
  payoutMethod: string;
  sendCountry: string | null;
  receiveCountry: string | null;
}

export type Convert = (amount: number, from: string, to: string) => Promise<number>;

export const ZERO_DECIMAL_CURRENCIES: readonly string[] = ['XOF', 'GNF'];

export function roundToCurrency(value: number, currency: string): number {
  const digits = ZERO_DECIMAL_CURRENCIES.includes(currency) ? 0 : 2;
  const factor = 10 ** digits;
  // + Number.EPSILON : 1.005 doit donner 1.01, pas 1.00.
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function specificity(rule: Pick<FeeRuleLike, 'payoutMethod' | 'sendCountry' | 'receiveCountry'>): number {
  return (rule.receiveCountry ? 4 : 0) + (rule.sendCountry ? 2 : 0) + (rule.payoutMethod ? 1 : 0);
}

/** Les critères renseignés de la règle correspondent à l'envoi ; un critère à null correspond à tout. */
export function criteriaMatch(rule: FeeRuleLike, ctx: FeeContext): boolean {
  if (rule.payoutMethod && rule.payoutMethod !== ctx.payoutMethod) return false;
  if (rule.sendCountry && rule.sendCountry !== ctx.sendCountry) return false;
  if (rule.receiveCountry && rule.receiveCountry !== ctx.receiveCountry) return false;
  return true;
}

/** La tranche est [min ; max[ : le montant égal à la borne haute passe à la tranche suivante. */
export function inRange(rule: Pick<FeeRuleLike, 'minAmount' | 'maxAmount'>, amount: number): boolean {
  return amount >= rule.minAmount && (rule.maxAmount === null || amount < rule.maxAmount);
}

/** Deux tranches [min ; max[ de même devise se chevauchent. */
export function rangesOverlap(
  a: Pick<FeeRuleLike, 'minAmount' | 'maxAmount'>,
  b: Pick<FeeRuleLike, 'minAmount' | 'maxAmount'>,
): boolean {
  const aEndsBeforeB = a.maxAmount !== null && a.maxAmount <= b.minAmount;
  const bEndsBeforeA = b.maxAmount !== null && b.maxAmount <= a.minAmount;
  return !aEndsBeforeB && !bEndsBeforeA;
}

export async function pickRule(
  rules: readonly FeeRuleLike[],
  ctx: FeeContext,
  amount: number,
  sendCurrency: string,
  convert: Convert,
): Promise<FeeRuleLike | null> {
  const candidates = rules.filter((r) => criteriaMatch(r, ctx));
  const hits: FeeRuleLike[] = [];
  for (const rule of candidates) {
    // Une devise sans taux de change disponible ne doit pas bloquer l'envoi : la règle est ignorée.
    let inRuleCurrency: number;
    try {
      inRuleCurrency = await convert(amount, sendCurrency, rule.currency);
    } catch {
      continue;
    }
    if (inRange(rule, inRuleCurrency)) hits.push(rule);
  }
  hits.sort((a, b) => specificity(b) - specificity(a) || b.updatedAt.getTime() - a.updatedAt.getTime());
  return hits[0] ?? null;
}

export interface RuleFee {
  fees: number;
  feeRatePct: number;
  /** Frais fixe converti dans la devise de l'envoi (arrondi). */
  fixedFee: number;
  fixedFeeOriginal: { amount: number; currency: string } | null;
}

export async function feeFromRule(
  rule: FeeRuleLike,
  amount: number,
  sendCurrency: string,
  convert: Convert,
): Promise<RuleFee> {
  let fixed = 0;
  if (rule.fixedFee > 0) {
    fixed = await convert(rule.fixedFee, rule.currency, sendCurrency);
  }
  const fixedRounded = roundToCurrency(fixed, sendCurrency);
  const fees = roundToCurrency((amount * rule.feeRate) / 100 + fixed, sendCurrency);
  return {
    fees,
    feeRatePct: rule.feeRate,
    fixedFee: fixedRounded,
    fixedFeeOriginal: rule.fixedFee > 0 ? { amount: rule.fixedFee, currency: rule.currency } : null,
  };
}
