//apps/direct-transfair-mobile/app/(tabs)/transactions/_layout.tsx
import { Stack } from "expo-router";

export default function TransactionsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Historique" }} />
      <Stack.Screen name="[id]" options={{ title: "Détails", presentation: "modal" }} />
    </Stack>
  );
}