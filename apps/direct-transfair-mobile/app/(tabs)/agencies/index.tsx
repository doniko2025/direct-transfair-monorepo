//apps/direct-transfair-mobile/app/(tabs)/agencies/index.tsx
import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../../../theme/colors";

export default function AgenciesIndex() {
  const router = useRouter();

  useEffect(() => {
    // On redirige vers ton écran existant
    router.replace("/(tabs)/admin/agencies");
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
