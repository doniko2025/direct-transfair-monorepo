// apps/direct-transfair-mobile/utils/phone.ts
// =========================================================
// TÉLÉPHONE — saisie, indicatif pays et affichage — v1.0
//
// POURQUOI CE FICHIER
//   L'écran d'envoi affichait l'indicatif TROIS fois (+221 dans le bouton, puis +221 + 221… dans le champ) :
//     1) le bouton pays affiche déjà « +221 » ;
//     2) le numéro enregistré en base commençait déjà par « +221 » ;
//     3) certains numéros ont été enregistrés avec l'indicatif DEUX fois (« +221221776676677 »), parce qu'un écran
//        préfixait l'indicatif sans vérifier qu'il était déjà là.
//   Règle désormais appliquée partout : le champ ne contient QUE le numéro national (sans indicatif, sans 0 de tête) ;
//   l'indicatif vit uniquement dans le bouton pays ; le numéro complet (« +221776676677 ») se reconstruit à la demande.
//
//   Un numéro collé avec « + » ou « 00 » (« +224 622 12 34 56 ») est reconnu : le pays est changé tout seul et le
//   champ ne garde que le numéro national. Un indicatif répété est retiré (« +221221776676677 » → « 776676677 »).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import { countriesList, type CountryData } from "../data/countries";

/** Plus petit numéro national plausible (Gambie, Liberia : 7 chiffres). Sert de garde-fou au retrait d'un indicatif répété. */
const MIN_NATIONAL = 6;

/** Nombre de chiffres à partir duquel un numéro est considéré complet pour la détection automatique du destinataire. */
export const MIN_FULL_NUMBER = 7;

// Indicatifs les plus longs d'abord : « 1268 » doit être testé avant « 1 », etc.
const BY_DIAL_LENGTH: CountryData[] = [...countriesList].sort((a, b) => b.dialCode.length - a.dialCode.length);

export const onlyDigits = (s: string | null | undefined): string => (s ?? "").replace(/\D/g, "");

/** Vrai pour un texte « numéro » (chiffres, +, espaces, tirets, points, parenthèses) ; faux dès qu'il y a une lettre ou un @. */
export const isNumericLike = (s: string): boolean => /^[0-9+\s().-]*$/.test(s);

/**
 * Retire l'indicatif pays en tête de `digits`, même répété, puis le « 0 » de tête (préfixe national) :
 *   stripDial("221221776676677", "221") → "776676677"
 *   stripDial("0033612345678", "33")     → "612345678"
 */
export function stripDial(digits: string, dial: string): string {
  let d = digits;
  if (d.startsWith("00")) d = d.slice(2);
  while (dial && d.startsWith(dial) && d.length - dial.length >= MIN_NATIONAL) d = d.slice(dial.length);
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  return d;
}

/**
 * Reconnaît un numéro international saisi ou collé (« +… » ou « 00… ») et le découpe en pays + numéro national.
 * Renvoie null tant que le texte n'est pas international, ou que l'indicatif n'est pas encore reconnaissable.
 */
export function parseInternational(raw: string): { country: CountryData; national: string } | null {
  const t = (raw ?? "").trim();
  if (!(t.startsWith("+") || t.startsWith("00"))) return null;
  const digits = t.startsWith("+") ? onlyDigits(t) : onlyDigits(t).slice(2);
  if (!digits) return null;
  const country = BY_DIAL_LENGTH.find((c) => digits.startsWith(c.dialCode));
  if (!country) return null;
  return { country, national: stripDial(digits.slice(country.dialCode.length), country.dialCode) };
}

/**
 * Numéro national (chiffres seuls) d'un texte saisi dans le champ, pour l'indicatif `dial` sélectionné.
 * Pour un texte « + / 00 » encore incomplet, on garde les chiffres tels quels.
 */
export function nationalOf(text: string, dial: string): string {
  const intl = parseInternational(text);
  if (intl) return intl.national;
  return stripDial(onlyDigits(text), dial);
}

/** Numéro complet au format E.164 : « +221776676677 ». */
export const toE164 = (dial: string, national: string): string => `+${dial}${national}`;

/** Variante historique : numéros enregistrés AVEC l'indicatif en double (« +221221776676677 »). Sert au repli de recherche. */
export const toLegacyDoubled = (dial: string, national: string): string => `+${dial}${dial}${national}`;

function group(national: string): string {
  const n = national;
  if (n.length === 9) return `${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
  if (n.length === 8) return `${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 6)} ${n.slice(6)}`;
  return n.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

/** Numéro enregistré → affichage lisible, indicatif UNE seule fois : « +221221776676677 » → « +221 77 667 66 77 ». */
export function formatPhone(stored: string | null | undefined): string {
  const digits = onlyDigits(stored);
  if (!digits) return (stored ?? "").trim();
  const intl = parseInternational(`+${digits}`);
  if (!intl || !intl.national) return `+${digits}`;
  return `+${intl.country.dialCode} ${group(intl.national)}`;
}

/** Pays dont l'indicatif correspond à un numéro enregistré (null si inconnu). */
export function countryOfPhone(stored: string | null | undefined): CountryData | null {
  const digits = onlyDigits(stored);
  return digits ? (parseInternational(`+${digits}`)?.country ?? null) : null;
}
