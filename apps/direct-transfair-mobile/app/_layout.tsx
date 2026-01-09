// apps/direct-transfair-mobile/app/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../providers/AuthProvider";

// Ce fichier ne sert qu'à envelopper l'application.
// Il ne doit PAS contenir de logique de redirection (router.replace)
// pour éviter l'erreur "Navigate before mounting".

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* On définit nos écrans principaux */}
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthProvider>
  );
}