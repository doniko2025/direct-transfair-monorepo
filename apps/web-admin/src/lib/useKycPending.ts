// src/lib/useKycPending.ts
// Nombre de dossiers d'identité en attente, pour la pastille du menu (administrateurs seulement).
// Rafraîchi toutes les 90 s et au retour sur l'onglet ; une panne réseau laisse simplement la pastille telle quelle.

import { useEffect, useState } from 'react';
import { api } from './api';

export function useKycPending(enabled: boolean): number {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setPending(0);
      return;
    }
    let cancelled = false;
    const load = () => {
      api.kyc
        .adminStats()
        .then((s) => {
          if (!cancelled) setPending(s.pending);
        })
        .catch(() => undefined);
    };
    load();
    const timer = setInterval(load, 90_000);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);

  return pending;
}
