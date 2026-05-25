// apps/direct-transfair-mobile/app/_layout.tsx
// =========================================================
// ROOT LAYOUT v5.0
// ✅ TenantProvider wrappe AuthProvider
//    → le branding est disponible dès le démarrage
// =========================================================

import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { TenantProvider } from "../providers/TenantProvider";
import { AuthProvider } from "../providers/AuthProvider";

export default function RootLayout() {
  return (
    <TenantProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="topup"           options={{ presentation: "modal" }} />
          <Stack.Screen name="wallet-transfer" options={{ presentation: "modal" }} />
          <Stack.Screen name="referral" />
          <Stack.Screen name="[tenant]/index" />
        </Stack>
      </AuthProvider>
    </TenantProvider>
  );
}