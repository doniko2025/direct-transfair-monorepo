// apps/direct-transfair-mobile/utils/phone.ts
// =========================================================
// TÉLÉPHONE — saisie, indicatif pays et affichage — v1.1
//
// ✅ v1.1 : ESPACES AUTOMATIQUES PENDANT LA SAISIE, selon le pays (formatNationalInput / formatInternationalInput) :
//     Guinée 622534217 → 622 53 42 17 · Sénégal 775099991 → 77 509 99 91 · France 0766736227 → 07 66 73 62 27.
//   En France (et dans les pays où l'on compose un « 0 » national) le 0 de tête est TOLÉRÉ : il reste visible dans le champ, et
//   il est retiré au moment de construire le numéro international (nationalOf / normalizeNationalNumber, inchangés) :
//   « 07 66 73 62 27 » et « 7 66 73 62 27 » donnent le même +33766736227.
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
export function stripDial(digits: string, dial: string, keepLeadingZero = false): string {
  let d = digits;
  if (d.startsWith("00")) d = d.slice(2);
  while (dial && d.startsWith(dial) && d.length - dial.length >= MIN_NATIONAL) d = d.slice(dial.length);
  if (!keepLeadingZero && d.startsWith("0")) d = d.replace(/^0+/, "");
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

// ─── Formats de saisie par pays (clé = indicatif sans « + ») ──────────────────────────────────────────────────────
//   g    : tailles des groupes du numéro national SANS le 0 de tête ;
//   lead : « trunk » = on compose un 0 national (le 0 reste visible et s'ajoute au 1er groupe : France 07 66 73 62 27) ;
//          « part »  = le 0 fait partie du numéro (Côte d'Ivoire, Bénin : 10 chiffres) ; « none » (défaut) = jamais de 0 de tête.
type PhoneFmt = { g: number[]; lead?: "trunk" | "part" | "none" };
const PHONE_FORMATS: Record<string, PhoneFmt> = {
  // Afrique de l'Ouest
  "224": { g: [3, 2, 2, 2] },                      // Guinée      622 53 42 17
  "221": { g: [2, 3, 2, 2] },                      // Sénégal     77 509 99 91
  "223": { g: [2, 2, 2, 2] },                      // Mali        76 12 34 56
  "225": { g: [2, 2, 2, 2, 2], lead: "part" },     // Côte d'Ivoire 07 12 34 56 78
  "226": { g: [2, 2, 2, 2] },                      // Burkina Faso
  "227": { g: [2, 2, 2, 2] },                      // Niger
  "228": { g: [2, 2, 2, 2] },                      // Togo
  "229": { g: [2, 2, 2, 2, 2], lead: "part" },     // Bénin       01 97 12 34 56
  "222": { g: [2, 2, 2, 2] },                      // Mauritanie
  "245": { g: [3, 3, 3] },                         // Guinée-Bissau
  "220": { g: [3, 4] },                            // Gambie
  "231": { g: [2, 3, 4] },                         // Liberia
  "232": { g: [2, 3, 3], lead: "trunk" },          // Sierra Leone
  "233": { g: [2, 3, 4], lead: "trunk" },          // Ghana       024 123 4567
  "234": { g: [3, 3, 4], lead: "trunk" },          // Nigeria     0803 123 4567
  // Afrique centrale / nord / autres
  "237": { g: [1, 2, 2, 2, 2] },                   // Cameroun    6 71 23 45 67
  "212": { g: [1, 2, 2, 2, 2], lead: "trunk" },    // Maroc       06 12 34 56 78
  "213": { g: [3, 2, 2, 2], lead: "trunk" },       // Algérie     0551 23 45 67
  "216": { g: [2, 3, 3] },                         // Tunisie     20 123 456
  "244": { g: [3, 3, 3] },                         // Angola
  "20":  { g: [3, 3, 4], lead: "trunk" },          // Égypte
  "254": { g: [3, 3, 3], lead: "trunk" },          // Kenya
  "27":  { g: [2, 3, 4], lead: "trunk" },          // Afrique du Sud
  // Europe
  "33":  { g: [1, 2, 2, 2, 2], lead: "trunk" },    // France      07 66 73 62 27
  "32":  { g: [3, 2, 2, 2], lead: "trunk" },       // Belgique    0470 12 34 56
  "49":  { g: [3, 4, 4], lead: "trunk" },          // Allemagne
  "34":  { g: [3, 3, 3] },                         // Espagne     612 345 678
  "39":  { g: [3, 3, 4] },                         // Italie      312 345 6789
  "351": { g: [3, 3, 3] },                         // Portugal
  "352": { g: [3, 3, 3] },                         // Luxembourg
  "41":  { g: [2, 3, 2, 2], lead: "trunk" },       // Suisse      079 123 45 67
  "44":  { g: [4, 6], lead: "trunk" },             // Royaume-Uni 07911 123456
  "90":  { g: [3, 3, 2, 2], lead: "trunk" },       // Turquie
  // Amériques / Asie / Golfe
  "1":   { g: [3, 3, 4] },                         // États-Unis, Canada  (514) 555 0123 → 514 555 0123
  "971": { g: [2, 3, 4], lead: "trunk" },          // Émirats     050 123 4567
  "966": { g: [2, 3, 4], lead: "trunk" },          // Arabie Saoudite
  "86":  { g: [3, 4, 4] },                         // Chine
};
const DEFAULT_PHONE_FMT: PhoneFmt = { g: [3, 3, 3, 3, 3] };
const MAX_PHONE_DIGITS = 15;                        // norme E.164

const phoneFmt = (dial: string): PhoneFmt => PHONE_FORMATS[onlyDigits(dial)] ?? DEFAULT_PHONE_FMT;

/** Vrai si, dans ce pays, un « 0 » national de tête est toléré et reste visible dans le champ (France : 07 66…). */
export const keepsLeadingZero = (dial: string): boolean => (phoneFmt(dial).lead ?? "none") !== "none";

/**
 * Numéro NATIONAL tapé → texte du champ avec les espaces du pays, au fil de la frappe (idempotent) :
 *   formatNationalInput("622534217", "224")   → "622 53 42 17"
 *   formatNationalInput("775099991", "+221")  → "77 509 99 91"
 *   formatNationalInput("0766736227", "33")   → "07 66 73 62 27"   (le 0 est toléré)
 *   formatNationalInput("766736227", "33")    → "7 66 73 62 27"
 * Tout caractère non numérique est ignoré. Pays inconnu : groupes de 3. Jamais d'espace en fin de texte.
 */
export function formatNationalInput(raw: string, dial: string): string {
  const fmt = phoneFmt(dial);
  const lead = fmt.lead ?? "none";
  let d = onlyDigits(raw);
  if (lead === "none") d = d.replace(/^0+/, "");
  else if (lead === "trunk") d = d.replace(/^0+/, "0");
  d = d.slice(0, MAX_PHONE_DIGITS);
  if (!d) return "";
  const sizes = lead === "trunk" && d.startsWith("0") ? [fmt.g[0]! + 1, ...fmt.g.slice(1)] : fmt.g;
  const parts: string[] = [];
  let pos = 0;
  for (const size of sizes) {
    if (pos >= d.length) break;
    parts.push(d.slice(pos, pos + size));
    pos += size;
  }
  if (pos < d.length) parts.push(d.slice(pos));       // chiffres en trop : dernier groupe, jamais perdus
  return parts.join(" ");
}

/**
 * Numéro saisi AVEC indicatif (« +… ») → « +224 622 53 42 17 ». Sans « + » en tête, le texte est seulement nettoyé
 * (chiffres, espaces, + . -) : on ne devine jamais le pays d'un numéro local.
 */
export function formatInternationalInput(raw: string): string {
  const t = String(raw ?? "");
  if (!t.trim().startsWith("+")) return t.replace(/[^\d+\s.-]/g, "");
  const digits = onlyDigits(t).slice(0, MAX_PHONE_DIGITS);
  if (!digits) return "+";
  const country = BY_DIAL_LENGTH.find((c) => digits.startsWith(c.dialCode));
  if (!country) return `+${digits}`;                  // indicatif pas encore reconnaissable
  let national = digits.slice(country.dialCode.length);
  // Forme internationale : jamais de « 0 » national après l'indicatif (« +33 07… » est un numéro faux) ; sauf Côte d'Ivoire / Bénin.
  if (phoneFmt(country.dialCode).lead === "trunk") national = national.replace(/^0+/, "");
  return national ? `+${country.dialCode} ${formatNationalInput(national, country.dialCode)}` : `+${country.dialCode}`;
}

/** Numéro enregistré → affichage lisible, indicatif UNE seule fois : « +221221776676677 » → « +221 77 667 66 77 ». */
export function formatPhone(stored: string | null | undefined): string {
  const digits = onlyDigits(stored);
  if (!digits) return (stored ?? "").trim();
  const intl = parseInternational(`+${digits}`);
  if (!intl || !intl.national) return `+${digits}`;
  return `+${intl.country.dialCode} ${formatNationalInput(intl.national, intl.country.dialCode)}`;
}

/** Pays dont l'indicatif correspond à un numéro enregistré (null si inconnu). */
export function countryOfPhone(stored: string | null | undefined): CountryData | null {
  const digits = onlyDigits(stored);
  return digits ? (parseInternational(`+${digits}`)?.country ?? null) : null;
}
