// apps/direct-transfair-mobile/app/(tabs)/profile/account.tsx
// =========================================================
// ACCOUNT MENU v5.0 — Direct Transf'air
// Design: Thème CLAIR par rôle, clean & aéré
// ✅ Menu condensé compte + déconnexion
// =========================================================

import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../providers/AuthProvider";

const ROLE_THEMES = {
  SUPER_ADMIN:   { bg: "#FFFBF2", accent: "#B8860B", accentLight: "#FEF3C7", avatarBg: "#FFF8E1" },
  COMPANY_ADMIN: { bg: "#F0FDF8", accent: "#059669", accentLight: "#D1FAE5", avatarBg: "#E6FDF4" },
  AGENT:         { bg: "#FFFBF0", accent: "#D97706", accentLight: "#FEF3C7", avatarBg: "#FFF3DC" },
  USER:          { bg: "#F0FDF4", accent: "#16A34A", accentLight: "#DCFCE7", avatarBg: "#E8FDF0" },
} as const;

const T = {
  white: "#FFFFFF",
  cardBg: "#FFFFFF",
  border: "#E5E8EF",
  borderLight: "#EFF1F5",
  pageBackground: "#F4F6F9",
  text: "#111827",
  textSub: "#6B7280",
  textMuted: "#9CA3AF",
  red: "#DC2626",
  redBg: "#FEF2F2",
  radius: { md: 12, lg: 16, xl: 20 },
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

function MenuItem({ icon, label, accent, onPress }: any) {
  return (
    <TouchableOpacity style={miS.row} onPress={onPress} activeOpacity={0.65}>
      <View style={[miS.iconBox, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={[miS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
    </TouchableOpacity>
  );
}
const miS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.borderLight },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  label: { flex: 1, fontSize: 14, fontWeight: "600", color: T.text },
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
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={T.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Mon compte</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Identity card */}
          <View style={s.identityCard}>
            <View style={[s.avatarBox, { backgroundColor: theme.avatarBg }]}>
              <Text style={[s.initials, { color: theme.accent, fontFamily: T.font.display }]}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.name, { fontFamily: T.font.display }]}>
                {user?.firstName ?? ""} {user?.lastName ?? ""}
              </Text>
              <View style={[s.uidPill, { backgroundColor: theme.accentLight }]}>
                <Text style={[s.uid, { color: theme.accent, fontFamily: T.font.mono }]}>
                  #{user?.id?.slice(0, 10).toUpperCase() ?? "—"}
                </Text>
              </View>
            </View>
          </View>

          {/* Menu card */}
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

          {/* Logout */}
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={18} color={T.red} />
            <Text style={[s.logoutTxt, { fontFamily: T.font.sans }]}>ME DÉCONNECTER</Text>
          </TouchableOpacity>

          {/* Delete */}
          <TouchableOpacity style={s.deleteBtn}>
            <Ionicons name="warning-outline" size={14} color={T.textMuted} />
            <Text style={[s.deleteTxt, { fontFamily: T.font.sans }]}>Supprimer mon compte</Text>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: T.radius.md,
    backgroundColor: T.cardBg, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.border, ...T.shadow,
  },
  headerTitle: { flex: 1, color: T.text, fontSize: 20, fontWeight: "700", textAlign: "center" },

  scroll: { paddingHorizontal: 20 },

  identityCard: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: T.cardBg, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 16, borderWidth: 1, borderColor: T.border,
    ...T.shadow,
  },
  avatarBox: { width: 56, height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  initials: { fontSize: 22, fontWeight: "700" },
  name: { color: T.text, fontSize: 16, fontWeight: "700", marginBottom: 6 },
  uidPill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  uid: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },

  card: {
    backgroundColor: T.cardBg, borderRadius: T.radius.lg,
    paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: T.border,
    ...T.shadow,
  },

  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.redBg, borderRadius: T.radius.md,
    paddingVertical: 15, marginBottom: 12,
    borderWidth: 1, borderColor: "#FECACA",
  },
  logoutTxt: { color: T.red, fontWeight: "800", fontSize: 13, letterSpacing: 0.8 },

  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  deleteTxt: { color: T.textMuted, fontSize: 12, fontWeight: "500" },
});