// apps/direct-transfair-mobile/app/(tabs)/agencies/index.tsx
// =========================================================
// AGENCIES INDEX ROUTER v4.1 — Direct Transf'air
// ✅ Fond blanc pendant la redirection (plus de fond noir)
// ✅ Spinner vert centré
// =========================================================

import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../providers/AuthProvider";

export default function AgenciesIndex() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (user?.role === "COMPANY_ADMIN" || user?.role === "SUPER_ADMIN") {
      router.replace("/(tabs)/admin/agencies");
    } else {
      router.replace("/(tabs)/home");
    }
  }, [router, user, isLoading]);

  return (
    <View style={s.safe}>
      <ActivityIndicator size="large" color="#10B981" />
    </View>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
});