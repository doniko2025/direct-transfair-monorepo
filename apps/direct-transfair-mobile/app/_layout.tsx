// apps/direct-transfair-mobile/app/_layout.tsx
// =========================================================
// ROOT LAYOUT v6.0
// ✅ v5.1 : TenantProvider wrappe AuthProvider
// ✅ v6.0 : InactivityProvider — déconnexion auto 60s inactivité
//   Placé DANS AuthProvider pour accéder à useAuth().
//   Placé AUTOUR du Stack pour intercepter tous les touchers.
// =========================================================

// ⚠️ Doit être le tout premier import
import 'react-native-gesture-handler';

import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { TenantProvider }     from '../providers/TenantProvider';
import { AuthProvider }       from '../providers/AuthProvider';
import { InactivityProvider } from '../providers/InactivityProvider'; // ✅ v6.0

export default function RootLayout() {
  return (
    <TenantProvider>
      <AuthProvider>
        {/* ✅ v6.0 : InactivityProvider entre AuthProvider et le Stack
            → accède à useAuth() et englobe toute l'interface */}
        <InactivityProvider>
          <StatusBar style="light" />
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