// apps/direct-transfair-mobile/services/idempotency.ts
// =========================================================
// IDEMPOTENCE v1.0 — Direct Transf'air (audit backend, point 3)
//
// Un double-tap, ou une coupure réseau suivie d'un nouvel essai, ne doit pas créer un second débit. Chaque intention
// d'argent (envoi, dépôt…) porte une clé unique, envoyée au serveur (champ `idempotencyKey` du corps, ou en-tête
// Idempotency-Key). Le serveur renvoie l'opération déjà créée si la même clé revient.
//
// Règle de la clé :
//   - même intention (même signature) tant que l'issue est INCERTAINE (pas de réponse, délai dépassé, erreur 5xx) →
//     MÊME clé : le nouvel essai ne peut pas débiter deux fois ;
//   - dès qu'une réponse définitive arrive (succès, ou refus 4xx : solde insuffisant, validation…), l'intention est
//     close : la prochaine action identique est une NOUVELLE intention → nouvelle clé ;
//   - une intention incertaine est oubliée après 10 minutes.
// Même logique que packages/shared/src/idempotency.ts (web-admin), adaptée aux erreurs axios.
// =========================================================

const TTL_MS = 10 * 60_000;
const pending = new Map<string, { key: string; at: number }>();

function newKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Issue incertaine : aucune réponse du serveur (réseau, délai), 408, ou erreur serveur 5xx. */
export function isAmbiguousFailure(err: unknown): boolean {
  const status = (err as { response?: { status?: unknown } })?.response?.status;
  if (typeof status !== "number") return true; // pas de réponse (ou erreur inconnue) : on garde la clé par prudence
  return status === 408 || status >= 500;
}

/**
 * Exécute `run(key)` avec la clé de l'intention décrite par `signature` (ex. JSON du corps de la requête).
 * Deux appels simultanés avec la même signature (double-tap) partagent la même clé.
 */
export async function runOnce<T>(signature: string, run: (key: string) => Promise<T>): Promise<T> {
  const now = Date.now();
  for (const [sig, entry] of pending) if (now - entry.at > TTL_MS) pending.delete(sig);

  let entry = pending.get(signature);
  if (!entry) {
    entry = { key: newKey(), at: now };
    pending.set(signature, entry);
  }

  try {
    const result = await run(entry.key);
    pending.delete(signature);
    return result;
  } catch (err) {
    if (!isAmbiguousFailure(err)) pending.delete(signature);
    throw err;
  }
}
