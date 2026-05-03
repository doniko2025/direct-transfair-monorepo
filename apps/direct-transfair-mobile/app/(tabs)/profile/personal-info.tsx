//apps/direct-transfair-mobile/app/(tabs)/profile/personal-info.tsx
// apps/direct-transfair-mobile/app/(tabs)/profile/personal-info.tsx
// Router qui redirige selon le rôle

import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../../providers/AuthProvider";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function PersonalInfoRouter() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    if (user.role === "SUPER_ADMIN")   router.replace("/(tabs)/profile/personal-info-super-admin");
    else if (user.role === "COMPANY_ADMIN") router.replace("/(tabs)/profile/personal-info-admin");
    else if (user.role === "AGENT")    router.replace("/(tabs)/profile/personal-info-agent");
    else                               router.replace("/(tabs)/profile/personal-info-wallet");
  }, [user]);

  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#10B981" />
    </View>
  );
}
const s = StyleSheet.create({ center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0B1F14" } });