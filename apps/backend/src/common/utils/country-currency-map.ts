// apps/backend/src/common/utils/country-currency-map.ts
// =========================================================
// Table UNIQUE « code pays ISO-2 → devise principale du compte ».
// Avant : 5 copies recopiées dans auth, users, clients, agencies et transactions, qui avaient
// divergé (clients/agences ignoraient CY, EE, LT, LV, MT, SI, SK → XOF à tort ; transactions
// ignorait AT, FI, GR, IE, IT, LU, NL…). Ajouter un pays = UNE seule ligne, ici.
// NB : le barème de frais garde sa propre table (fee-schedule/country-currency.ts) : elle ne
// liste que les pays où l'on peut ENVOYER/RECEVOIR un transfert, pas la devise d'un compte.
// =========================================================
import { CurrencyCode } from '@prisma/client';

export const COUNTRY_TO_CURRENCY: Readonly<Record<string, CurrencyCode>> = {
  FR: CurrencyCode.EUR, DE: CurrencyCode.EUR, IT: CurrencyCode.EUR,
  ES: CurrencyCode.EUR, BE: CurrencyCode.EUR, PT: CurrencyCode.EUR,
  NL: CurrencyCode.EUR, AT: CurrencyCode.EUR, FI: CurrencyCode.EUR,
  IE: CurrencyCode.EUR, LU: CurrencyCode.EUR, GR: CurrencyCode.EUR,
  SI: CurrencyCode.EUR, SK: CurrencyCode.EUR, EE: CurrencyCode.EUR,
  LT: CurrencyCode.EUR, LV: CurrencyCode.EUR, MT: CurrencyCode.EUR, CY: CurrencyCode.EUR,
  GB: CurrencyCode.GBP, GG: CurrencyCode.GBP, JE: CurrencyCode.GBP, IM: CurrencyCode.GBP,
  US: CurrencyCode.USD, SV: CurrencyCode.USD, PA: CurrencyCode.USD, EC: CurrencyCode.USD,
  GN: CurrencyCode.GNF,
  SN: CurrencyCode.XOF, CI: CurrencyCode.XOF, ML: CurrencyCode.XOF, BF: CurrencyCode.XOF,
  BJ: CurrencyCode.XOF, TG: CurrencyCode.XOF, NE: CurrencyCode.XOF, GW: CurrencyCode.XOF,
};
