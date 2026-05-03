// apps/direct-transfair-mobile/app/_layout.tsx
// apps/direct-transfair-mobile/app/_layout.tsx
// =========================================================
// ROOT LAYOUT v4.0 — Direct Transf'air
// ✅ StatusBar dark · AuthProvider · Stack sans header
// =========================================================

import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../providers/AuthProvider";

export default function RootLayout() {
  return (
    <AuthProvider>
      {/* StatusBar light-content globalement — cohérent avec les fonds dark */}
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        {/* Écrans modaux standalone */}
        <Stack.Screen name="topup" options={{ presentation: "modal" }} />
        <Stack.Screen name="wallet-transfer" options={{ presentation: "modal" }} />
        <Stack.Screen name="referral" />
        <Stack.Screen name="[tenant]" />
      </Stack>
    </AuthProvider>
  );
}