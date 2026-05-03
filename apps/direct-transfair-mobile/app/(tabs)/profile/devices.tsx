//apps/direct-transfair-mobile/app/(tabs)/profile/devices.tsx
// apps/direct-transfair-mobile/app/(tabs)/profile/devices.tsx
// =========================================================
// DEVICES v4.0 — Direct Transf'air
// Design: Dark premium thématique par rôle
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
  green: "#22C55E",
  red: "#EF4444",
  radius: { md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

const DEVICES = [
  { id: "1",  name: Platform.OS === "web" ? "Navigateur Web (Chrome)" : "iPhone 14 Pro", detail: "Paris, France · En ligne maintenant",        current: true,  icon: Platform.OS === "web" ? "desktop-outline" : "phone-portrait-outline" },
  { id: "2",  name: "MacBook Air",                                                         detail: "Lyon, France · Hier à 14h30",                current: false, icon: "laptop-outline" },
  { id: "3",  name: "Samsung Galaxy S23",                                                   detail: "Conakry, Guinée · Il y a 3 jours",           current: false, icon: "phone-portrait-outline" },
];

export default function DevicesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const role = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;

  const handleRevoke = (name: string) => {
    Alert.alert(
      "Déconnecter cet appareil",
      `Voulez-vous déconnecter "${name}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Déconnecter", style: "destructive", onPress: () => {} },
      ]
    );
  };

  const currentDevices = DEVICES.filter((d) => d.current);
  const otherDevices = DEVICES.filter((d) => !d.current);

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Appareils Connectés</Text>
            <Text style={[s.headerSub, { color: theme.accent, fontFamily: T.font.sans }]}>
              {DEVICES.length} appareil{DEVICES.length > 1 ? "s" : ""} · {otherDevices.length} autre{otherDevices.length > 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Description */}
          <View style={s.infoBanner}>
            <Ionicons name="shield-outline" size={16} color={theme.accent} />
            <Text style={[s.infoTxt, { fontFamily: T.font.sans }]}>
              Gérez les appareils ayant accès à votre compte. Déconnectez ceux que vous ne reconnaissez pas.
            </Text>
          </View>

          {/* Appareil actuel */}
          <View style={s.sectionRow}>
            <View style={[s.sectionDot, { backgroundColor: T.green }]} />
            <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>APPAREIL ACTUEL</Text>
          </View>

          {currentDevices.map((d) => (
            <View key={d.id} style={[s.card, { borderColor: "rgba(34,197,94,0.20)" }]}>
              <View style={[s.iconBox, { backgroundColor: "rgba(34,197,94,0.12)" }]}>
                <Ionicons name={d.icon as any} size={20} color={T.green} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.deviceName, { fontFamily: T.font.sans }]} numberOfLines={1}>{d.name}</Text>
                <Text style={[s.deviceDetail, { fontFamily: T.font.sans }]}>{d.detail}</Text>
              </View>
              <View style={[s.activeBadge]}>
                <View style={s.activeDot} />
                <Text style={[s.activeTxt, { fontFamily: T.font.sans }]}>Actif</Text>
              </View>
            </View>
          ))}

          {/* Autres appareils */}
          {otherDevices.length > 0 && (
            <>
              <View style={[s.sectionRow, { marginTop: 8 }]}>
                <View style={[s.sectionDot, { backgroundColor: T.dim }]} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>AUTRES APPAREILS</Text>
              </View>

              {otherDevices.map((d) => (
                <View key={d.id} style={s.card}>
                  <View style={[s.iconBox, { backgroundColor: T.ghost }]}>
                    <Ionicons name={d.icon as any} size={20} color={T.dim} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.deviceName, { fontFamily: T.font.sans }]} numberOfLines={1}>{d.name}</Text>
                    <Text style={[s.deviceDetail, { fontFamily: T.font.sans }]}>{d.detail}</Text>
                  </View>
                  <TouchableOpacity
                    style={s.revokeBtn}
                    onPress={() => handleRevoke(d.name)}
                  >
                    <Text style={[s.revokeTxt, { fontFamily: T.font.sans }]}>Déconnecter</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          <View style={{ height: 80 }} />
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
  headerTitle: { color: T.white, fontSize: 22, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  infoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: T.ghost, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: T.inkBorder, marginBottom: 20 },
  infoTxt: { flex: 1, color: T.dim, fontSize: 12, fontWeight: "600", lineHeight: 17 },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionDot: { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },

  card: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.ghost, borderRadius: 18,
    padding: 16, marginBottom: 10, borderWidth: 1, borderColor: T.inkBorder,
  },
  iconBox: { width: 42, height: 42, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  deviceName: { color: T.white, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  deviceDetail: { color: T.dim, fontSize: 11, fontWeight: "600" },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(34,197,94,0.12)", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: "rgba(34,197,94,0.25)" },
  activeDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: T.green },
  activeTxt: { color: T.green, fontSize: 10, fontWeight: "900" },
  revokeBtn: { backgroundColor: "rgba(239,68,68,0.10)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, borderWidth: 1, borderColor: "rgba(239,68,68,0.20)" },
  revokeTxt: { color: T.red, fontSize: 11, fontWeight: "800" },
});