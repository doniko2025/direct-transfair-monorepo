// apps/direct-transfair-mobile/utils/amount.ts
// =========================================================
// MONTANTS — saisie, arrondi et affichage — v1.1
//
// ✅ v1.1 : `groupAmount()` — espaces de milliers AUTOMATIQUES pendant la saisie, pour toutes les devises (1000000000 → 1 000 000 000).
//   Affichage uniquement : l'état des écrans garde le texte brut (sanitizeAmountInput / parseAmount retirent déjà les espaces).
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

import { getLocale } from "../i18n/runtime";

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
  // audit argent (M1) : même méthode que le serveur — 15 chiffres significatifs pour effacer le bruit binaire (10,075 → 10,08).
  const scaled = Number((Math.abs(value) * f).toPrecision(15));
  const r = Math.round(scaled) / f;
  return value < 0 ? -r : r;
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

/**
 * Saisie → affichage avec espaces de milliers, au fil de la frappe : « 1000000000 » → « 1 000 000 000 », « 2500,5 » → « 2 500,5 ».
 * Seule la partie entière est groupée ; le séparateur décimal (virgule ou point) et les décimales restent tels que saisis,
 * et une virgule finale en cours de frappe (« 12, ») est conservée. Idempotent : groupAmount(groupAmount(x)) === groupAmount(x).
 * Texte non numérique : renvoyé tel quel (sans espaces).
 */
export function groupAmount(text: string | number | null | undefined): string {
  const t = String(text ?? "").replace(/[\s\u00A0\u202F]/g, "");
  if (!t) return "";
  const m = /^(\d*)([.,]?)(\d*)$/.exec(t);
  if (!m) return t;
  const [, int = "", sep = "", dec = ""] = m;
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + sep + dec;
}

/** Taille de police d'un montant saisi : réduite quand le nombre s'allonge (affichage groupé compris), pour qu'il reste lisible. */
export function amountFontFor(shown: string, base: number): number {
  const n = shown.length;
  if (n <= 10) return base;
  if (n <= 13) return Math.round(base * 0.85);
  if (n <= 16) return Math.round(base * 0.72);
  return Math.round(base * 0.6);
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
    return new Intl.NumberFormat(getLocale(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(value);
  } catch {
    return value.toFixed(d);
  }
}

/** Taux de change lisible : 655,957 · 1,0842 · 0,001524 (jusqu'à 6 décimales utiles, sans zéros de fin). */
export function fmtRate(rate: number): string {
  const max = rate >= 100 ? 3 : rate >= 1 ? 4 : 6;
  try {
    return new Intl.NumberFormat(getLocale(), { minimumFractionDigits: 0, maximumFractionDigits: max }).format(rate);
  } catch {
    return String(rate);
  }
}
