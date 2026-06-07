// apps/direct-transfair-mobile/app/(auth)/_layout.tsx
// =========================================================
// AUTH LAYOUT v2.0 — Direct Transf'air
// ✅ v1.0 : login, register, forgot-password
// ✅ v2.0 : privacy-policy, terms, assistance ajoutés
//           en présentation modale (slide depuis le bas)
// =========================================================

import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      initialRouteName="login"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="login"           options={{ headerShown: false }} />
      <Stack.Screen name="register"        options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />

      {/* ✅ Écrans légaux — présentation modale */}
      <Stack.Screen
        name="privacy-policy"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="terms"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="assistance"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
    </Stack>
  );
}