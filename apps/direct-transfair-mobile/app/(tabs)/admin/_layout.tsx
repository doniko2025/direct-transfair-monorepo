// apps/direct-transfair-mobile/app/(tabs)/admin/_layout.tsx
import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index"          options={{ title: "Admin Dashboard" }} />
      <Stack.Screen name="transactions"   options={{ title: "Transactions" }} />
      <Stack.Screen name="super-dashboard" options={{ presentation: "modal", title: "Super Admin" }} />
      <Stack.Screen name="rates"          options={{ title: "Taux de Change" }} />
      <Stack.Screen name="settings"       options={{ title: "Paramètres" }} />
    </Stack>
  );
}