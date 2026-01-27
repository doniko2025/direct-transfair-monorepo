// apps/direct-transfair-mobile/data/countries.ts
export interface CountryData {
  name: string;
  code: string;
  cities: string[];
  dialCode: string;
  flag: string;
  currency: string; // ✅ AJOUT
}

export const countriesList: CountryData[] = [
  // --- AFRIQUE DE L'OUEST ---
  {
    name: "Sénégal",
    code: "SN",
    cities: ["Dakar", "Touba", "Thiès", "Rufisque", "Kaolack", "Saint-Louis", "Ziguinchor"],
    dialCode: "+221",
    flag: "🇸🇳",
    currency: "XOF"
  },
  {
    name: "Guinée",
    code: "GN",
    cities: ["Conakry", "Nzérékoré", "Kankan", "Labé", "Mamou", "Kindia", "Boké"],
    dialCode: "+224",
    flag: "🇬🇳",
    currency: "GNF" // ✅ La Guinée aura GNF
  },
  {
    name: "Côte d'Ivoire",
    code: "CI",
    cities: ["Abidjan", "Bouaké", "Daloa", "Yamoussoukro", "San-Pédro", "Korhogo"],
    dialCode: "+225",
    flag: "🇨🇮",
    currency: "XOF"
  },
  {
    name: "Mali",
    code: "ML",
    cities: ["Bamako", "Sikasso", "Mopti", "Koutiala", "Kayes", "Ségou"],
    dialCode: "+223",
    flag: "🇲🇱",
    currency: "XOF"
  },
  {
    name: "Gambie",
    code: "GM",
    cities: ["Banjul", "Serekunda", "Brikama", "Bakau"],
    dialCode: "+220",
    flag: "🇬🇲",
    currency: "GMD"
  },
  {
    name: "Guinée-Bissau",
    code: "GW",
    cities: ["Bissau", "Bafatá", "Gabú", "Bissorã"],
    dialCode: "+245",
    flag: "🇬🇼",
    currency: "XOF"
  },
  {
    name: "Liberia",
    code: "LR",
    cities: ["Monrovia", "Gbarnga", "Buchanan", "Ganta"],
    dialCode: "+231",
    flag: "🇱🇷",
    currency: "LRD"
  },
  {
    name: "Sierra Leone",
    code: "SL",
    cities: ["Freetown", "Bo", "Kenema", "Makeni"],
    dialCode: "+232",
    flag: "🇸🇱",
    currency: "SLL"
  },

  // --- AUTRES AFRIQUE ---
  {
    name: "Cameroun",
    code: "CM",
    cities: ["Douala", "Yaoundé", "Garoua", "Bamenda", "Maroua"],
    dialCode: "+237",
    flag: "🇨🇲",
    currency: "XAF"
  },
  {
    name: "Maroc",
    code: "MA",
    cities: ["Casablanca", "Rabat", "Fès", "Tanger", "Marrakech", "Agadir"],
    dialCode: "+212",
    flag: "🇲🇦",
    currency: "MAD"
  },
  {
    name: "Angola",
    code: "AO",
    cities: ["Luanda", "Cabinda", "Huambo", "Lubango"],
    dialCode: "+244",
    flag: "🇦🇴",
    currency: "AOA"
  },

  // --- EUROPE ---
  {
    name: "France",
    code: "FR",
    cities: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Bordeaux"],
    dialCode: "+33",
    flag: "🇫🇷",
    currency: "EUR"
  },
  {
    name: "Belgique",
    code: "BE",
    cities: ["Bruxelles", "Anvers", "Gand", "Charleroi", "Liège"],
    dialCode: "+32",
    flag: "🇧🇪",
    currency: "EUR"
  },
  {
    name: "Allemagne",
    code: "DE",
    cities: ["Berlin", "Munich", "Hambourg", "Francfort", "Cologne"],
    dialCode: "+49",
    flag: "🇩🇪",
    currency: "EUR"
  },
  {
    name: "Espagne",
    code: "ES",
    cities: ["Madrid", "Barcelone", "Valence", "Séville", "Bilbao"],
    dialCode: "+34",
    flag: "🇪🇸",
    currency: "EUR"
  },
  {
    name: "Italie",
    code: "IT",
    cities: ["Rome", "Milan", "Naples", "Turin", "Palerme"],
    dialCode: "+39",
    flag: "🇮🇹",
    currency: "EUR"
  },
  {
    name: "Royaume-Uni",
    code: "GB",
    cities: ["Londres", "Manchester", "Birmingham", "Liverpool", "Édimbourg"],
    dialCode: "+44",
    flag: "🇬🇧",
    currency: "GBP"
  },

  // --- AMÉRIQUE & ASIE ---
  {
    name: "États-Unis",
    code: "US",
    cities: ["New York", "Los Angeles", "Chicago", "Houston", "Miami"],
    dialCode: "+1",
    flag: "🇺🇸",
    currency: "USD"
  },
  {
    name: "Canada",
    code: "CA",
    cities: ["Montréal", "Toronto", "Vancouver", "Ottawa", "Québec"],
    dialCode: "+1",
    flag: "🇨🇦",
    currency: "CAD"
  },
  {
    name: "Chine",
    code: "CN",
    cities: ["Pékin", "Shanghai", "Shenzhen", "Guangzhou", "Chengdu"],
    dialCode: "+86",
    flag: "🇨🇳",
    currency: "CNY"
  },
];