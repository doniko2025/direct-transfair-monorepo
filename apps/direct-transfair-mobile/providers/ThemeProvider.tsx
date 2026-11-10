// apps/direct-transfair-mobile/providers/ThemeProvider.tsx
// =========================================================
// THÈME CLAIR / SOMBRE — v1.0
//  • Trois choix : Clair, Sombre, Automatique (suit le réglage du téléphone, en direct).
//  • Le choix est mémorisé sur l'appareil (AsyncStorage) ; premier lancement = Automatique.
//  • `useTheme()` → { mode, scheme, isDark, setMode, ready } ; tout composant qui l'appelle (directement, ou via useUI(),
//    useWalletTheme(), useAuthPalette()) se redessine au changement de thème.
//  • Le thème appliqué est écrit dans ui/themeMode.ts AVANT le rendu des enfants : les couleurs « vivantes » (N, buildColors)
//    et les styles `themed()` sont donc déjà à jour quand les écrans se redessinent.
//  • Appearance.setColorScheme() aligne aussi les éléments natifs (clavier, sélecteurs de date, boîtes de dialogue).
// =========================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setScheme, type Scheme, type ThemeMode } from '../components/ui/themeMode';

export const THEME_STORAGE_KEY = 'app.theme.v1';

type Ctx = {
  /** Choix de la personne. */
  mode: ThemeMode;
  /** Thème réellement appliqué. */
  scheme: Scheme;
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
  /** false tant que le choix mémorisé n'a pas été relu (évite un flash clair au démarrage). */
  ready: boolean;
};

const ThemeContext = createContext<Ctx | null>(null);

const isMode = (v: unknown): v is ThemeMode => v === 'light' || v === 'dark' || v === 'auto';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('auto');
  const [ready, setReady] = useState(false);

  // Lecture du choix mémorisé (une fois).
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => { if (alive && isMode(saved)) setModeState(saved); })
      .catch(() => {})
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const scheme: Scheme = mode === 'auto' ? (system === 'dark' ? 'dark' : 'light') : mode;
  // Écrit pendant le rendu, avant les enfants : idempotent, dérivé uniquement de (mode, système).
  setScheme(scheme);

  // Éléments natifs (clavier, dialogues…) : suivent le choix ; « unspecified » = suivre le téléphone.
  useEffect(() => {
    try { Appearance.setColorScheme(mode === 'auto' ? 'unspecified' : mode); } catch { /* plateforme sans support */ }
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<Ctx>(
    () => ({ mode, scheme, isDark: scheme === 'dark', setMode, ready }),
    [mode, scheme, setMode, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Thème courant. Hors fournisseur (test, écran isolé) : clair, sans plantage. */
export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return { mode: 'light', scheme: 'light', isDark: false, setMode: () => {}, ready: true };
}
