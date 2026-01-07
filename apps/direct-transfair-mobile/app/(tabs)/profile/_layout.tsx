//apps/direct-transfair-mobile/app/(tabs)/profile/_layout.tsx
import { Stack } from "expo-router";
import { colors } from "../../../theme/colors";

export default function ProfileLayout() {
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: "#fff",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="account" />
      <Stack.Screen name="personal-info" />
      
      {/* ✅ NOUVELLES PAGES */}
      <Stack.Screen name="payment-methods" />
      <Stack.Screen name="limits" />
      <Stack.Screen name="locations" />
    </Stack>
  );
}