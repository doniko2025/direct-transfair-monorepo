// apps/direct-transfair-mobile/utils/amount.ts
// =========================================================
// MONTANTS — saisie, arrondi et affichage — v1.0
//
// POURQUOI CE FICHIER
//   L'écran d'envoi arrondissait chaque conversion à l'entier : 5 000 XOF → « 8 EUR » (au lieu de 7,63), et le champ
//   « vous envoyez » ne pouvait pas porter de centimes. Règles désormais appliquées :
//   • une devise à décimales (EUR, USD…) garde 2 chiffres après la virgule, en saisie comme en conversion ;
//   • XOF et GNF n'ont pas de décimales (le serveur arrondit le montant reçu à l'unité : voir roundToCurrency côté
//     backend) → on affiche exactement ce qui sera crédité ;
//   • saisie « à la réception » : le montant à envoyer est arrondi au centime SUPÉRIEUR, pour que le bénéficiaire reçoive
//     au moins le montant demandé (jamais 1 centime de moins à cause d'un arrondi).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

/** Même liste que le backend (fee-engine.ts : ZERO_DECIMAL_CURRENCIES). */
const ZERO_DECIMAL = ["XOF", "GNF"];

export const decimalsFor = (currency?: string | null): number =>
  currency && ZERO_DECIMAL.includes(currency) ? 0 : 2;

/** Texte saisi (« 7,63 », « 1 500.5 ») → nombre ; 0 si invalide. */
export function parseAmount(text: string): number {
  const n = parseFloat((text ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Arrondi à `d` décimales (au plus proche, comme le serveur). */
export function roundTo(value: number, d: number): number {
  const f = 10 ** d;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Arrondi à `d` décimales vers le HAUT (tolérance d'1e-9 : 7,6 reste 7,6 malgré les erreurs de virgule flottante). */
export function ceilTo(value: number, d: number): number {
  const f = 10 ** d;
  return Math.ceil(value * f - 1e-9) / f;
}

/**
 * Nettoie ce que l'utilisateur tape : chiffres et UN séparateur décimal (virgule ou point, affiché en virgule),
 * au plus `decimals` chiffres après la virgule, pas de zéros inutiles en tête.
 */
export function sanitizeAmountInput(text: string, decimals: number): string {
  let t = (text ?? "").replace(/\s/g, "").replace(/\./g, ",").replace(/[^0-9,]/g, "");
  const first = t.indexOf(",");
  if (first >= 0) t = t.slice(0, first + 1) + t.slice(first + 1).replace(/,/g, "");
  if (decimals === 0) t = t.replace(/,.*$/, "");
  else if (first >= 0) {
    const [int, dec = ""] = t.split(",");
    t = `${int},${dec.slice(0, decimals)}`;
  }
  t = t.replace(/^0+(?=\d)/, "");
  if (t.startsWith(",")) t = `0${t}`;
  return t;
}

/** Nombre calculé → texte du champ : « 7,63 », « 5000 », « » si nul. */
export function toInputText(value: number, decimals: number): string {
  if (!(value > 0)) return "";
  const r = roundTo(value, decimals);
  if (decimals === 0 || Number.isInteger(r)) return String(r);
  return r.toFixed(decimals).replace(".", ",");
}

/** Montant affiché avec séparateurs : « 5 004,99 », « 5 005 » (XOF / GNF sans décimales). */
export function fmtMoney(value: number, currency?: string | null): string {
  const d = decimalsFor(currency);
  try {
    return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(value);
  } catch {
    return value.toFixed(d);
  }
}

/** Taux de change lisible : 655,957 · 1,0842 · 0,001524 (jusqu'à 6 décimales utiles, sans zéros de fin). */
export function fmtRate(rate: number): string {
  const max = rate >= 100 ? 3 : rate >= 1 ? 4 : 6;
  try {
    return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: max }).format(rate);
  } catch {
    return String(rate);
  }
}
