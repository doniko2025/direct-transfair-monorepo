// apps/direct-transfair-mobile/app/(tabs)/profile/devices.tsx
// =========================================================
// DEVICES v5.0 — Direct Transf'air
// Design: Light & Premium — Appareils connectés
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
  SUPER_ADMIN: { bg: "#F8FAFF", accent: "#1D4ED8", accentSoft: "#EFF6FF" },
  COMPANY_ADMIN: { bg: "#F0FDFA", accent: "#0D9488", accentSoft: "#CCFBF1" },
  AGENT: { bg: "#FFFBEB", accent: "#D97706", accentSoft: "#FEF3C7" },
  USER: { bg: "#F0FDF4", accent: "#059669", accentSoft: "#DCFCE7" },
} as const;

const T = {
  surface: "#FFFFFF",
  text: "#0F172A",
  textSub: "#475569",
  textDim: "#94A3B8",
  border: "#E2E8F0",
  green: "#16A34A",
  greenSoft: "#DCFCE7",
  red: "#DC2626",
  redSoft: "#FEE2E2",
  blue: "#0284C7",
  infoSoft: "#E0F2FE",
  radius: { md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

const DEVICES = [
  { id: "1", name: Platform.OS === "web" ? "Navigateur Web (Chrome)" : "iPhone 14 Pro", detail: "Paris, France · En ligne maintenant", current: true, icon: Platform.OS === "web" ? "desktop-outline" : "phone-portrait-outline" },
  { id: "2", name: "MacBook Air", detail: "Lyon, France · Hier à 14h30", current: false, icon: "laptop-outline" },
  { id: "3", name: "Samsung Galaxy S23", detail: "Conakry, Guinée · Il y a 3 jours", current: false, icon: "phone-portrait-outline" },
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
    <LinearGradient colors={[theme.bg, "rgba(255,255,255,0.3)"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Appareils Connectés</Text>
            <Text style={[s.headerSub, { color: theme.accent, fontFamily: T.font.sans }]}>
              {DEVICES.length} appareil{DEVICES.length > 1 ? "s" : ""} · {otherDevices.length} autre{otherDevices.length > 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Info banner */}
          <View style={[s.infoBanner, { backgroundColor: T.infoSoft, borderColor: T.blue }]}>
            <Ionicons name="shield-outline" size={16} color={T.blue} />
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
            <View key={d.id} style={[s.card, { borderColor: `${T.green}40` }]}>
              <View style={[s.iconBox, { backgroundColor: T.greenSoft }]}>
                <Ionicons name={d.icon as any} size={18} color={T.green} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.deviceName, { fontFamily: T.font.sans }]} numberOfLines={1}>{d.name}</Text>
                <Text style={[s.deviceDetail, { fontFamily: T.font.sans }]}>{d.detail}</Text>
              </View>
              <View style={[s.activeBadge, { backgroundColor: T.greenSoft }]}>
                <View style={s.activeDot} />
                <Text style={[s.activeTxt, { fontFamily: T.font.sans }]}>Actif</Text>
              </View>
            </View>
          ))}

          {/* Autres appareils */}
          {otherDevices.length > 0 && (
            <>
              <View style={[s.sectionRow, { marginTop: 20 }]}>
                <View style={[s.sectionDot, { backgroundColor: T.textDim }]} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>AUTRES APPAREILS</Text>
              </View>

              {otherDevices.map((d) => (
                <View key={d.id} style={s.card}>
                  <View style={[s.iconBox, { backgroundColor: "#F3F4F6" }]}>
                    <Ionicons name={d.icon as any} size={18} color={T.textDim} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.deviceName, { fontFamily: T.font.sans }]} numberOfLines={1}>{d.name}</Text>
                    <Text style={[s.deviceDetail, { fontFamily: T.font.sans }]}>{d.detail}</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.revokeBtn, { backgroundColor: T.redSoft, borderColor: "#FECACA" }]}
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
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 12,
    backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  headerTitle: { color: T.text, fontSize: 18, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  infoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 20 },
  infoTxt: { flex: 1, color: T.blue, fontSize: 12, fontWeight: "600", lineHeight: 18 },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionDot: { width: 6, height: 6, borderRadius: 99 },
  sectionLabel: { fontSize: 10, fontWeight: "900", color: T.textSub, letterSpacing: 1.5, textTransform: "uppercase" },

  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.surface, borderRadius: 16,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.border,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  iconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  deviceName: { color: T.text, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  deviceDetail: { color: T.textDim, fontSize: 11, fontWeight: "600" },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: `${T.green}40` },
  activeDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: T.green },
  activeTxt: { color: T.green, fontSize: 10, fontWeight: "900" },
  revokeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, borderWidth: 1 },
  revokeTxt: { color: T.red, fontSize: 11, fontWeight: "800" },
});