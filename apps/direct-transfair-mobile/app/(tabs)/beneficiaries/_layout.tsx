//apps/direct-transfair-mobile/app/(tabs)/beneficiaries/_layout.tsx
import React from "react";
import { Stack } from "expo-router";

export default function BeneficiariesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
