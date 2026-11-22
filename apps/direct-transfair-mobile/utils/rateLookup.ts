// utils/rateLookup.ts
// Taux de change pour l'AFFICHAGE : uniquement ceux publiés par la société (GET /exchange-rates?code=…, taux par société).
// Aucun taux écrit en dur : si le couple n'est pas publié, on renvoie null et l'écran n'affiche aucune estimation.
// Le montant réellement reçu est toujours calculé par le serveur avec le taux enregistré.
// v1.1 : le taux affiché est NET de la marge de change de la société (customerFactor), comme le montant que le serveur crédite.

export interface RateRow {
  pair: string;
  rate: number;
  /** Marge de change de la société (%), identique sur toutes les lignes : GET /exchange-rates la publie avec chaque taux. */
  fxMarginPct?: number | null;
}

/** Plafond du serveur (rates-admin/rate-rules.ts) : une valeur au-delà est ignorée plutôt que d'afficher un taux absurde. */
const MAX_MARGIN_PCT = 10;

/**
 * Facteur à appliquer à tout taux AFFICHÉ au client : taux publié × (1 − marge/100). 1 quand la société n'a pas de marge.
 * Même formule que le serveur (fxFactor) : le client voit exactement ce qu'il recevra. Appliquer UNE seule fois, après le sens
 * direct, inverse ou le passage par l'euro (jamais sur chaque jambe).
 */
export function customerFactor(rates: readonly { fxMarginPct?: number | null }[]): number {
  for (const r of rates) {
    const m = Number(r?.fxMarginPct);
    if (Number.isFinite(m) && m > 0) return 1 - Math.min(m, MAX_MARGIN_PCT) / 100;
  }
  return 1;
}

const valid = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/** 1 `from` = ? `to`. Cherche le sens direct, l'inverse, puis passe par l'euro. Null si rien n'est publié. */
export function lookupRate(rates: readonly RateRow[], from: string, to: string): number | null {
  const a = (from || "").toUpperCase();
  const b = (to || "").toUpperCase();
  if (!a || !b) return null;
  if (a === b) return 1;

  const find = (x: string, y: string): number | null => {
    const hit = rates.find((r) => r.pair === `${x}_${y}` || r.pair === `${x}/${y}`);
    return hit && valid(hit.rate) ? hit.rate : null;
  };
  const direct = (x: string, y: string): number | null => {
    const d = find(x, y);
    if (d !== null) return d;
    const inv = find(y, x);
    return inv !== null ? 1 / inv : null;
  };

  const f = customerFactor(rates);
  const one = direct(a, b);
  if (one !== null) return one * f;
  if (a === "EUR" || b === "EUR") return null;

  const aToEur = direct(a, "EUR");
  const eurToB = direct("EUR", b);
  return aToEur !== null && eurToB !== null ? aToEur * eurToB * f : null;
}
