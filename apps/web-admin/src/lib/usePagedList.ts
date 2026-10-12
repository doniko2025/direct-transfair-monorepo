// src/lib/usePagedList.ts
// Liste paginée côté serveur avec « Afficher plus ».
//   - un changement de dépendances (filtre) repart de la première page, liste vidée ;
//   - reload() rafraîchit la première page en gardant l'ancienne liste affichée ;
//   - une réponse arrivée après un changement de filtre ou un démontage est ignorée ;
//   - les lignes déjà reçues ne sont jamais dupliquées (de nouvelles entrées décalent la pagination).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Page } from '@direct-transfair/shared';

export interface PagedList<T> {
  items: T[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: unknown;
  moreError: unknown;
  reload: () => void;
  loadMore: () => void;
}

export function usePagedList<T extends { id: string }>(
  fetchPage: (page: number) => Promise<Page<T>>,
  deps: readonly unknown[],
): PagedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [moreError, setMoreError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);

  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const generation = useRef(0);

  // Autre filtre : on ne garde pas la liste d'un filtre précédent.
  useEffect(() => {
    setItems([]);
    setTotal(0);
    setPage(0);
    setTotalPages(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps]);

  useEffect(() => {
    const mine = ++generation.current;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setMoreError(null);
    fetchRef
      .current(1)
      .then((result) => {
        if (generation.current !== mine) return;
        setItems(result.data);
        setTotal(result.meta.total);
        setPage(1);
        setTotalPages(result.meta.totalPages);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (generation.current !== mine) return;
        setError(err);
        setLoading(false);
      });
    return () => {
      generation.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => {
    setLoading(true);
    setTick((t) => t + 1);
  }, []);

  const loadMore = useCallback(() => {
    const mine = generation.current;
    setLoadingMore(true);
    setMoreError(null);
    fetchRef
      .current(page + 1)
      .then((result) => {
        if (generation.current !== mine) return;
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...result.data.filter((i) => !seen.has(i.id))];
        });
        setTotal(result.meta.total);
        setPage(page + 1);
        setTotalPages(result.meta.totalPages);
        setLoadingMore(false);
      })
      .catch((err: unknown) => {
        if (generation.current !== mine) return;
        setMoreError(err);
        setLoadingMore(false);
      });
  }, [page]);

  return { items, total, loading, loadingMore, hasMore: page > 0 && page < totalPages, error, moreError, reload, loadMore };
}
