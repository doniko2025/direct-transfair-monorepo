// apps/direct-transfair-mobile/app/(auth)/_layout.tsx
// =========================================================
// AUTH LAYOUT v3.0 — Direct Transf'air
// ✅ v2.0 : privacy-policy, terms, assistance (modaux)
// ✅ v3.0 : otp-phone ajouté
//           → écran de connexion par téléphone (non modal)
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

      {/* ✅ v3.0 : Connexion par téléphone OTP */}
      <Stack.Screen
        name="otp-phone"
        options={{ headerShown: false }}
      />

      {/* Écrans légaux — présentation modale */}
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