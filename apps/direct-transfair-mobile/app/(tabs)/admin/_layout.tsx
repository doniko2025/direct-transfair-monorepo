//apps/direct-transfair-mobile/app/(tabs)/admin/_layout.tsx
import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
      }}
    >
      <Stack.Screen
        name="transactions"
        options={{ title: "Transactions Admin" }}
      />
    </Stack>
  );
}
