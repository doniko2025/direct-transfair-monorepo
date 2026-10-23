// packages/shared/src/idempotency.ts
// =========================================================
// IDEMPOTENCE côté client v1.0 — Direct Transf'air (audit backend, point 3)
//
// Une intention d'argent (envoi, dépôt, remise, recharge d'agence) porte une clé unique envoyée dans l'en-tête
// Idempotency-Key. Le serveur renvoie l'opération déjà créée au lieu d'en débiter une seconde si la même clé revient.
//
// Règle de la clé :
//   - même intention (même route + même corps) tant que l'issue est INCERTAINE → MÊME clé : un double-tap, ou un
//     nouvel essai après coupure réseau / délai dépassé / erreur 5xx, ne peut pas créer un second débit ;
//   - dès qu'une réponse définitive arrive (succès, ou refus 4xx : solde insuffisant, validation…), l'intention est
//     close : la prochaine action identique est une NOUVELLE intention, donc une nouvelle clé ;
//   - une intention incertaine est oubliée après 10 minutes.
// =========================================================

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

const DEFAULT_TTL_MS = 10 * 60_000;

export interface IdempotencyTracker {
  /** Clé de l'intention décrite par `signature` (créée si elle n'existe pas encore, sinon réutilisée). */
  keyFor(signature: string): string;
  /** L'intention a reçu une réponse définitive : la suivante sera nouvelle. */
  settle(signature: string): void;
}

function defaultUuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Repli (anciens environnements) : suffisamment aléatoire pour une clé d'idempotence.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function createIdempotencyTracker(
  ttlMs: number = DEFAULT_TTL_MS,
  now: () => number = Date.now,
  uuid: () => string = defaultUuid,
): IdempotencyTracker {
  const pending = new Map<string, { key: string; at: number }>();

  return {
    keyFor(signature) {
      const t = now();
      for (const [sig, entry] of pending) if (t - entry.at > ttlMs) pending.delete(sig);
      const existing = pending.get(signature);
      if (existing) return existing.key;
      const key = uuid();
      pending.set(signature, { key, at: t });
      return key;
    },
    settle(signature) {
      pending.delete(signature);
    },
  };
}

/** Issue incertaine : pas de réponse (réseau, délai), délai d'attente serveur, ou erreur serveur 5xx. */
export function isAmbiguousFailure(err: unknown): boolean {
  const status = (err as { status?: unknown })?.status;
  if (typeof status !== 'number') return true; // erreur inconnue : on garde la clé par prudence
  return status === 0 || status === 408 || status >= 500;
}

/** Exécute `run(key)` avec la clé de l'intention, et ferme l'intention sur toute réponse définitive. */
export async function withIdempotency<T>(
  tracker: IdempotencyTracker,
  signature: string,
  run: (key: string) => Promise<T>,
): Promise<T> {
  const key = tracker.keyFor(signature);
  try {
    const result = await run(key);
    tracker.settle(signature);
    return result;
  } catch (err) {
    if (!isAmbiguousFailure(err)) tracker.settle(signature);
    throw err;
  }
}
