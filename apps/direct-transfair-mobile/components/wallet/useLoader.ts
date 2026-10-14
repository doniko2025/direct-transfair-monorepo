// apps/direct-transfair-mobile/components/wallet/useLoader.ts
// =========================================================
// CHARGEMENT BORNÉ v1.0 — Direct Transf'air
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Remplace les « spinners qui tournent dans le vide » : tout chargement
// a une durée maximale ; passé ce délai l'écran affiche une erreur claire
// avec « Réessayer », au lieu d'attendre indéfiniment.
//   • status : 'loading' (rien à montrer) | 'ready' | 'error' (rien à montrer et échec)
//   • slow   : vrai après SLOW_AFTER_MS de chargement (serveur qui se réveille)
//   • si des données sont déjà là, un échec de rafraîchissement est silencieux
//     (error renseigné, données conservées) : on ne vide jamais l'écran.
//   • rechargement automatique à chaque retour sur l'écran (useFocusEffect).
// Réglages : EXPO_PUBLIC_LOAD_TIMEOUT_MS (défaut 20000).
// =========================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { describeAuthError } from '../auth/authErrors';

export type LoadStatus = 'loading' | 'ready' | 'error';
export type LoadError = { title: string; message: string; timeout: boolean };

const SLOW_AFTER_MS = 4000;

export function defaultTimeoutMs(): number {
  const n = Number(process.env.EXPO_PUBLIC_LOAD_TIMEOUT_MS);
  return Number.isFinite(n) && n >= 3000 && n <= 120000 ? n : 20000;
}

class LoadTimeout extends Error {}

export function explainLoadError(err: unknown): LoadError {
  if (err instanceof LoadTimeout) {
    return {
      title: 'Le serveur met du temps à répondre',
      message: 'Il est peut-être en train de se réveiller. Réessaie dans quelques secondes.',
      timeout: true,
    };
  }
  const d = describeAuthError(err, 'generic');
  return { title: d.title, message: d.message, timeout: false };
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new LoadTimeout('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export function useLoader<T>(fetcher: () => Promise<T>, opts: { timeoutMs?: number; reloadOnFocus?: boolean } = {}) {
  const timeoutMs = opts.timeoutMs ?? defaultTimeoutMs();
  const [data, setData] = useState<T | undefined>(undefined);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<LoadError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [slow, setSlow] = useState(false);

  const seq = useRef(0);
  const hasData = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSlow = () => { if (slowTimer.current) { clearTimeout(slowTimer.current); slowTimer.current = null; } };

  const run = useCallback(async (mode: 'auto' | 'pull') => {
    const id = ++seq.current;
    if (mode === 'pull') setRefreshing(true);
    else if (!hasData.current) { setStatus('loading'); setError(null); }

    clearSlow();
    setSlow(false);
    if (!hasData.current) slowTimer.current = setTimeout(() => { if (id === seq.current) setSlow(true); }, SLOW_AFTER_MS);

    try {
      const value = await withTimeout(fetcherRef.current(), timeoutMs);
      if (id !== seq.current) return;
      hasData.current = true;
      setData(value);
      setError(null);
      setStatus('ready');
    } catch (e) {
      if (id !== seq.current) return;
      const info = explainLoadError(e);
      setError(info);
      if (!hasData.current) setStatus('error');
    } finally {
      if (id === seq.current) { clearSlow(); setSlow(false); setRefreshing(false); }
    }
  }, [timeoutMs]);

  useFocusEffect(useCallback(() => {
    if (opts.reloadOnFocus === false && hasData.current) return;
    void run('auto');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]));

  useEffect(() => () => { seq.current++; clearSlow(); }, []);

  const reload = useCallback(() => run('auto'), [run]);
  const refresh = useCallback(() => run('pull'), [run]);

  return { data, status, error, refreshing, slow, reload, refresh };
}
