// src/lib/tokenStorage.ts
// Stockage des tokens côté navigateur (localStorage, avec repli mémoire si
// le navigateur le refuse : navigation privée, stockage bloqué…).
//
// ⚠️ localStorage est lisible par n'importe quel script de la page : c'est
// le même niveau de protection que le mobile aujourd'hui. Le passage aux
// cookies httpOnly est prévu à l'étape sécurité ; il suffira de remplacer
// ce fichier (l'interface TokenStorage est celle de @direct-transfair/shared).

import type { TokenStorage } from '@direct-transfair/shared';

const ACCESS_KEY = 'dtw.access';
const REFRESH_KEY = 'dtw.refresh';

export function createBrowserTokenStorage(): TokenStorage {
  let memAccess: string | null = null;
  let memRefresh: string | null = null;

  const read = (key: string, fallback: string | null): string | null => {
    try {
      return window.localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  };

  const write = (key: string, value: string | null): void => {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      /* stockage indisponible : la valeur reste en mémoire */
    }
  };

  return {
    getAccessToken: () => read(ACCESS_KEY, memAccess),
    getRefreshToken: () => read(REFRESH_KEY, memRefresh),
    setTokens(access, refresh) {
      memAccess = access;
      write(ACCESS_KEY, access);
      if (refresh) {
        memRefresh = refresh;
        write(REFRESH_KEY, refresh);
      }
    },
    clear() {
      memAccess = null;
      memRefresh = null;
      write(ACCESS_KEY, null);
      write(REFRESH_KEY, null);
    },
  };
}
