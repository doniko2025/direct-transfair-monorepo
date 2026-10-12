// src/lib/dialCodes.ts
// Indicatifs téléphoniques des pays proposés (mêmes pays que lib/countries.ts).
// Le serveur normalise les numéros au format international (E.164) : on lui envoie « +indicatif + numéro ».

export interface DialCode {
  /** Code ISO alpha-2 du pays. */
  country: string;
  dial: string;
}

export const DIAL_CODES: readonly DialCode[] = [
  { country: 'GN', dial: '224' },
  { country: 'SN', dial: '221' },
  { country: 'CI', dial: '225' },
  { country: 'ML', dial: '223' },
  { country: 'BF', dial: '226' },
  { country: 'BJ', dial: '229' },
  { country: 'TG', dial: '228' },
  { country: 'NE', dial: '227' },
  { country: 'GW', dial: '245' },
  { country: 'FR', dial: '33' },
  { country: 'DE', dial: '49' },
  { country: 'BE', dial: '32' },
  { country: 'ES', dial: '34' },
  { country: 'IT', dial: '39' },
  { country: 'PT', dial: '351' },
  { country: 'NL', dial: '31' },
  { country: 'LU', dial: '352' },
  { country: 'IE', dial: '353' },
  { country: 'GB', dial: '44' },
  { country: 'US', dial: '1' },
];

export function dialOf(country: string): string | null {
  return DIAL_CODES.find((d) => d.country === country.toUpperCase())?.dial ?? null;
}
