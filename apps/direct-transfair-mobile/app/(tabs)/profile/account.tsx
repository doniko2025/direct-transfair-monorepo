// apps/direct-transfair-mobile/app/(tabs)/profile/account.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// ACCOUNT MENU v6.0 — Direct Transf'air
// ✅ v6.0 : REFONTE THÈME CLAIR — fond crème, grande carte d'identité (avatar beige, pastille
//    d'ID), menu en groupe blanc arrondi à lignes séparées par un filet, déconnexion en
//    bouton « danger » doux. Les teintes par rôle (ambre / vert écrits en dur) disparaissent :
//    tout suit la couleur de marque du tenant via le design system. Police système.
//    LOGIQUE INCHANGÉE (liens vers informations personnelles / appareils / code secret,
//    confirmation puis logout + retour à la connexion).
//    Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// ✅ v5.1 : WHITE-LABEL — couleurs vertes suivent la couleur de marque du tenant.
// ✅ Menu condensé compte + déconnexion
// =========================================================

import React from "react";
import { Alert, Platform, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from '../../../components/ui/Icon';
import { useAuth } from "../../../providers/AuthProvider";
import { Avatar, Button, Group, ListRow, NavBar, Pill, Screen, UText } from "../../../components/ui";

export default function AccountMenuScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      if (window.confirm("Voulez-vous vraiment vous déconnecter ?")) await logout();
      return;
    }
    Alert.alert("Déconnexion", "Voulez-vous vraiment vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Oui",
        style: "destructive",
        onPress: async () => {
          await logout();
          if (router.canDismiss()) router.dismissAll();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Client";

  return (
    <Screen
      header={<NavBar title="Mon compte" onBack={() => router.back()} />}
      footer={<Button label="Me déconnecter" kind="danger" icon="log-out-outline" onPress={handleLogout} />}
    >
      {/* Identité */}
      <View style={{ alignItems: "center", paddingVertical: 10, gap: 10 }}>
        <Avatar name={fullName} size={84} />
        <UText v="title" align="center" numberOfLines={1}>{fullName}</UText>
        <Pill label={`#${user?.id?.slice(0, 10).toUpperCase() ?? "—"}`} tone="neutral" style={{ alignSelf: "center" }} />
      </View>

      {/* Menu */}
      <Group style={{ marginTop: 22 }}>
        <ListRow
          icon="person-outline"
          title="Mes informations personnelles"
          onPress={() => router.push("/(tabs)/profile/personal-info")}
        />
        <ListRow
          icon="phone-portrait-outline"
          title="Mes appareils"
          onPress={() => router.push("/(tabs)/profile/devices")}
        />
        <ListRow
          icon="keypad-outline"
          title="Modifier mon code secret"
          onPress={() => router.push("/(tabs)/profile/security")}
          last
        />
      </Group>

      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 20, opacity: pressed ? 0.6 : 1 })}
      >
        <Ionicons name="warning-outline" size={14} color="#8B887F" />
        <UText v="caption" tone="muted">Supprimer mon compte</UText>
      </Pressable>
    </Screen>
  );
}
