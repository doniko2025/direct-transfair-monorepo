// src/lib/useMediaQuery.ts
// Vrai tant que la requête média correspond (ex. « (max-width: 640px) » = mobile).
// Sert aux rares cas où le texte lui-même change (libellé court d'un filtre) : pour tout
// le reste, le CSS suffit.

import { useSyncExternalStore } from 'react';

export const MOBILE_QUERY = '(max-width: 640px)';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => mql.removeEventListener('change', notify);
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}
