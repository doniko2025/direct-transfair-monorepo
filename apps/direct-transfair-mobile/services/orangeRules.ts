// apps/direct-transfair-mobile/services/orangeRules.ts
// =========================================================
// NUMÉRO ORANGE MONEY ↔ DEVISE DU COMPTE — même règle que le serveur (apps/backend/src/merchants/merchant-rules.ts).
//   • GNF (franc guinéen) → numéro mobile GUINÉEN obligatoire (+224, puis 9 chiffres commençant par 6) ;
//   • XOF (franc CFA)     → numéro d'un pays de la zone CFA (UEMOA) ;
//   • toute autre devise (EUR, USD, GBP…) → Orange Money n'existe pas : retraits par compte bancaire (IBAN) uniquement.
// Ce contrôle évite d'envoyer au serveur un numéro qu'il refuserait ; le serveur reste l'arbitre final.
// =========================================================

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  FR: "EUR", DE: "EUR", IT: "EUR", ES: "EUR", BE: "EUR", PT: "EUR", NL: "EUR", AT: "EUR", FI: "EUR", IE: "EUR", LU: "EUR", GR: "EUR",
  SI: "EUR", SK: "EUR", EE: "EUR", LT: "EUR", LV: "EUR", MT: "EUR", CY: "EUR",
  GB: "GBP", GG: "GBP", JE: "GBP", IM: "GBP",
  US: "USD", SV: "USD", PA: "USD", EC: "USD",
  GN: "GNF",
  SN: "XOF", CI: "XOF", ML: "XOF", BF: "XOF", BJ: "XOF", TG: "XOF", NE: "XOF", GW: "XOF",
};

/** Devise du compte créé pour ce pays de résidence — copie fidèle de `getCurrencyFromCountry` du serveur (nom du pays ou code ISO). */
export function accountCurrencyForCountry(country?: string | null): string {
  if (!country) return "XOF";
  const raw = country.trim();
  if (raw.length <= 3) {
    const found = COUNTRY_TO_CURRENCY[raw.toUpperCase()];
    if (found) return found;
  }
  const u = raw.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (u.includes("GUIN") && !u.includes("BISS") && !u.includes("EQUAT")) return "GNF";
  if (u.includes("GUIN") && u.includes("BISS")) return "XOF";
  if (["FRANCE", "ALLEMAGNE", "BELGIQUE", "PORTUGAL", "ESPAGNE", "ITALIE", "PAYS-BAS", "LUXEMBOURG", "AUTRICHE", "FINLANDE", "IRLANDE", "GRECE",
    "SLOVENIE", "SLOVAQUIE", "ESTONIE", "LITUANIE", "LETTONIE", "MALTE", "CHYPRE"].some((k) => u.includes(k))) return "EUR";
  if (u.includes("ROYAUME") || u === "UK" || u === "ANGLETERRE") return "GBP";
  if ((u.includes("ETATS") && u.includes("UNIS")) || u === "USA") return "USD";
  if (["SENEGAL", "MALI", "BENIN", "TOGO", "IVOIRE", "BURKINA", "BISSAU"].some((k) => u.includes(k))) return "XOF";
  if (u.includes("NIGER") && !u.includes("NIGERIA") && !u.includes("NIGERI")) return "XOF";
  return COUNTRY_TO_CURRENCY[raw.toUpperCase().substring(0, 2)] ?? "XOF";
}

/** Indicatifs (sans « + ») de la zone CFA. */
const UEMOA_DIAL_CODES = ["221", "223", "225", "226", "227", "228", "229", "245"];

/** Orange Money est-il proposé pour un compte dans cette devise ? */
export const isOrangeMoneyCurrency = (currency?: string | null): boolean => currency === "GNF" || currency === "XOF";

/** Indicatif (avec « + ») imposé par la devise : « +224 » pour GNF, sinon null (XOF : plusieurs pays ; autres : aucun). */
export const fixedDialFor = (currency?: string | null): string | null => (currency === "GNF" ? "+224" : null);

/** Phrase d'aide à afficher sous le champ « numéro Orange Money ». */
export function orangeHintFor(currency?: string | null): string {
  if (currency === "GNF") return "Numéro Orange Money guinéen : +224 puis 9 chiffres commençant par 6, sans le 0 de tête.";
  if (currency === "XOF") return "Numéro Orange Money d'un pays de la zone CFA (Sénégal, Mali, Côte d'Ivoire…), sans le 0 de tête.";
  return "Numéro Orange Money, sans le 0 de tête.";
}

export const ORANGE_NOT_AVAILABLE_TEXT = (currency: string): string =>
  `Orange Money n'est pas disponible pour un compte en ${currency}. Les retraits se font par compte bancaire (IBAN) : vous le renseignerez dans les réglages de votre commerce.`;

/**
 * Message d'erreur (ou null si le numéro convient) pour un numéro complet (« +224620000000 ») et la devise du compte.
 */
export function validateOrangeFor(fullNumber: string, currency?: string | null): string | null {
  if (!currency) return null;
  if (!isOrangeMoneyCurrency(currency)) return ORANGE_NOT_AVAILABLE_TEXT(currency);
  const digits = fullNumber.replace(/[^\d]/g, "");
  if (currency === "GNF" && !/^2246\d{8}$/.test(digits)) {
    return "Un compte en franc guinéen (GNF) exige un numéro Orange Money guinéen : +224 suivi de 9 chiffres commençant par 6.";
  }
  if (currency === "XOF" && !UEMOA_DIAL_CODES.some((d) => digits.startsWith(d))) {
    return "Un compte en franc CFA (XOF) exige un numéro Orange Money d'un pays de la zone CFA (Sénégal, Mali, Côte d'Ivoire, Burkina Faso, Niger, Togo, Bénin, Guinée-Bissau).";
  }
  return null;
}
