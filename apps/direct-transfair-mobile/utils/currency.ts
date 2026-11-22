//apps/direct-transfair-mobile/utils/currency.ts
export function getCurrencyForCountry(country: string): string {
  if (!country) return "EUR";

  const normalized = country.trim().toUpperCase();

  // Zone Franc CFA (Ouest) - XOF
  const zoneXOF = ["SÉNÉGAL", "SENEGAL", "MALI", "CÔTE D'IVOIRE", "COTE D'IVOIRE", "BENIN", "BÉNIN", "TOGO", "BURKINA FASO", "NIGER", "GUINÉE-BISSAU"];
  if (zoneXOF.includes(normalized)) return "XOF";

  // Zone Franc CFA (Centrale) - XAF
  const zoneXAF = ["CAMEROUN", "GABON", "CONGO", "TCHAD", "RCA", "GUINÉE ÉQUATORIALE"];
  if (zoneXAF.includes(normalized)) return "XAF";

  // Guinée Conakry
  if (normalized.includes("GUINÉE") || normalized.includes("GUINEE")) return "GNF";

  // Zone Euro (par défaut pour l'instant)
  return "EUR";
}

// ── Devise par défaut de l'utilisateur : UNE seule règle pour tous les écrans ────────────────────────────────────────
// Avant : l'accueil, l'envoi et les demandes d'argent prenaient XOF par défaut, la recharge par carte EUR, d'autres écrans lisaient un
// champ `currency` qui n'existe pas : un même compte pouvait voir deux devises différentes selon l'écran.
const COUNTRY_CURRENCY: Record<string, string> = {
  GN: "GNF", SN: "XOF", ML: "XOF", CI: "XOF", BF: "XOF", BJ: "XOF",
  TG: "XOF", NE: "XOF", GW: "XOF", FR: "EUR", DE: "EUR", BE: "EUR",
  GB: "GBP", US: "USD",
};

/** Devise de l'utilisateur : devise principale du compte, sinon devise de son portefeuille par défaut, sinon celle de son pays, sinon XOF. */
export function userCurrency(user: unknown): string {
  const u = (user ?? {}) as { primaryCurrency?: string | null; country?: string | null; wallets?: Array<{ currency?: string; isDefault?: boolean }> };
  if (u.primaryCurrency) return String(u.primaryCurrency);
  const wallets = Array.isArray(u.wallets) ? u.wallets : [];
  const wallet = wallets.find((w) => w?.isDefault && w.currency) ?? wallets.find((w) => w?.currency);
  if (wallet?.currency) return String(wallet.currency);
  const iso = String(u.country ?? "").trim().toUpperCase().substring(0, 2);
  return COUNTRY_CURRENCY[iso] ?? "XOF";
}
