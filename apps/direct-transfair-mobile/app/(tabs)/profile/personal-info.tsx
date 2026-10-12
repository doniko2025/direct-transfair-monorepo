// apps/direct-transfair-mobile/app/(tabs)/profile/personal-info.tsx
// Redirection vers « Informations personnelles » du client — Thème Clair
// ✅ v2.0 (phase 5) : l'app mobile ne sert que les clients wallet ; les
//   écrans « informations personnelles » des rôles agent / admin société /
//   super admin ont été retirés (ils sont dans le portail web).

import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../../providers/AuthProvider";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function PersonalInfoRouter() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    router.replace("/(tabs)/profile/personal-info-wallet");
  }, [user, router]);

  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#2563EB" />
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFF" },
});
