//apps/direct-transfair-mobile/app/(tabs)/profile/locations.tsx
// apps/direct-transfair-mobile/app/(tabs)/profile/locations.tsx
// =========================================================
// LOCATIONS v4.0 — Direct Transf'air
// Design: Thème dynamique par rôle
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
  radius: { md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

const AGENCIES = [
  { id: "1", name: "Agence Paris 18ème",      address: "12 Rue Marcadet, 75018 Paris",          distance: "1.2 km", open: true },
  { id: "2", name: "Agence Montreuil",         address: "45 Rue de Paris, 93100 Montreuil",       distance: "5.4 km", open: true },
  { id: "3", name: "Agence Saint-Denis",       address: "78 Av. du Président Wilson, 93200",      distance: "8.1 km", open: false },
  { id: "4", name: "Agence Conakry Centre",    address: "Quartier Kaloum, Conakry, Guinée",        distance: "—",      open: true },
  { id: "5", name: "Agence Dakar Plateau",     address: "12 Av. Léopold Sédar Senghor, Dakar",   distance: "—",      open: true },
];

export default function LocationsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const role = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
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
            <TouchableOpacity style={s.card} activeOpacity={0.85}>
              <View style={[s.iconBox, { backgroundColor: `${theme.accent}15` }]}>
                <Ionicons name="location" size={22} color={theme.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.name, { fontFamily: T.font.sans }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[s.address, { fontFamily: T.font.sans }]} numberOfLines={1}>{item.address}</Text>
                <View style={s.metaRow}>
                  <View style={[s.openPill, { backgroundColor: item.open ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", borderColor: item.open ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)" }]}>
                    <View style={[s.openDot, { backgroundColor: item.open ? T.green : "#EF4444" }]} />
                    <Text style={[s.openTxt, { color: item.open ? T.green : "#EF4444", fontFamily: T.font.sans }]}>
                      {item.open ? "Ouvert" : "Fermé"}
                    </Text>
                  </View>
                </View>
              </View>
              {item.distance !== "—" && (
                <View style={[s.distBox, { backgroundColor: `${theme.accent}10`, borderColor: `${theme.accent}20` }]}>
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
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 14,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ghost, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.inkBorder },
  headerTitle: { color: T.white, fontSize: 22, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  list: { paddingHorizontal: 20 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14, marginTop: 4 },
  sectionDot: { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },

  card: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.ghost, borderRadius: 18,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: T.inkBorder,
  },
  iconBox: { width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  name: { color: T.white, fontSize: 14, fontWeight: "700", marginBottom: 3 },
  address: { color: T.dim, fontSize: 11, fontWeight: "600", marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center" },
  openPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  openDot: { width: 5, height: 5, borderRadius: 99 },
  openTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
  distBox: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  distTxt: { fontSize: 11, fontWeight: "800" },
});