// apps/direct-transfair-mobile/app/(auth)/_layout.tsx
// =========================================================
// AUTH LAYOUT v4.0 — Direct Transf'air
// ✅ v2.0 : privacy-policy, terms, assistance (modaux)
// ✅ v3.0 : otp-phone ajouté (connexion par téléphone)
// ✅ v4.0 : Système auth v2
//   — login-v2       : écran de connexion unifié (3 méthodes)
//   — verify-contact : vérification obligatoire email + téléphone
//     gestureEnabled: false → empêche le swipe iOS pour contourner
//   — initialRouteName basculé sur "login-v2"
// =========================================================

import { Stack } from "expo-router"; 

export default function AuthLayout() {
  return (
    <Stack
      initialRouteName="login-v2"
      screenOptions={{ headerShown: false }}
    >
      {/* ── Écrans principaux ── */}
      <Stack.Screen name="login"           options={{ headerShown: false }} />
      <Stack.Screen name="login-v2"        options={{ headerShown: false }} />
      <Stack.Screen name="register"        options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />

      {/* ── Vérification obligatoire email + téléphone ── */}
      <Stack.Screen
        name="verify-contact"
        options={{
          headerShown:   false,
          gestureEnabled: false,  // Empêche le swipe iOS pour contourner la vérif
        }}
      />

      {/* ✅ v3.0 : Connexion par téléphone OTP */}
      <Stack.Screen
        name="otp-phone"
        options={{ headerShown: false }}
      />

      {/* Écrans légaux — présentation modale */}
      <Stack.Screen
        name="privacy-policy"
        options={{
          headerShown:  false,
          presentation: "modal",
          animation:    "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="terms"
        options={{
          headerShown:  false,
          presentation: "modal",
          animation:    "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="assistance"
        options={{
          headerShown:  false,
          presentation: "modal",
          animation:    "slide_from_bottom",
        }}
      />
    </Stack>
  );
}