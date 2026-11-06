// src/lib/tokenStorage.ts
// Stockage des jetons côté navigateur — version « cookie httpOnly » (étape sécurité).
//
//   - Refresh token (30 jours) : posé par le serveur dans un cookie httpOnly, donc ILLISIBLE depuis JavaScript. Une faille XSS ne
//     peut plus le voler. Rien n'en est stocké ici.
//   - Jeton d'accès (1 heure) : gardé en MÉMOIRE seulement (jamais dans localStorage). Après un rechargement de page, le client
//     en obtient un nouveau via /auth/refresh (le cookie part tout seul).
//   - Un simple indicateur « une session existe » (dtw.session = "1", sans aucun secret) évite d'appeler le serveur pour rien
//     quand personne n'est connecté.
//
// L'interface TokenStorage est celle de @direct-transfair/shared.

import type { TokenStorage } from '@direct-transfair/shared';

const SESSION_HINT_KEY = 'dtw.session';
// Anciennes clés (versions précédentes : jetons en clair dans localStorage) : effacées au premier chargement.
const LEGACY_KEYS = ['dtw.access', 'dtw.refresh'];

export function createBrowserTokenStorage(): TokenStorage {
  let memAccess: string | null = null;
  let memHint = false;

  const safe = <T,>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch {
      return fallback; // stockage indisponible (navigation privée, bloqué…)
    }
  };

  safe(() => LEGACY_KEYS.forEach((k) => window.localStorage.removeItem(k)), undefined);

  return {
    getAccessToken: () => memAccess,
    getRefreshToken: () => null, // jamais lisible : cookie httpOnly
    setTokens(access) {
      memAccess = access;
      memHint = true;
      safe(() => window.localStorage.setItem(SESSION_HINT_KEY, '1'), undefined);
    },
    clear() {
      memAccess = null;
      memHint = false;
      safe(() => window.localStorage.removeItem(SESSION_HINT_KEY), undefined);
    },
    hasSession: () => memHint || safe(() => window.localStorage.getItem(SESSION_HINT_KEY) === '1', false),
  };
}
