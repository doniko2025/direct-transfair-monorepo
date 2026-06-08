// apps/direct-transfair-mobile/app/(tabs)/profile/_layout.tsx
// ✅ Route "notifications" ajoutée — bouton "Préférences de notifications"
//    dans profile/index.tsx navigue vers cet écran
import { Stack } from "expo-router";

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="personal-info" />
      <Stack.Screen name="payment-methods" />
      <Stack.Screen name="limits" />
      <Stack.Screen name="locations" />
      <Stack.Screen name="devices" />
      <Stack.Screen name="security" />
      {/* ✅ AJOUT : écran préférences de notifications */}
      <Stack.Screen name="notifications" />
    </Stack>
  );
}