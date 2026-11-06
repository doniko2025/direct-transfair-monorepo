// utils/rateLookup.ts
// Taux de change pour l'AFFICHAGE : uniquement ceux publiés par la plateforme (GET /exchange-rates).
// Aucun taux écrit en dur : si le couple n'est pas publié, on renvoie null et l'écran n'affiche aucune estimation.
// Le montant réellement reçu est toujours calculé par le serveur avec le taux enregistré.

export interface RateRow {
  pair: string;
  rate: number;
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

  const one = direct(a, b);
  if (one !== null) return one;
  if (a === "EUR" || b === "EUR") return null;

  const aToEur = direct(a, "EUR");
  const eurToB = direct("EUR", b);
  return aToEur !== null && eurToB !== null ? aToEur * eurToB : null;
}
