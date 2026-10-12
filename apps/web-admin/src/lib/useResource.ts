// src/lib/useResource.ts
// Chargement d'une ressource avec états loading / error et rechargement manuel.
// Une réponse arrivée après un changement de dépendance ou un démontage est ignorée.

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Resource<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

export function useResource<T>(loader: () => Promise<T>, deps: readonly unknown[]): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => {
    // `loading` passe à vrai dans le même rendu que la demande : un appelant qui attend « loading = faux »
    // ne voit jamais les anciennes données comme si elles étaient à jour.
    setLoading(true);
    setTick((t) => t + 1);
  }, []);
  return { data, error, loading, reload };
}
