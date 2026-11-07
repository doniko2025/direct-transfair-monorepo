// apps/direct-transfair-mobile/hooks/useAccountSpace.ts
// =========================================================
// COMPTE ACTIF v1.0 — « Compte client » ou « Compte marchand ».
// Une même personne peut avoir les deux : ce sont deux comptes SÉPARÉS (solde, opérations, menus) entre lesquels on bascule.
//   • sans compte marchand : toujours « client », rien à choisir ;
//   • avec un compte marchand : « marchand » par défaut, « client » si la personne l'a choisi ; le choix est mémorisé
//     sur l'appareil (par utilisateur) et retrouvé à la reconnexion.
// Un seul état partagé par tous les écrans (accueil, barre d'onglets, activité, profil) : basculer met tout à jour en même temps.
// =========================================================

import { useCallback, useEffect, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../providers/AuthProvider";

export type AccountSpace = "client" | "merchant";

type Store = { userId: string | null; space: AccountSpace | null; loaded: boolean };

const KEY = (userId: string) => `dt.accountSpace.${userId}`;

let state: Store = { userId: null, space: null, loaded: false };
let loadingFor: string | null = null;
const listeners = new Set<() => void>();

function set(next: Partial<Store>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getState = () => state;

export function useAccountSpace(): {
  space: AccountSpace;
  isMerchant: boolean;
  /** Vrai quand la personne a un compte marchand en plus de son compte client. */
  canSwitch: boolean;
  /** Faux tant que le choix mémorisé n'est pas relu (évite d'afficher un instant le mauvais compte). */
  ready: boolean;
  switchTo: (next: AccountSpace) => void;
} {
  const { user } = useAuth();
  const store = useSyncExternalStore(subscribe, getState, getState);
  const userId = user?.id ?? null;
  const hasMerchant = user?.accountType === "MERCHANT";

  useEffect(() => {
    if (!userId) {
      loadingFor = null;
      if (state.userId !== null) set({ userId: null, space: null, loaded: false });
      return;
    }
    if (state.userId === userId && (state.loaded || loadingFor === userId)) return;
    loadingFor = userId;
    set({ userId, space: null, loaded: false });
    AsyncStorage.getItem(KEY(userId))
      .then((v) => { if (state.userId === userId) set({ space: v === "merchant" || v === "client" ? v : null, loaded: true }); })
      .catch(() => { if (state.userId === userId) set({ loaded: true }); });
  }, [userId]);

  const mine = store.userId === userId;
  const stored = mine ? store.space : null;
  const space: AccountSpace = hasMerchant ? (stored === "client" ? "client" : "merchant") : "client";
  const ready = !!userId && (!hasMerchant || (mine && store.loaded));

  const switchTo = useCallback((next: AccountSpace) => {
    if (!userId || (next === "merchant" && !hasMerchant)) return;
    set({ userId, space: next, loaded: true });
    AsyncStorage.setItem(KEY(userId), next).catch(() => { /* sans incidence : le choix reste valable jusqu'à la fermeture */ });
  }, [userId, hasMerchant]);

  return { space, isMerchant: space === "merchant", canSwitch: hasMerchant, ready, switchTo };
}
