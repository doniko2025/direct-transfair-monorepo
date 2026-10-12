// src/lib/countries.ts
// Pays proposés pour le propriétaire d'une société. Le backend déduit la devise
// par défaut de la société des 2 premières lettres du pays (COUNTRY_TO_CURRENCY
// dans clients.service.ts) : on envoie donc toujours le code ISO alpha-2.
// Tout pays absent de cette table retombe sur XOF côté serveur.

import type { CurrencyCode } from '@direct-transfair/shared';

export interface CountryOption {
  code: string;
  name: string;
  currency: CurrencyCode;
}

export const COUNTRIES: readonly CountryOption[] = [
  { code: 'GN', name: 'Guinée', currency: 'GNF' },
  { code: 'SN', name: 'Sénégal', currency: 'XOF' },
  { code: 'CI', name: "Côte d'Ivoire", currency: 'XOF' },
  { code: 'ML', name: 'Mali', currency: 'XOF' },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF' },
  { code: 'BJ', name: 'Bénin', currency: 'XOF' },
  { code: 'TG', name: 'Togo', currency: 'XOF' },
  { code: 'NE', name: 'Niger', currency: 'XOF' },
  { code: 'GW', name: 'Guinée-Bissau', currency: 'XOF' },
  { code: 'FR', name: 'France', currency: 'EUR' },
  { code: 'DE', name: 'Allemagne', currency: 'EUR' },
  { code: 'BE', name: 'Belgique', currency: 'EUR' },
  { code: 'ES', name: 'Espagne', currency: 'EUR' },
  { code: 'IT', name: 'Italie', currency: 'EUR' },
  { code: 'PT', name: 'Portugal', currency: 'EUR' },
  { code: 'NL', name: 'Pays-Bas', currency: 'EUR' },
  { code: 'LU', name: 'Luxembourg', currency: 'EUR' },
  { code: 'IE', name: 'Irlande', currency: 'EUR' },
  { code: 'GB', name: 'Royaume-Uni', currency: 'GBP' },
  { code: 'US', name: 'États-Unis', currency: 'USD' },
];

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  return COUNTRIES.find((c) => c.code === upper)?.name ?? code;
}
