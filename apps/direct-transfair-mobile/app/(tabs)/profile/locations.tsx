// apps/direct-transfair-mobile/app/(tabs)/profile/locations.tsx
// =========================================================
// LOCATIONS v5.0 — Direct Transf'air
// Design: Light & Premium — Points de retrait
// =========================================================

import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, StatusBar, Platform,
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
  red: "#DC2626",
  radius: { md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

const AGENCIES = [
  { id: "1", name: "Agence Paris 18ème", address: "12 Rue Marcadet, 75018 Paris", distance: "1.2 km", open: true },
  { id: "2", name: "Agence Montreuil", address: "45 Rue de Paris, 93100 Montreuil", distance: "5.4 km", open: true },
  { id: "3", name: "Agence Saint-Denis", address: "78 Av. du Président Wilson, 93200", distance: "8.1 km", open: false },
  { id: "4", name: "Agence Conakry Centre", address: "Quartier Kaloum, Conakry, Guinée", distance: "—", open: true },
  { id: "5", name: "Agence Dakar Plateau", address: "12 Av. Léopold Sédar Senghor, Dakar", distance: "—", open: true },
];

export default function LocationsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const role = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;

  return (
    <LinearGradient colors={[theme.bg, "rgba(255,255,255,0.3)"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Nos Agences</Text>
            <Text style={[s.headerSub, { color: theme.accent, fontFamily: T.font.sans }]}>
              {AGENCIES.length} points Direct Transf'air
            </Text>
          </View>
        </View>

        <FlatList
          data={AGENCIES}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={s.sectionRow}>
              <View style={[s.sectionDot, { backgroundColor: theme.accent }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>AGENCES À PROXIMITÉ</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} activeOpacity={0.8}>
              <View style={[s.iconBox, { backgroundColor: theme.accentSoft }]}>
                <Ionicons name="location" size={20} color={theme.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.name, { fontFamily: T.font.sans }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[s.address, { fontFamily: T.font.sans }]} numberOfLines={1}>{item.address}</Text>
                <View style={s.metaRow}>
                  <View style={[s.openPill, { backgroundColor: item.open ? "#DCFCE7" : "#FEE2E2", borderColor: item.open ? "#16A34A40" : "#DC262640" }]}>
                    <View style={[s.openDot, { backgroundColor: item.open ? T.green : T.red }]} />
                    <Text style={[s.openTxt, { color: item.open ? T.green : T.red, fontFamily: T.font.sans }]}>
                      {item.open ? "Ouvert" : "Fermé"}
                    </Text>
                  </View>
                </View>
              </View>
              {item.distance !== "—" && (
                <View style={[s.distBox, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
                  <Ionicons name="navigate-circle-outline" size={12} color={theme.accent} />
                  <Text style={[s.distTxt, { color: theme.accent, fontFamily: T.font.mono }]}>{item.distance}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          ListFooterComponent={<View style={{ height: 80 }} />}
        />
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

  list: { paddingHorizontal: 20, paddingTop: 16 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionDot: { width: 6, height: 6, borderRadius: 99 },
  sectionLabel: { fontSize: 10, fontWeight: "900", color: T.textSub, letterSpacing: 1.5, textTransform: "uppercase" },

  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.surface, borderRadius: 16,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.border,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  iconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  name: { color: T.text, fontSize: 14, fontWeight: "700", marginBottom: 3 },
  address: { color: T.textDim, fontSize: 11, fontWeight: "600", marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center" },
  openPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  openDot: { width: 5, height: 5, borderRadius: 99 },
  openTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
  distBox: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  distTxt: { fontSize: 11, fontWeight: "800" },
});