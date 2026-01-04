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