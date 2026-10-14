// apps/direct-transfair-mobile/services/serverWarmup.ts
// =========================================================
// RÉVEIL DU SERVEUR + REQUÊTES RÉSILIENTES v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
//
// POURQUOI : un serveur d'hébergement économique se met en veille après
// quelques minutes d'inactivité et met 30 à 60 s à repartir. Sans
// précaution, le premier client qui ouvre l'app voit « échec de
// connexion » alors que tout fonctionne. Ici :
//   • warmUpServer() réveille le serveur dès l'ouverture de l'app, sans
//     rien bloquer ;
//   • useServerStatus() expose son état pour l'afficher honnêtement
//     (« Le serveur démarre… ») ;
//   • authRequest() retente automatiquement les appels SÛRS (connexion,
//     demande de code) quand la panne est passagère.
// Les appels non rejouables sans risque (inscription, validation de code)
// ne sont jamais retentés automatiquement.
// =========================================================

import { useCallback, useEffect, useRef, useState } from 'react';

import { isTransientError } from '../components/auth/authErrors';
import { getApiBaseUrl } from './serverConfig';

export type ServerStatus = 'checking' | 'ready' | 'waking' | 'down';

const PING_TIMEOUT_MS = 12_000;
const PING_PAUSE_MS = 4_000;
const MAX_PINGS = 10;               // ≈ 2 minutes au total
const READY_CACHE_MS = 5 * 60_000;  // un serveur vu vivant il y a moins de 5 min n'est pas re-testé

let lastReadyAt = 0;
let inflight: Promise<boolean> | null = null;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Un seul ping : vrai si le serveur a répondu (n'importe quel statut sauf 502/503/504). */
async function pingOnce(): Promise<boolean> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS) : null;
  try {
    const res = await fetch(`${getApiBaseUrl()}/`, {
      method: 'GET',
      headers: { 'x-tenant-id': 'DONIKO', Accept: 'application/json, text/plain' },
      signal: ctrl?.signal,
    });
    return res.status !== 502 && res.status !== 503 && res.status !== 504;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Réveille le serveur et attend qu'il réponde (au plus ≈ 2 min).
 * Plusieurs appels simultanés partagent le même travail.
 * onProgress reçoit « waking » dès que le premier ping échoue.
 */
export function warmUpServer(onProgress?: (s: ServerStatus) => void): Promise<boolean> {
  if (Date.now() - lastReadyAt < READY_CACHE_MS) return Promise.resolve(true);
  if (inflight) return inflight;

  inflight = (async () => {
    for (let i = 0; i < MAX_PINGS; i++) {
      if (await pingOnce()) {
        lastReadyAt = Date.now();
        return true;
      }
      onProgress?.('waking');
      await sleep(PING_PAUSE_MS);
    }
    return false;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

/** État du serveur pour l'interface (démarre le réveil à l'ouverture de l'écran). */
export function useServerStatus(): { status: ServerStatus; retry: () => void } {
  const [status, setStatus] = useState<ServerStatus>(
    Date.now() - lastReadyAt < READY_CACHE_MS ? 'ready' : 'checking',
  );
  const alive = useRef(true);

  const run = useCallback(() => {
    if (Date.now() - lastReadyAt < READY_CACHE_MS) {
      setStatus('ready');
      return;
    }
    setStatus('checking');
    void warmUpServer((s) => alive.current && setStatus(s)).then((ok) => {
      if (alive.current) setStatus(ok ? 'ready' : 'down');
    });
  }, []);

  useEffect(() => {
    alive.current = true;
    run();
    return () => {
      alive.current = false;
    };
  }, [run]);

  return { status, retry: run };
}

/**
 * Exécute une requête et la retente (2 fois max) si la panne est passagère
 * (réseau, timeout, 502/503/504). À réserver aux appels sans effet de bord
 * dangereux en cas de rejeu (connexion, demande de code, recherche de compte).
 */
export async function authRequest<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; onRetry?: (attempt: number) => void } = {},
): Promise<T> {
  const retries = opts.retries ?? 2;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isTransientError(err)) throw err;
      attempt += 1;
      opts.onRetry?.(attempt);
      await sleep(2_500 * attempt);
    }
  }
}
