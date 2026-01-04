//apps/direct-transfair-mobile/app/(tabs)/beneficiaires/_layout.tsx
import React from "react";
import { Stack } from "expo-router";

export default function BeneficiairesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
