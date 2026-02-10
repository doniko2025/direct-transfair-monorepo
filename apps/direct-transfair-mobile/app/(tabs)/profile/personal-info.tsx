//apps/direct-transfair-mobile/app/(tabs)/profile/personal-info.tsx
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../../providers/AuthProvider";
import { View, ActivityIndicator } from "react-native";

export default function PersonalInfoRouter() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    if (user.role === "SUPER_ADMIN" || user.role === "COMPANY_ADMIN") {
      router.replace("/(tabs)/profile/personal-info-admin");
    } else if (user.role === "AGENT") {
      router.replace("/(tabs)/profile/personal-info-agent");
    } else {
      router.replace("/(tabs)/profile/personal-info-wallet");
    }
  }, [user]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
