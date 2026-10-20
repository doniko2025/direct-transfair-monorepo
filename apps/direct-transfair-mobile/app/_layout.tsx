// apps/direct-transfair-mobile/app/_layout.tsx
// =========================================================
// ROOT LAYOUT v7.0
// ✅ v7.0 : DESIGN « CORRIDOR » — chargement des polices Manrope + Fraunces (embarquées dans assets/fonts) avant
//   l'affichage ; si le chargement échoue l'app démarre quand même (police système). Barre d'état sombre sur fond brume.
// ✅ v5.1 : TenantProvider wrappe AuthProvider
// ✅ v6.0 : InactivityProvider — déconnexion auto 60s inactivité
//   Placé DANS AuthProvider pour accéder à useAuth().
//   Placé AUTOUR du Stack pour intercepter tous les touchers.
// =========================================================

// ⚠️ Doit être le tout premier import
import 'react-native-gesture-handler';

import React from 'react';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { TenantProvider }     from '../providers/TenantProvider';
import { AuthProvider }       from '../providers/AuthProvider';
import { InactivityProvider } from '../providers/InactivityProvider'; // ✅ v6.0
import { FONT_FILES } from '../components/ui/fonts';                    // ✅ v7.0
import { buildColors } from '../components/ui/theme';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  // Évite un flash de texte système : on attend les polices (ou leur échec) avant d'afficher.
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: buildColors().bg }} />;
  return (
    <TenantProvider>
      <AuthProvider>
        {/* ✅ v6.0 : InactivityProvider entre AuthProvider et le Stack
            → accède à useAuth() et englobe toute l'interface */}
        <InactivityProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="topup"           options={{ presentation: 'modal' }} />
            <Stack.Screen name="wallet-transfer" options={{ presentation: 'modal' }} />
            <Stack.Screen name="referral" />
            <Stack.Screen name="[tenant]/index" />
          </Stack>
        </InactivityProvider>
      </AuthProvider>
    </TenantProvider>
  );
}