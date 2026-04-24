//apps/direct-transfair-mobile/app/(tabs)/profile/_layout.tsx
import { Stack } from "expo-router";

export default function ProfileLayout() {
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      {/* La Super Page unique du profil */}
      <Stack.Screen name="index" />
      
      {/* Les sous-pages d'édition et de détails */}
      <Stack.Screen name="personal-info" />
      <Stack.Screen name="payment-methods" />
      <Stack.Screen name="limits" />
      <Stack.Screen name="locations" />
      <Stack.Screen name="devices" />
      <Stack.Screen name="security" />
    </Stack>
  );
}