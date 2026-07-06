// apps/direct-transfair-mobile/data/phoneRules.ts
// =========================================================
// RÈGLES DE LONGUEUR TÉLÉPHONE PAR INDICATIF
// =========================================================
// ⚠️ Longueurs APPROXIMATIVES du numéro national (hors indicatif,
// hors "0" de tronc initial). Utilisées uniquement pour une
// validation souple côté UI (maxLength du champ + message d'erreur
// à la sauvegarde) — ce n'est PAS une source de vérité absolue.
// Les plans de numérotation changent (ex: la Côte d'Ivoire est
// passée de 8 à 10 chiffres en 2021), d'où des plages volontairement
// un peu larges plutôt qu'un chiffre unique strict.
//
// Pour une validation 100% fiable (et gérer les ~195 pays plutôt
// qu'une liste ciblée), la vraie solution long terme est
// `libphonenumber-js` — déjà recommandée pour la normalisation
// backend, voir apps/backend/src/common/utils/phone.util.ts.
// =========================================================

export type PhoneDigitRange = { min: number; max: number };

const RULES_BY_DIAL_DIGITS: Record<string, PhoneDigitRange> = {
  // ── Afrique de l'Ouest ──
  // Valeurs vérifiées (juillet 2026) : la Guinée est passée à 9 chiffres
  // en 2013 (ancien plan 8 chiffres révolu), la Côte d'Ivoire et le
  // Bénin sont désormais figés à 10 chiffres depuis la fin de leurs
  // périodes de transition respectives (resp. 31/01/2021 et 30/11/2024
  // + 1 mois de cohabitation) — les anciens formats plus courts ne
  // fonctionnent plus du tout aujourd'hui, donc plus besoin de plage.
  "224": { min: 9,  max: 9  }, // Guinée (réforme 2013 : 8 → 9 chiffres)
  "221": { min: 9,  max: 9  }, // Sénégal
  "223": { min: 8,  max: 8  }, // Mali
  "225": { min: 10, max: 10 }, // Côte d'Ivoire (10 chiffres depuis le 31/01/2021)
  "226": { min: 8,  max: 8  }, // Burkina Faso
  "229": { min: 10, max: 10 }, // Bénin (10 chiffres depuis le 30/11/2024)
  "228": { min: 8,  max: 8  }, // Togo
  "227": { min: 8,  max: 8  }, // Niger
  "245": { min: 7,  max: 9  }, // Guinée-Bissau (sources divergentes)

  // ── Europe ──
  "33":  { min: 9,  max: 10 }, // France
  "49":  { min: 9,  max: 11 }, // Allemagne
  "32":  { min: 8,  max: 9  }, // Belgique
  "39":  { min: 8,  max: 11 }, // Italie
  "34":  { min: 9,  max: 9  }, // Espagne
  "351": { min: 9,  max: 9  }, // Portugal
  "31":  { min: 9,  max: 9  }, // Pays-Bas
  "43":  { min: 7,  max: 13 }, // Autriche (plan très flexible)
  "358": { min: 8,  max: 10 }, // Finlande
  "353": { min: 7,  max: 9  }, // Irlande
  "352": { min: 6,  max: 9  }, // Luxembourg
  "30":  { min: 10, max: 10 }, // Grèce
  "44":  { min: 9,  max: 10 }, // Royaume-Uni / Guernesey / Jersey

  // ── Amériques ──
  "1":   { min: 10, max: 10 }, // USA / Canada (NANP)
  "503": { min: 8,  max: 8  }, // Salvador
};

// Filet de sécurité pour tout indicatif non listé ci-dessus.
const DEFAULT_RANGE: PhoneDigitRange = { min: 6, max: 12 };

/**
 * Retourne la plage de chiffres attendue pour le numéro national
 * (hors indicatif) correspondant à un indicatif donné (ex: "+33", "33").
 */
export function getPhoneDigitRange(dialCode?: string | null): PhoneDigitRange {
  const digits = (dialCode ?? "").replace(/\D/g, "");
  if (!digits) return DEFAULT_RANGE;
  return RULES_BY_DIAL_DIGITS[digits] ?? DEFAULT_RANGE;
}

/**
 * Retire l'indicatif d'un numéro déjà complet, si présent, en vérifiant
 * que le reste correspond à une longueur nationale plausible pour cet
 * indicatif (évite de tronquer à tort un numéro local qui commencerait
 * par les mêmes chiffres que l'indicatif par pure coïncidence).
 *
 * Sert à éviter d'afficher l'indicatif deux fois (une fois dans le
 * sélecteur de pays, une fois dans le champ texte) quand on précharge
 * un numéro déjà complet venant du backend (ex: écran d'édition).
 */
export function stripDialCodeIfPresent(rawPhone?: string | null, dialCode?: string | null): string {
  const digits = (rawPhone ?? "").replace(/\D/g, "");
  if (!digits) return "";

  const dialDigits = (dialCode ?? "").replace(/\D/g, "");
  if (!dialDigits || !digits.startsWith(dialDigits)) return digits;

  const remainder = digits.slice(dialDigits.length);
  const range = getPhoneDigitRange(dialCode);
  if (remainder.length >= range.min && remainder.length <= range.max) {
    return remainder;
  }
  return digits;
}

/**
 * Message d'aide court affiché sous le champ téléphone
 * (ex: "9 à 10 chiffres attendus (hors indicatif)").
 */
export function phoneRangeHint(range: PhoneDigitRange): string {
  return range.min === range.max
    ? `${range.min} chiffres attendus (hors indicatif)`
    : `${range.min} à ${range.max} chiffres attendus (hors indicatif)`;
}