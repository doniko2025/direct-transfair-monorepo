// apps/direct-transfair-mobile/hooks/useUnreadNotifications.ts
// =========================================================
// COMPTEUR DE NOTIFICATIONS NON LUES v1.0 — pastille sur la cloche.
// Valeur donnée par le serveur (GET /notifications/unread-count), partagée par tous les écrans :
//   • relue à chaque retour sur l'écran, au retour de l'app au premier plan et toutes les 45 s ;
//   • `refreshUnreadCount()` peut être appelée après avoir lu ou supprimé des notifications (le badge suit tout de suite) ;
//   • remise à 0 à la déconnexion. Un échec réseau garde la valeur affichée.
// =========================================================

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../services/api";
import { useAuth } from "../providers/AuthProvider";

let count = 0;
const listeners = new Set<() => void>();
const set = (n: number) => { if (n !== count) { count = n; listeners.forEach((l) => l()); } };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const get = () => count;

/** Relit le nombre de notifications non lues auprès du serveur (silencieux en cas d'échec). */
export async function refreshUnreadCount(): Promise<void> {
  try {
    const res = await api.http.get<{ count?: number }>("/notifications/unread-count", { timeout: 15_000 });
    const n = Number(res.data?.count);
    if (Number.isFinite(n) && n >= 0) set(Math.floor(n));
  } catch { /* réseau coupé : on garde la valeur affichée */ }
}

export function useUnreadNotifications(): number {
  const { user } = useAuth();
  const n = useSyncExternalStore(subscribe, get, get);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) { set(0); return; }
    void refreshUnreadCount();
    const timer = setInterval(() => { void refreshUnreadCount(); }, 45_000);
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void refreshUnreadCount(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [userId]);

  useFocusEffect(useCallback(() => { if (userId) void refreshUnreadCount(); }, [userId]));

  return userId ? n : 0;
}
