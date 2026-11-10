// apps/direct-transfair-mobile/app/_layout.tsx
// =========================================================
// ROOT LAYOUT v7.2
// ✅ v7.2 : THÈME CLAIR / SOMBRE — <ThemeProvider> tout en haut (choix mémorisé, mode automatique), barre d'état et thème de navigation alignés.
// ✅ v7.1 : LANGUES FR / EN / PT — I18nProvider tout en haut (même l'écran de connexion est traduit) ; <LanguageSync /> envoie la langue au compte.
// ✅ v7.0 : DESIGN « CORRIDOR » — chargement des polices Manrope + Fraunces (embarquées dans assets/fonts) avant
//   l'affichage ; si le chargement échoue l'app démarre quand même (police système). Barre d'état sombre sur fond brume.
// ✅ v5.1 : TenantProvider wrappe AuthProvider
// ✅ v6.0 : InactivityProvider — déconnexion auto 60s inactivité
//   Placé DANS AuthProvider pour accéder à useAuth().
//   Placé AUTOUR du Stack pour intercepter tous les touchers.
// =========================================================

// ⚠️ Doit être le tout premier import
import 'react-native-gesture-handler';

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack, ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { TenantProvider }     from '../providers/TenantProvider';
import { AuthProvider }       from '../providers/AuthProvider';
import { InactivityProvider } from '../providers/InactivityProvider'; // ✅ v6.0
import { FONT_FILES } from '../components/ui/fonts';                    // ✅ v7.0
import { buildColors } from '../components/ui/theme';
import { useAuth } from '../providers/AuthProvider';
import { usePushNavigation } from '../hooks/usePushNavigation';
import { ThemeProvider, useTheme } from '../providers/ThemeProvider';   // ✅ v7.2 : thème clair / sombre
import { I18nProvider } from '../providers/I18nProvider';           // ✅ v7.1 : langues FR / EN / PT
import LanguageSync from '../components/i18n/LanguageSync';

/** Ouvre l'écran lié à une notification touchée (Lot 11) — placé sous AuthProvider pour connaître la session. */
function PushNavigation() {
  const { user } = useAuth();
  usePushNavigation(!!user);
  return null;
}

/** Attend le choix de thème mémorisé (quelques millisecondes) : évite un flash clair avant le thème sombre. */
function ThemeGate({ children }: { children: React.ReactNode }) {
  const { ready, scheme } = useTheme();
  if (!ready) return <View style={{ flex: 1, backgroundColor: buildColors(undefined, undefined, scheme).bg }} />;
  return <>{children}</>;
}

/** Thème de navigation (fond derrière les écrans pendant les transitions) + barre d'état, alignés sur le thème. */
function ThemedShell({ children }: { children: React.ReactNode }) {
  const { isDark, scheme } = useTheme();
  const bg = buildColors(undefined, undefined, scheme).bg;
  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: bg, card: bg } };
  }, [isDark, bg]);
  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {children}
    </NavThemeProvider>
  );
}

function ThemedStack() {
  const { scheme } = useTheme();
  const bg = buildColors(undefined, undefined, scheme).bg;
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="topup"           options={{ presentation: 'modal' }} />
      <Stack.Screen name="wallet-transfer" options={{ presentation: 'modal' }} />
      <Stack.Screen name="referral" />
      <Stack.Screen name="[tenant]/index" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  // Évite un flash de texte système : on attend les polices (ou leur échec) avant d'afficher.
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: buildColors().bg }} />;
  return (
    <ThemeProvider>
    <ThemeGate>
    <I18nProvider>
    <TenantProvider>
      <AuthProvider>
        {/* ✅ v6.0 : InactivityProvider entre AuthProvider et le Stack
            → accède à useAuth() et englobe toute l'interface */}
        <InactivityProvider>
          <ThemedShell>
            <PushNavigation />
            <LanguageSync />
            <ThemedStack />
          </ThemedShell>
        </InactivityProvider>
      </AuthProvider>
    </TenantProvider>
    </I18nProvider>
    </ThemeGate>
    </ThemeProvider>
  );
}

