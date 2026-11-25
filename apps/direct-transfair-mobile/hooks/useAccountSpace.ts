// apps/direct-transfair-mobile/hooks/useAccountSpace.ts
// =========================================================
// COMPTE ACTIF v1.1 — « Compte client » ou « Compte marchand ».
// ✅ v1.1 : le compte CLIENT s'affiche par défaut (avant : « marchand » dès qu'un compte marchand existait). À chaque connexion l'application s'ouvre sur le
//    compte client (AuthProvider appelle startClientSession) ; la bascule vers « marchand » reste un choix de la personne. L'état partagé vit maintenant
//    dans services/accountSpaceStore.ts (pas de dépendance circulaire avec AuthProvider) ; le type AccountSpace est toujours exporté d'ici.
// Une même personne peut avoir les deux : ce sont deux comptes SÉPARÉS (solde, opérations, menus) entre lesquels on bascule.
//   • sans compte marchand : toujours « client », rien à choisir ;
//   • avec un compte marchand : « client » par défaut, « marchand » si la personne l'a choisi pendant la session (mémorisé sur l'appareil,
//     par utilisateur, et retrouvé si l'application est simplement rouverte sans déconnexion).
// Un seul état partagé par tous les écrans (accueil, barre d'onglets, activité, profil) : basculer met tout à jour en même temps.
// =========================================================

import { useCallback, useEffect, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../providers/AuthProvider";
import {
  accountSpaceKey, getAccountSpaceState, setAccountSpaceState, subscribeAccountSpace,
  type AccountSpace,
} from "../services/accountSpaceStore";

export type { AccountSpace };

let loadingFor: string | null = null;

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
  const store = useSyncExternalStore(subscribeAccountSpace, getAccountSpaceState, getAccountSpaceState);
  const userId = user?.id ?? null;
  const hasMerchant = user?.accountType === "MERCHANT";

  useEffect(() => {
    const state = getAccountSpaceState();
    if (!userId) {
      loadingFor = null;
      if (state.userId !== null) setAccountSpaceState({ userId: null, space: null, loaded: false });
      return;
    }
    if (state.userId === userId && (state.loaded || loadingFor === userId)) return;
    loadingFor = userId;
    setAccountSpaceState({ userId, space: null, loaded: false });
    AsyncStorage.getItem(accountSpaceKey(userId))
      .then((v) => {
        const cur = getAccountSpaceState();
        // `!cur.loaded` : si une connexion a entre-temps imposé « client » (startClientSession), cette ancienne lecture ne l'écrase pas.
        if (cur.userId === userId && !cur.loaded) setAccountSpaceState({ space: v === "merchant" || v === "client" ? v : null, loaded: true });
      })
      .catch(() => { if (getAccountSpaceState().userId === userId) setAccountSpaceState({ loaded: true }); });
  }, [userId]);

  const mine = store.userId === userId;
  const stored = mine ? store.space : null;
  // v1.1 : « client » par défaut ; « marchand » seulement si la personne l'a choisi.
  const space: AccountSpace = hasMerchant && stored === "merchant" ? "merchant" : "client";
  const ready = !!userId && (!hasMerchant || (mine && store.loaded));

  const switchTo = useCallback((next: AccountSpace) => {
    if (!userId || (next === "merchant" && !hasMerchant)) return;
    setAccountSpaceState({ userId, space: next, loaded: true });
    AsyncStorage.setItem(accountSpaceKey(userId), next).catch(() => { /* sans incidence : le choix reste valable jusqu'à la fermeture */ });
  }, [userId, hasMerchant]);

  return { space, isMerchant: space === "merchant", canSwitch: hasMerchant, ready, switchTo };
}
