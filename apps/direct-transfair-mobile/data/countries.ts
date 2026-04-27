// apps/direct-transfair-mobile/data/countries.ts
export interface CountryData {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  currency: string;
}

export const countriesList: CountryData[] = [
  // --- AFRIQUE DE L'OUEST (UEMOA - XOF) ---
  { name: "Sénégal", code: "SN", dialCode: "221", flag: "🇸🇳", currency: "XOF" },
  { name: "Côte d'Ivoire", code: "CI", dialCode: "225", flag: "🇨🇮", currency: "XOF" },
  { name: "Mali", code: "ML", dialCode: "223", flag: "🇲🇱", currency: "XOF" },
  { name: "Guinée-Bissau", code: "GW", dialCode: "245", flag: "🇬🇼", currency: "XOF" },
  { name: "Burkina Faso", code: "BF", dialCode: "226", flag: "🇧🇫", currency: "XOF" },
  { name: "Togo", code: "TG", dialCode: "228", flag: "🇹🇬", currency: "XOF" },
  { name: "Bénin", code: "BJ", dialCode: "229", flag: "🇧🇯", currency: "XOF" },
  { name: "Niger", code: "NE", dialCode: "227", flag: "🇳🇪", currency: "XOF" },

  // --- AFRIQUE (AUTRES DEVISES) ---
  { name: "Guinée", code: "GN", dialCode: "224", flag: "🇬🇳", currency: "GNF" },
  { name: "Gambie", code: "GM", dialCode: "220", flag: "🇬🇲", currency: "GMD" },
  { name: "Liberia", code: "LR", dialCode: "231", flag: "🇱🇷", currency: "LRD" },
  { name: "Sierra Leone", code: "SL", dialCode: "232", flag: "🇸🇱", currency: "SLL" },
  { name: "Cameroun", code: "CM", dialCode: "237", flag: "🇨🇲", currency: "XAF" },
  { name: "Maroc", code: "MA", dialCode: "212", flag: "🇲🇦", currency: "MAD" },
  { name: "Algérie", code: "DZ", dialCode: "213", flag: "🇩🇿", currency: "DZD" },
  { name: "Tunisie", code: "TN", dialCode: "216", flag: "🇹🇳", currency: "TND" },
  { name: "Angola", code: "AO", dialCode: "244", flag: "🇦🇴", currency: "AOA" },
  { name: "Mauritanie", code: "MR", dialCode: "222", flag: "🇲🇷", currency: "MRU" },

  // --- EUROPE (ZONE EURO - EUR) ---
  { name: "France", code: "FR", dialCode: "33", flag: "🇫🇷", currency: "EUR" },
  { name: "Belgique", code: "BE", dialCode: "32", flag: "🇧🇪", currency: "EUR" },
  { name: "Allemagne", code: "DE", dialCode: "49", flag: "🇩🇪", currency: "EUR" },
  { name: "Espagne", code: "ES", dialCode: "34", flag: "🇪🇸", currency: "EUR" },
  { name: "Italie", code: "IT", dialCode: "39", flag: "🇮🇹", currency: "EUR" },
  { name: "Portugal", code: "PT", dialCode: "351", flag: "🇵🇹", currency: "EUR" },
  { name: "Luxembourg", code: "LU", dialCode: "352", flag: "🇱🇺", currency: "EUR" },

  // --- EUROPE (HORS EURO) ---
  { name: "Suisse", code: "CH", dialCode: "41", flag: "🇨🇭", currency: "CHF" },
  { name: "Royaume-Uni", code: "GB", dialCode: "44", flag: "🇬🇧", currency: "GBP" },

  // --- AMÉRIQUE & ASIE ---
  { name: "États-Unis", code: "US", dialCode: "1", flag: "🇺🇸", currency: "USD" },
  { name: "Canada", code: "CA", dialCode: "1", flag: "🇨🇦", currency: "CAD" },
  { name: "Émirats Arabes Unis", code: "AE", dialCode: "971", flag: "🇦🇪", currency: "AED" },
  { name: "Chine", code: "CN", dialCode: "86", flag: "🇨🇳", currency: "CNY" },
];

export const getCountryByName = (name: string): CountryData | undefined => {
  if (!name) return undefined;
  const normalized = name.toLowerCase().trim();
  return countriesList.find(c => c.name.toLowerCase() === normalized);
};

export const getCurrencyByCountry = (countryName: string, fallback = "XOF"): string => {
  const country = getCountryByName(countryName);
  return country ? country.currency : fallback;
};