//apps/direct-transfair-mobile/app/(tabs)/profile/account.tsx
// apps/direct-transfair-mobile/app/(tabs)/profile/account.tsx
// =========================================================
// ACCOUNT MENU v4.0 — Direct Transf'air
// Design: Dark premium thématique par rôle
// ✅ Menu condensé compte + déconnexion
// =========================================================

import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../../providers/AuthProvider";

const ROLE_THEMES = {
  SUPER_ADMIN:   { g1: "#0A0A0F", g2: "#12121A", accent: "#D4A853" },
  COMPANY_ADMIN: { g1: "#030B1A", g2: "#071224", accent: "#34D399" },
  AGENT:         { g1: "#1A0E00", g2: "#211200", accent: "#F59E0B" },
  USER:          { g1: "#0B1F14", g2: "#0F2A1C", accent: "#10B981" },
} as const;

const T = {
  ghost: "rgba(255,255,255,0.06)",
  inkBorder: "rgba(255,255,255,0.08)",
  white: "#FFFFFF",
  dim: "#8A9BB5",
  red: "#EF4444",
  radius: { md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

function MenuItem({ icon, label, accent, onPress }: any) {
  return (
    <TouchableOpacity style={miS.row} onPress={onPress} activeOpacity={0.75}>
      <View style={[miS.iconBox, { backgroundColor: `${accent}12` }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={[miS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <View style={[miS.chevron, { backgroundColor: `${accent}10` }]}>
        <Ionicons name="chevron-forward" size={13} color={accent} />
      </View>
    </TouchableOpacity>
  );
}
const miS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.inkBorder },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  label: { flex: 1, fontSize: 14, fontWeight: "600", color: T.white },
  chevron: { width: 26, height: 26, borderRadius: 8, justifyContent: "center", alignItems: "center" },
});

export default function AccountMenuScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const role = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;

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

  const initials = user?.firstName
    ? `${user.firstName[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "DT";

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Mon compte</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Identity */}
          <View style={s.identityCard}>
            <LinearGradient colors={[`${theme.accent}20`, `${theme.accent}08`]} style={s.avatarBox}>
              <Text style={[s.initials, { color: theme.accent, fontFamily: T.font.display }]}>{initials}</Text>
            </LinearGradient>
            <View>
              <Text style={[s.name, { fontFamily: T.font.display }]}>
                {user?.firstName ?? ""} {user?.lastName ?? ""}
              </Text>
              <Text style={[s.uid, { fontFamily: T.font.mono }]}>
                {user?.id?.slice(0, 12).toUpperCase() ?? "—"}
              </Text>
            </View>
          </View>

          {/* Menu */}
          <View style={s.card}>
            <MenuItem
              icon="person-outline"
              label="Mes informations personnelles"
              accent={theme.accent}
              onPress={() => router.push("/(tabs)/profile/personal-info")}
            />
            <MenuItem
              icon="phone-portrait-outline"
              label="Mes appareils"
              accent={theme.accent}
              onPress={() => router.push("/(tabs)/profile/devices")}
            />
            <MenuItem
              icon="keypad-outline"
              label="Modifier mon code secret"
              accent={theme.accent}
              onPress={() => router.push("/(tabs)/profile/security")}
            />
          </View>

          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={18} color={T.red} />
            <Text style={[s.logoutTxt, { fontFamily: T.font.sans }]}>ME DÉCONNECTER</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.deleteBtn}>
            <Ionicons name="warning-outline" size={14} color={T.dim} />
            <Text style={[s.deleteTxt, { fontFamily: T.font.sans }]}>Supprimer mon compte</Text>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 14,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ghost, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.inkBorder },
  headerTitle: { flex: 1, color: T.white, fontSize: 20, fontWeight: "700", textAlign: "center" },

  scroll: { paddingHorizontal: 20 },

  identityCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 20, borderWidth: 1, borderColor: T.inkBorder,
  },
  avatarBox: { width: 52, height: 52, borderRadius: 15, justifyContent: "center", alignItems: "center" },
  initials: { fontSize: 20, fontWeight: "900" },
  name: { color: T.white, fontSize: 16, fontWeight: "700", marginBottom: 3 },
  uid: { color: T.dim, fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  card: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: T.inkBorder,
  },

  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "rgba(239,68,68,0.08)", borderRadius: T.radius.md,
    paddingVertical: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "rgba(239,68,68,0.18)",
  },
  logoutTxt: { color: T.red, fontWeight: "900", fontSize: 13, letterSpacing: 1 },

  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  deleteTxt: { color: T.dim, fontSize: 12, fontWeight: "600" },
});