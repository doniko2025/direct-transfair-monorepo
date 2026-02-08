// apps/direct-transfair-mobile/app/(tabs)/agencies/index.tsx
import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../providers/AuthProvider";
import { colors } from "../../../theme/colors";

export default function AgenciesIndex() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    // 🔒 GUARD DE SÉCURITÉ
    if (user?.role === "COMPANY_ADMIN") {
      router.replace("/(tabs)/admin/agencies");
    } else {
      // accès interdit → retour accueil
      router.replace("/(tabs)/home");
    }
  }, [router, user, isLoading]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
