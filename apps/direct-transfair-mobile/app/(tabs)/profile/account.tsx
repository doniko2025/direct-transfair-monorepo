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
import { useProfilePhoto } from "../../../hooks/useProfilePhoto";
import { useT } from "../../../providers/I18nProvider";
import { Avatar, Button, Group, ListRow, NavBar, Pill, Screen, UText } from "../../../components/ui";

export default function AccountMenuScreen() {
  const t = useT();
  const router = useRouter();
  const { user, logout } = useAuth();
  const photo = useProfilePhoto();

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      if (window.confirm(t("accm.logoutConfirm"))) await logout();
      return;
    }
    Alert.alert(t("accm.logoutTitle"), t("accm.logoutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("accm.yes"),
        style: "destructive",
        onPress: async () => {
          await logout();
          if (router.canDismiss()) router.dismissAll();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || t("accm.client");

  return (
    <Screen
      header={<NavBar title={t("prof.myAccount")} onBack={() => router.back()} />}
      footer={<Button label={t("accm.logoutBtn")} kind="danger" icon="log-out-outline" onPress={handleLogout} />}
    >
      {/* Identité */}
      <View style={{ alignItems: "center", paddingVertical: 10, gap: 10 }}>
        <Avatar name={fullName} size={84} uri={photo} />
        <UText v="title" align="center" numberOfLines={1}>{fullName}</UText>
        <Pill label={`#${user?.id?.slice(0, 10).toUpperCase() ?? "—"}`} tone="neutral" style={{ alignSelf: "center" }} />
      </View>

      {/* Menu */}
      <Group style={{ marginTop: 22 }}>
        <ListRow
          icon="person-outline"
          title={t("accm.personal")}
          onPress={() => router.push("/(tabs)/profile/personal-info")}
        />
        <ListRow
          icon="phone-portrait-outline"
          title={t("accm.devices")}
          onPress={() => router.push("/(tabs)/profile/devices")}
        />
        <ListRow
          icon="keypad-outline"
          title={t("prof.changePin")}
          onPress={() => router.push("/(tabs)/profile/security")}
          last
        />
      </Group>

      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 20, opacity: pressed ? 0.6 : 1 })}
      >
        <Ionicons name="warning-outline" size={14} color="#8B887F" />
        <UText v="caption" tone="muted">{t("prof.deleteAccount")}</UText>
      </Pressable>
    </Screen>
  );
}
