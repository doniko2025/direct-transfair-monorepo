// apps/direct-transfair-mobile/components/auth/authCountries.ts
// =========================================================
// PAYS POUR LES FORMULAIRES D'AUTHENTIFICATION v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Mêmes noms de pays que l'ancien écran d'inscription (le serveur en
// déduit la devise du portefeuille à partir du nom), avec en plus
// l'indicatif téléphonique de CHAQUE pays (avant : une trentaine seulement).
// =========================================================

export type AuthCountry = { name: string; flag: string; dial: string };

export const AUTH_COUNTRIES: AuthCountry[] = [
  { name: 'Afghanistan', flag: '🇦🇫', dial: '+93' },
  { name: 'Algérie', flag: '🇩🇿', dial: '+213' },
  { name: 'Allemagne', flag: '🇩🇪', dial: '+49' },
  { name: 'Angola', flag: '🇦🇴', dial: '+244' },
  { name: 'Arabie Saoudite', flag: '🇸🇦', dial: '+966' },
  { name: 'Argentine', flag: '🇦🇷', dial: '+54' },
  { name: 'Belgique', flag: '🇧🇪', dial: '+32' },
  { name: 'Bénin', flag: '🇧🇯', dial: '+229' },
  { name: 'Brésil', flag: '🇧🇷', dial: '+55' },
  { name: 'Burkina Faso', flag: '🇧🇫', dial: '+226' },
  { name: 'Cameroun', flag: '🇨🇲', dial: '+237' },
  { name: 'Canada', flag: '🇨🇦', dial: '+1' },
  { name: 'Cap-Vert', flag: '🇨🇻', dial: '+238' },
  { name: 'Centrafrique', flag: '🇨🇫', dial: '+236' },
  { name: 'Chine', flag: '🇨🇳', dial: '+86' },
  { name: 'Comores', flag: '🇰🇲', dial: '+269' },
  { name: 'Congo', flag: '🇨🇬', dial: '+242' },
  { name: "Côte d'Ivoire", flag: '🇨🇮', dial: '+225' },
  { name: 'Djibouti', flag: '🇩🇯', dial: '+253' },
  { name: 'Émirats Arabes Unis', flag: '🇦🇪', dial: '+971' },
  { name: 'Égypte', flag: '🇪🇬', dial: '+20' },
  { name: 'Espagne', flag: '🇪🇸', dial: '+34' },
  { name: 'États-Unis', flag: '🇺🇸', dial: '+1' },
  { name: 'Éthiopie', flag: '🇪🇹', dial: '+251' },
  { name: 'France', flag: '🇫🇷', dial: '+33' },
  { name: 'Gabon', flag: '🇬🇦', dial: '+241' },
  { name: 'Gambie', flag: '🇬🇲', dial: '+220' },
  { name: 'Ghana', flag: '🇬🇭', dial: '+233' },
  { name: 'Guinée', flag: '🇬🇳', dial: '+224' },
  { name: 'Guinée Bissau', flag: '🇬🇼', dial: '+245' },
  { name: 'Guinée Équatoriale', flag: '🇬🇶', dial: '+240' },
  { name: 'Italie', flag: '🇮🇹', dial: '+39' },
  { name: 'Japon', flag: '🇯🇵', dial: '+81' },
  { name: 'Kenya', flag: '🇰🇪', dial: '+254' },
  { name: 'Liberia', flag: '🇱🇷', dial: '+231' },
  { name: 'Libye', flag: '🇱🇾', dial: '+218' },
  { name: 'Luxembourg', flag: '🇱🇺', dial: '+352' },
  { name: 'Madagascar', flag: '🇲🇬', dial: '+261' },
  { name: 'Mali', flag: '🇲🇱', dial: '+223' },
  { name: 'Maroc', flag: '🇲🇦', dial: '+212' },
  { name: 'Mauritanie', flag: '🇲🇷', dial: '+222' },
  { name: 'Mozambique', flag: '🇲🇿', dial: '+258' },
  { name: 'Namibie', flag: '🇳🇦', dial: '+264' },
  { name: 'Niger', flag: '🇳🇪', dial: '+227' },
  { name: 'Nigéria', flag: '🇳🇬', dial: '+234' },
  { name: 'Oman', flag: '🇴🇲', dial: '+968' },
  { name: 'Pays-Bas', flag: '🇳🇱', dial: '+31' },
  { name: 'Portugal', flag: '🇵🇹', dial: '+351' },
  { name: 'Qatar', flag: '🇶🇦', dial: '+974' },
  { name: 'République Démocratique du Congo', flag: '🇨🇩', dial: '+243' },
  { name: 'Royaume-Uni', flag: '🇬🇧', dial: '+44' },
  { name: 'Rwanda', flag: '🇷🇼', dial: '+250' },
  { name: 'Sénégal', flag: '🇸🇳', dial: '+221' },
  { name: 'Sierra Leone', flag: '🇸🇱', dial: '+232' },
  { name: 'Somalie', flag: '🇸🇴', dial: '+252' },
  { name: 'Soudan', flag: '🇸🇩', dial: '+249' },
  { name: 'Suisse', flag: '🇨🇭', dial: '+41' },
  { name: 'Tanzanie', flag: '🇹🇿', dial: '+255' },
  { name: 'Tchad', flag: '🇹🇩', dial: '+235' },
  { name: 'Togo', flag: '🇹🇬', dial: '+228' },
  { name: 'Tunisie', flag: '🇹🇳', dial: '+216' },
  { name: 'Turquie', flag: '🇹🇷', dial: '+90' },
  { name: 'Uganda', flag: '🇺🇬', dial: '+256' },
  { name: 'Zimbabwe', flag: '🇿🇼', dial: '+263' },
];

/** Pays proposés en tête de liste (communautés les plus fréquentes). */
export const POPULAR_COUNTRIES = [
  'Guinée', 'France', 'Sénégal', 'Mali', "Côte d'Ivoire", 'Cameroun', 'Belgique', 'États-Unis',
];

export function findCountry(name: string): AuthCountry | undefined {
  return AUTH_COUNTRIES.find((c) => c.name === name);
}

/** Minuscules sans accents, pour la recherche. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
