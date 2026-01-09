//apps/direct-transfair-mobile/data/countries.ts
// Données statiques pour les pays, villes et indicatifs

export interface CountryData {
  name: string;
  code: string;
  cities: string[];
  dialCode: string;
  flag: string;
}

export const countriesList: CountryData[] = [
  {
    name: "Sénégal",
    code: "SN",
    cities: ["Dakar", "Touba", "Thiès", "Rufisque", "Kaolack", "Saint-Louis"],
    dialCode: "+221",
    flag: "🇸🇳",
  },
  {
    name: "Côte d'Ivoire",
    code: "CI",
    cities: ["Abidjan", "Bouaké", "Daloa", "Yamoussoukro", "San-Pédro"],
    dialCode: "+225",
    flag: "🇨🇮",
  },
  {
    name: "Mali",
    code: "ML",
    cities: ["Bamako", "Sikasso", "Mopti", "Koutiala", "Kayes"],
    dialCode: "+223",
    flag: "🇲🇱",
  },
  {
    name: "Guinée",
    code: "GN",
    cities: ["Conakry", "Nzérékoré", "Kankan", "Kindia"],
    dialCode: "+224",
    flag: "🇬🇳",
  },
  {
    name: "Cameroun",
    code: "CM",
    cities: ["Douala", "Yaoundé", "Garoua", "Bamenda", "Maroua"],
    dialCode: "+237",
    flag: "🇨🇲",
  },
   {
    name: "France",
    code: "FR",
    cities: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice"],
    dialCode: "+33",
    flag: "🇫🇷",
  },
  // Tu pourras ajouter d'autres pays ici facilement
];