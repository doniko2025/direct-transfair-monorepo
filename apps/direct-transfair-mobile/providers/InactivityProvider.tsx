// apps/direct-transfair-mobile/providers/InactivityProvider.tsx
// =========================================================
// INACTIVITY PROVIDER v1.1 — Direct Transf'air
// ✅ v1.0 conservé intégralement
// ✅ v1.1 : TIMEOUT_MS passé de 60s à 30 minutes
//
// Déconnexion automatique après 30 minutes d'inactivité.
// Doit être placé DANS AuthProvider (utilise useAuth).
//
// Comportement :
//   — Démarre un timer de 30 min à chaque connexion (user !== null)
//   — Tout toucher (onTouchStart / onTouchMove) réinitialise le timer
//   — Expiration → logout() automatique
//   — App en arrière-plan (AppState) → timer suspendu
//   — App revenue au premier plan → timer relancé si user connecté
//   — Si user se déconnecte manuellement → timer annulé
//
// Usage dans app/_layout.tsx :
//   <TenantProvider>
//     <AuthProvider>
//       <InactivityProvider>   ← ici
//         <Stack ... />
//       </InactivityProvider>
//     </AuthProvider>
//   </TenantProvider>
// =========================================================

import React, {
  createContext, useCallback, useContext, useEffect, useRef,
} from 'react';
import { AppState, AppStateStatus, View } from 'react-native';
import { useAuth } from './AuthProvider';

// ─── Constante ───────────────────────────────────────────
// ✅ v1.1 — 30 minutes (auparavant 60 secondes)
const TIMEOUT_MS = 30 * 60_000; // 30 minutes

// ─── Contexte (pour usage optionnel depuis n'importe où) ─
type InactivityContextValue = {
  /** Réinitialise le timer manuellement (ex: après une action programmatique) */
  resetTimer: () => void;
};

const InactivityContext = createContext<InactivityContextValue>({
  resetTimer: () => {},
});

// =========================================================
// PROVIDER
// =========================================================

export function InactivityProvider({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef     = useRef<AppStateStatus>(AppState.currentState);
  // Timestamp du dernier toucher (utile pour le calcul foreground)
  const lastActivityRef = useRef<number>(Date.now());

  // ── Démarrer / réinitialiser le timer ────────────────────
  const resetTimer = useCallback(() => {
    if (!user) return;                        // Pas connecté → rien
    lastActivityRef.current = Date.now();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      // Vérification de sécurité : l'activité ne vient pas de revenir
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed < TIMEOUT_MS - 1000) return; // Race condition, ignorer
      await logout();
    }, TIMEOUT_MS);
  }, [user, logout]);

  // ── Démarrer/arrêter selon l'état d'authentification ────
  useEffect(() => {
    if (user) {
      resetTimer();
    } else {
      // Déconnecté → annuler le timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [user, resetTimer]);

  // ── Gestion arrière-plan / premier plan ─────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        const prev = appStateRef.current;
        appStateRef.current = nextState;

        if (
          prev === 'active' &&
          (nextState === 'inactive' || nextState === 'background')
        ) {
          // → Arrière-plan : suspendre le timer
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        } else if (nextState === 'active' && prev !== 'active') {
          // → Premier plan : vérifier si le timeout est déjà dépassé
          if (user) {
            const elapsed = Date.now() - lastActivityRef.current;
            if (elapsed >= TIMEOUT_MS) {
              // Trop longtemps en arrière-plan → déconnecter immédiatement
              void logout();
            } else {
              // Reste du timer à écouler
              const remaining = TIMEOUT_MS - elapsed;
              if (timerRef.current) clearTimeout(timerRef.current);
              timerRef.current = setTimeout(async () => { await logout(); }, remaining);
            }
          }
        }
      },
    );

    return () => subscription?.remove?.();
  }, [user, logout]);

  // ── Rendu ─────────────────────────────────────────────────
  return (
    <InactivityContext.Provider value={{ resetTimer }}>
      {/*
        View avec onTouchStart/onTouchMove intercepte tous les
        touchers de l'app sans bloquer les handlers enfants.
        Non-intrusif : ne retourne jamais true au système de gestion
        des gestes, donc ScrollView / PanResponder fonctionnent normalement.
      */}
      <View
        style={{ flex: 1 }}
        onTouchStart={resetTimer}
        onTouchMove={resetTimer}
        collapsable={false}
      >
        {children}
      </View>
    </InactivityContext.Provider>
  );
}

// ─── Hook utilitaire ─────────────────────────────────────
export const useInactivity = () => useContext(InactivityContext);