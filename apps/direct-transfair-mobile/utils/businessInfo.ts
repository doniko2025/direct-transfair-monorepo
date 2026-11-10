// apps/direct-transfair-mobile/utils/businessInfo.ts
// =========================================================
// COORDONNÉES DU COMMERCE (compte marchand) — adresse, code postal, téléphone du commerce, NIF / IFU.
// Mêmes règles que le serveur (apps/backend/src/merchants/merchant-rules.ts › normalizeBusiness*, normalizePostalCode, normalizeTaxId).
// Ces informations appartiennent au COMMERCE : elles ne sont JAMAIS reprises de l'adresse ou du téléphone personnels du client
// (compte client et compte marchand restent isolés l'un de l'autre, même pour la même personne).
//   • adresse et ville : obligatoires ;
//   • quartier / commune, code postal, pays, téléphone du commerce, NIF / IFU : facultatifs.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import { tr } from "../i18n/runtime";

/** Espaces simplifiés, bords retirés. */
export const cleanText = (raw: string | null | undefined): string => (raw ?? "").trim().replace(/\s+/g, " ");

/** Adresse du commerce : 5 caractères minimum. */
export function validateBusinessAddress(raw: string | null | undefined): string | null {
  const v = cleanText(raw);
  if (!v) return tr('biz.addressRequired');
  if (v.length < 5 || !/[\p{L}\p{N}]/u.test(v)) return tr('biz.addressShort');
  return null;
}

/** Ville du commerce : 2 caractères minimum. */
export function validateBusinessCity(raw: string | null | undefined): string | null {
  return cleanText(raw).length < 2 ? tr('biz.cityRequired') : null;
}

/** Code postal : facultatif. 3 à 10 caractères (lettres, chiffres, espace ou tiret). */
export function validatePostalCode(raw: string | null | undefined): string | null {
  const v = cleanText(raw).toUpperCase();
  if (!v) return null;
  return v.length < 3 || v.length > 10 || !/^[A-Z0-9][A-Z0-9 -]*$/.test(v) ? tr('biz.postalInvalid') : null;
}

/** Téléphone du commerce sous la forme envoyée au serveur : « + » puis les chiffres (espaces, points et tirets retirés). */
export function normalizeBusinessPhone(raw: string | null | undefined): string {
  const v = cleanText(raw);
  if (!v) return "";
  const digits = v.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

/** Téléphone du commerce : facultatif, avec l'indicatif du pays (+224…). */
export function validateBusinessPhone(raw: string | null | undefined): string | null {
  const v = cleanText(raw);
  if (!v) return null;
  if (!v.startsWith("+") && !v.startsWith("00")) return tr('biz.phoneDial');
  const digits = v.replace(/\D/g, "").replace(/^00/, "");
  return digits.length < 8 || digits.length > 15 ? tr('biz.phoneInvalid') : null;
}

/** NIF / IFU : facultatif. 3 à 30 caractères (lettres, chiffres, points, tirets, barres obliques), au moins un chiffre. */
export function validateTaxId(raw: string | null | undefined): string | null {
  const v = cleanText(raw).toUpperCase();
  if (!v) return null;
  return v.length < 3 || v.length > 30 || !/^[A-Z0-9][A-Z0-9 ./-]*$/.test(v) || !/\d/.test(v)
    ? tr('biz.taxInvalid')
    : null;
}
