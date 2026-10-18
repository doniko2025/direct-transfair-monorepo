// apps/direct-transfair-mobile/app/(tabs)/profile/personal-info.tsx
// Redirection vers « Informations personnelles » du client — Thème Clair
// ✅ v3.0 : refonte thème clair — le spinner suit la couleur de la société (plus de bleu
//   codé en dur) et le fond celui du design system. Logique inchangée.
//   Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v2.0 (phase 5) : l'app mobile ne sert que les clients wallet ; les
//   écrans « informations personnelles » des rôles agent / admin société /
//   super admin ont été retirés (ils sont dans le portail web).

import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../../providers/AuthProvider";
import { View, ActivityIndicator } from "react-native";
import { useUI } from "../../../components/ui";

export default function PersonalInfoRouter() {
  const { user } = useAuth();
  const router = useRouter();
  const { C } = useUI();

  useEffect(() => {
    if (!user) return;
    router.replace("/(tabs)/profile/personal-info-wallet");
  }, [user, router]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg }}>
      <ActivityIndicator size="large" color={C.ink} />
    </View>
  );
}
