// apps/direct-transfair-mobile/hooks/useUnreadNotifications.ts
// =========================================================
// COMPTEUR DE NOTIFICATIONS NON LUES v2.0 — pastille sur la cloche.
// Comptes séparés : le client et le marchand ont chacun SA boîte de réception. Le serveur donne les deux chiffres
// (GET /notifications/unread-count → { count, bySpace: { client, merchant } }) :
//   • useUnreadNotifications()   = non lues du compte affiché (cloche de l'accueil) ;
//   • useUnreadOtherSpace()      = non lues de l'AUTRE compte (point sur la bascule « Compte client | Compte marchand »).
// Valeur partagée par tous les écrans, relue à chaque retour sur l'écran, au retour de l'app au premier plan et toutes les 45 s ;
// `refreshUnreadCount()` peut être appelée après avoir lu ou supprimé des notifications. Remise à 0 à la déconnexion.
// Ancien serveur (sans `bySpace`) : les non lues sont relues dans la liste et réparties ici par compte (voir notificationSpace) ;
// le total du serveur ne sert plus que si cette liste est inaccessible.
// =========================================================

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "../services/api";
import { notificationSpace } from "../services/notificationRouting";
import { useAuth } from "../providers/AuthProvider";
import { useAccountSpace } from "./useAccountSpace";

type Counts = { client: number; merchant: number };

let counts: Counts = { client: 0, merchant: 0 };
const listeners = new Set<() => void>();
const set = (next: Counts) => {
  if (next.client !== counts.client || next.merchant !== counts.merchant) {
    counts = next;
    listeners.forEach((l) => l());
  }
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const get = () => counts;

const toCount = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

/** Répartit les notifications non lues par compte à partir de la liste (null si elle est inaccessible). */
async function countFromList(): Promise<Counts | null> {
  try {
    const res = await api.http.get<unknown>("/notifications", { params: { unreadOnly: true, limit: 200 }, timeout: 15_000 });
    const d: any = res.data;
    const list: any[] = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : Array.isArray(d?.notifications) ? d.notifications : Array.isArray(d?.items) ? d.items : [];
    const out: Counts = { client: 0, merchant: 0 };
    for (const n of list) {
      if (!n || n.isRead) continue;
      out[notificationSpace(n)] += 1;
    }
    return out;
  } catch {
    return null;
  }
}

/** Relit les nombres de notifications non lues auprès du serveur (silencieux en cas d'échec). */
export async function refreshUnreadCount(): Promise<void> {
  try {
    const res = await api.http.get<{ count?: number; bySpace?: { client?: number; merchant?: number } }>("/notifications/unread-count", { timeout: 15_000 });
    const client = toCount(res.data?.bySpace?.client);
    const merchant = toCount(res.data?.bySpace?.merchant);
    if (client !== null && merchant !== null) { set({ client, merchant }); return; }
    // Ancien serveur : pas de répartition par compte → on la calcule à partir des notifications non lues.
    const split = await countFromList();
    if (split) { set(split); return; }
    const total = toCount(res.data?.count);
    if (total !== null) set({ client: total, merchant: 0 });
  } catch { /* réseau coupé : on garde la valeur affichée */ }
}

function useCounts(): Counts {
  const { user } = useAuth();
  const c = useSyncExternalStore(subscribe, get, get);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) { set({ client: 0, merchant: 0 }); return; }
    void refreshUnreadCount();
    const timer = setInterval(() => { void refreshUnreadCount(); }, 45_000);
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void refreshUnreadCount(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [userId]);

  useFocusEffect(useCallback(() => { if (userId) void refreshUnreadCount(); }, [userId]));

  return userId ? c : { client: 0, merchant: 0 };
}

/** Non lues du compte affiché (client ou marchand). */
export function useUnreadNotifications(): number {
  const { space } = useAccountSpace();
  const c = useCounts();
  return space === "merchant" ? c.merchant : c.client;
}

/** Non lues de l'autre compte (0 sans compte marchand) : sert à signaler un message en attente sur la bascule. */
export function useUnreadOtherSpace(): number {
  const { space, canSwitch } = useAccountSpace();
  const c = useCounts();
  if (!canSwitch) return 0;
  return space === "merchant" ? c.client : c.merchant;
}
