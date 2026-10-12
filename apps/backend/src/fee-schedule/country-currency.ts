// apps/backend/src/fee-schedule/country-currency.ts
// =========================================================
// Devise dans laquelle un pays reçoit un envoi cash (règle appliquée à la création d'un transfert).
// Mêmes pays que le barème de frais (countries.ts) ; le pays saisi à la main (« GN », « Guinée »,
// « guinee »…) est ramené à un code par toIso2(). null = pays inconnu : l'appelant garde son repli.
// =========================================================

import { toIso2 } from './countries';

export const COUNTRY_CURRENCY: Readonly<Record<string, 'XOF' | 'EUR' | 'USD' | 'GNF' | 'GBP'>> = {
  GN: 'GNF',
  SN: 'XOF', CI: 'XOF', ML: 'XOF', BF: 'XOF', BJ: 'XOF', TG: 'XOF', NE: 'XOF', GW: 'XOF',
  FR: 'EUR', DE: 'EUR', BE: 'EUR', ES: 'EUR', IT: 'EUR', PT: 'EUR', NL: 'EUR', LU: 'EUR', IE: 'EUR',
  GB: 'GBP',
  US: 'USD',
};

export function currencyOfCountry(raw: string | null | undefined): 'XOF' | 'EUR' | 'USD' | 'GNF' | 'GBP' | null {
  const code = toIso2(raw ?? null);
  return code ? (COUNTRY_CURRENCY[code] ?? null) : null;
}
