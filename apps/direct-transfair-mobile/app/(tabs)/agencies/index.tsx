// apps/direct-transfair-mobile/app/(tabs)/agencies/index.tsx
// apps/direct-transfair-mobile/app/(tabs)/agencies/index.tsx
// =========================================================
// AGENCIES INDEX ROUTER v4.0 — Direct Transf'air
// Redirige selon le rôle avec spinner dark cohérent
// =========================================================

import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../providers/AuthProvider";
import { LinearGradient } from "expo-linear-gradient";

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
    <LinearGradient colors={["#030B1A", "#071224"]} style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color="#34D399" />
    </LinearGradient>
  );
}