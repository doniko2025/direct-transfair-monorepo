// apps/direct-transfair-mobile/hooks/useMyReferral.ts
// =========================================================
// useMyReferral v1.0 — parrainage du client (lot 16) : vrai code de parrainage, filleuls, envois sans frais restants.
// Dernière valeur gardée en mémoire : l'écran d'envoi et l'accueil n'attendent pas le réseau pour l'afficher.
// Jamais bloquant : une panne laisse data = null (aucun envoi offert affiché, le serveur reste seul juge à l'envoi).
// =========================================================

import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "../services/api";
import type { MyReferral } from "../services/growthTypes";

let cache: { userId: string; value: MyReferral } | null = null;

export function useMyReferral(userId: string | undefined, enabled = true) {
  const [data, setData] = useState<MyReferral | null>(cache && cache.userId === userId ? cache.value : null);
  const [loading, setLoading] = useState(!data);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled || !userId) return;
    try {
      const value = await api.getMyReferral();
      cache = { userId, value };
      setData(value);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [enabled, userId]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  return { data, loading, failed, reload };
}
