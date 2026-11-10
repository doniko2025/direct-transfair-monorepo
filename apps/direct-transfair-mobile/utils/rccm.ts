// apps/direct-transfair-mobile/utils/rccm.ts
// =========================================================
// RCCM (Registre du Commerce et du Crédit Mobilier) — obligatoire pour ouvrir un compte marchand.
// Mêmes règles que le serveur (apps/backend/src/merchants/merchant-rules.ts › normalizeRccm) : formats variables selon le pays
// (« GN.TCC.2019.B.12345 », « SN DKR 2015 B 1234 », « CI-ABJ-2018-B-12345 »…), donc on contrôle seulement l'allure :
// 5 à 40 caractères (lettres, chiffres, espaces, points, tirets, barres obliques) dont au moins un chiffre.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import { tr } from "../i18n/runtime";

export const RCCM_EXAMPLE = "GN.TCC.2019.B.12345";

/** Texte normalisé tel qu'envoyé au serveur : espaces simplifiés, majuscules. */
export function normalizeRccm(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

/** Message d'erreur à afficher sous le champ, ou null si le numéro est acceptable. */
export function validateRccm(raw: string | null | undefined): string | null {
  const v = normalizeRccm(raw);
  if (!v) return tr('rccm.required');
  if (v.length < 5 || v.length > 40 || !/^[A-Z0-9][A-Z0-9 ./-]*$/.test(v) || !/\d/.test(v)) {
    return tr('rccm.invalid', { example: RCCM_EXAMPLE });
  }
  return null;
}
