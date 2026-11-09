// apps/backend/src/rates/rate-resolver.ts
// =========================================================
// RATE RESOLVER v1.0 — choix du taux de change à partir des taux ENREGISTRÉS en base. Fonction pure.
//
// RÈGLE : aucun taux n'est écrit dans le code. Si la base ne permet pas de calculer la conversion, il n'y a pas de
// conversion (l'appelant refuse l'opération) : un taux inventé, ou resté en dur depuis des mois, fausse silencieusement
// chaque montant reçu, chaque commission et chaque seuil de contrôle.
//
// Ordre de résolution (le premier qui existe l'emporte) :
//   1. taux direct          A_B
//   2. taux inverse         1 / B_A
//   3. pivot EUR            A→EUR puis EUR→B (chaque étape : direct ou inverse), en base uniquement
// Le format canonique « EUR_XOF » est préféré à l'ancien « EUR/XOF » quand les deux existent.
// Un taux nul, négatif ou non fini est ignoré. Un taux plus ancien que `maxAgeMs` (si fourni) est refusé.
// =========================================================

export interface RateRowLike {
  pair: string;
  rate: unknown;
  updatedAt?: Date | null;
}

export type RateResolution = { ok: true; rate: number; via: 'DIRECT' | 'INVERSE' | 'PIVOT_EUR' } | { ok: false; reason: 'MISSING' | 'STALE' };

export interface ResolveOptions {
  /** Ancienneté maximale d'un taux. Absent = pas de contrôle d'ancienneté. */
  maxAgeMs?: number;
  now?: Date;
}

const norm = (c: string) => c.toUpperCase().trim();

/** Toutes les chaînes de paire à lire en base pour résoudre from → to (direct, inverse, pivot EUR ; deux formats). */
export function candidatePairs(from: string, to: string): string[] {
  const a = norm(from);
  const b = norm(to);
  const legs: [string, string][] = [[a, b], [b, a], [a, 'EUR'], ['EUR', a], ['EUR', b], [b, 'EUR']];
  const out = new Set<string>();
  for (const [x, y] of legs) {
    if (x === y) continue;
    out.add(`${x}_${y}`);
    out.add(`${x}/${y}`);
  }
  return [...out];
}

export function resolveRate(rows: readonly RateRowLike[], from: string, to: string, opts: ResolveOptions = {}): RateResolution {
  const a = norm(from);
  const b = norm(to);
  if (a === b) return { ok: true, rate: 1, via: 'DIRECT' };

  const now = (opts.now ?? new Date()).getTime();
  let sawStale = false;

  const usable = (row: RateRowLike | undefined): number | null => {
    if (!row) return null;
    const n = Number(row.rate);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (opts.maxAgeMs !== undefined && row.updatedAt && now - row.updatedAt.getTime() > opts.maxAgeMs) {
      sawStale = true;
      return null;
    }
    return n;
  };

  const find = (x: string, y: string): RateRowLike | undefined =>
    rows.find((r) => r.pair === `${x}_${y}`) ?? rows.find((r) => r.pair === `${x}/${y}`);

  /** Taux x → y, dans le sens direct ou inverse. */
  const leg = (x: string, y: string): { rate: number; inverse: boolean } | null => {
    const d = usable(find(x, y));
    if (d !== null) return { rate: d, inverse: false };
    const i = usable(find(y, x));
    if (i !== null) return { rate: 1 / i, inverse: true };
    return null;
  };

  const direct = leg(a, b);
  if (direct) return { ok: true, rate: direct.rate, via: direct.inverse ? 'INVERSE' : 'DIRECT' };

  if (a !== 'EUR' && b !== 'EUR') {
    const first = leg(a, 'EUR');
    const second = leg('EUR', b);
    if (first && second) return { ok: true, rate: first.rate * second.rate, via: 'PIVOT_EUR' };
  }

  return { ok: false, reason: sawStale ? 'STALE' : 'MISSING' };
}

/** Âge maximal par défaut d'un taux en production quand RATE_MAX_AGE_HOURS n'est pas posé (heures). */
export const DEFAULT_PROD_RATE_MAX_AGE_HOURS = 48;

/**
 * Âge maximal toléré d'un taux enregistré, en millisecondes (undefined = aucun contrôle).
 *  - RATE_MAX_AGE_HOURS > 0 : cette limite ;
 *  - RATE_MAX_AGE_HOURS = 0 (ou « off ») : contrôle désactivé volontairement ;
 *  - non posé : 48 h en production (un taux oublié ne doit jamais servir indéfiniment), aucun contrôle ailleurs (dev, tests).
 */
export function resolveMaxAgeMs(env: { RATE_MAX_AGE_HOURS?: string; NODE_ENV?: string } = process.env): number | undefined {
  const raw = (env.RATE_MAX_AGE_HOURS ?? '').trim();
  if (raw !== '') {
    const hours = Number(raw);
    return Number.isFinite(hours) && hours > 0 ? hours * 3_600_000 : undefined;
  }
  return env.NODE_ENV === 'production' ? DEFAULT_PROD_RATE_MAX_AGE_HOURS * 3_600_000 : undefined;
}
