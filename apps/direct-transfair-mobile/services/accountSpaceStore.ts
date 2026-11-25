// apps/direct-transfair-mobile/services/accountSpaceStore.ts
// =========================================================
// ÉTAT PARTAGÉ DU COMPTE ACTIF (« client » / « marchand ») v1.0
// Extrait de hooks/useAccountSpace.ts pour que le fournisseur d'authentification puisse REMETTRE le compte « client » à chaque connexion
// sans importer le hook (le hook importe AuthProvider : un import dans l'autre sens aurait créé une dépendance circulaire).
// Aucun import de React ni d'AuthProvider ici.
// =========================================================

import AsyncStorage from "@react-native-async-storage/async-storage";

export type AccountSpace = "client" | "merchant";

export type AccountSpaceStore = { userId: string | null; space: AccountSpace | null; loaded: boolean };

export const accountSpaceKey = (userId: string) => `dt.accountSpace.${userId}`;

let state: AccountSpaceStore = { userId: null, space: null, loaded: false };
const listeners = new Set<() => void>();

export function setAccountSpaceState(next: Partial<AccountSpaceStore>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}
export const subscribeAccountSpace = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getAccountSpaceState = () => state;

/**
 * Appelée à CHAQUE connexion (mot de passe, code SMS, biométrie, inscription) : l'application s'ouvre toujours sur le compte CLIENT,
 * même si la personne avait quitté l'application sur son compte marchand. Le choix mémorisé est effacé ; elle rebascule quand elle veut.
 */
export function startClientSession(userId: string | null | undefined) {
  if (!userId) return;
  AsyncStorage.removeItem(accountSpaceKey(userId)).catch(() => { /* sans incidence */ });
  setAccountSpaceState({ userId, space: "client", loaded: true });
}

/** Appelée à la déconnexion : plus aucun compte actif en mémoire. */
export function endAccountSpaceSession() {
  setAccountSpaceState({ userId: null, space: null, loaded: false });
}
