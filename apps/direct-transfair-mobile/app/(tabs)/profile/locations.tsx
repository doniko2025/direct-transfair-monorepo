// apps/direct-transfair-mobile/app/(tabs)/profile/locations.tsx
// =========================================================
// LOCATIONS v6.1 — Direct Transf'air
// Design: Light & Premium — Points de retrait
// ✅ Données dynamiques depuis l'API
// ✅ Type Agency importé depuis services/types
// =========================================================

import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, StatusBar, Platform, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { Agency } from "../../../services/types";
import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";

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

export default function LocationsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const role = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgencies = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getAgencies();
      setAgencies(data);
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Impossible de charger les agences.";
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAgencies(); }, [fetchAgencies]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAgencies();
  };

  const renderItem = ({ item }: { item: Agency }) => (
    <TouchableOpacity style={s.card} activeOpacity={0.8}>
      <View style={[s.iconBox, { backgroundColor: theme.accentSoft }]}>
        <Ionicons name="location" size={20} color={theme.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.name, { fontFamily: T.font.sans }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[s.address, { fontFamily: T.font.sans }]} numberOfLines={1}>
          {[item.address, item.city, item.country].filter(Boolean).join(", ")}
        </Text>
        <View style={s.metaRow}>
          <View style={[
            s.openPill,
            {
              backgroundColor: item.isActive ? "#DCFCE7" : "#FEE2E2",
              borderColor: item.isActive ? "#16A34A40" : "#DC262640",
            }
          ]}>
            <View style={[s.openDot, { backgroundColor: item.isActive ? T.green : T.red }]} />
            <Text style={[s.openTxt, { color: item.isActive ? T.green : T.red, fontFamily: T.font.sans }]}>
              {item.isActive ? "Ouvert" : "Fermé"}
            </Text>
          </View>
          {role === "SUPER_ADMIN" && item.clientName ? (
            <View style={[s.clientPill, { backgroundColor: theme.accentSoft }]}>
              <Text style={[s.clientTxt, { color: theme.accent, fontFamily: T.font.sans }]}>
                {item.clientName}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={[s.distBox, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
        <Text style={[s.distTxt, { color: theme.accent, fontFamily: T.font.mono }]}>
          {item.primaryCurrency ?? "—"}
        </Text>
      </View>
    </TouchableOpacity>
  );

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
              {loading
                ? "Chargement…"
                : `${agencies.length} point${agencies.length > 1 ? "s" : ""} Direct Transf'air`}
            </Text>
          </View>
        </View>

        {loading && (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[s.loadingTxt, { fontFamily: T.font.sans, color: T.textSub }]}>
              Chargement des agences…
            </Text>
          </View>
        )}

        {!loading && error && (
          <View style={s.centered}>
            <Ionicons name="alert-circle-outline" size={40} color={T.red} />
            <Text style={[s.errorTxt, { fontFamily: T.font.sans }]}>{error}</Text>
            <TouchableOpacity style={[s.retryBtn, { backgroundColor: theme.accent }]} onPress={fetchAgencies}>
              <Text style={[s.retryTxt, { fontFamily: T.font.sans }]}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && (
          <FlatList
            data={agencies}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
            }
            ListHeaderComponent={
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: theme.accent }]} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>
                  {role === "SUPER_ADMIN" ? "TOUTES LES AGENCES" : "AGENCES À PROXIMITÉ"}
                </Text>
              </View>
            }
            renderItem={renderItem}
            ListEmptyComponent={
              <View style={s.centered}>
                <Ionicons name="business-outline" size={40} color={T.textDim} />
                <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>
                  Aucune agence disponible.
                </Text>
              </View>
            }
            ListFooterComponent={<View style={{ height: 80 }} />}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 16, gap: 12,
    backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: "#F3F4F6",
    justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border,
  },
  headerTitle: { color: T.text, fontSize: 18, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  list: { paddingHorizontal: 20, paddingTop: 16 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionDot: { width: 6, height: 6, borderRadius: 99 },
  sectionLabel: {
    fontSize: 10, fontWeight: "900", color: T.textSub,
    letterSpacing: 1.5, textTransform: "uppercase",
  },

  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.surface, borderRadius: 16,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.border,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  iconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  name: { color: T.text, fontSize: 14, fontWeight: "700", marginBottom: 3 },
  address: { color: T.textDim, fontSize: 11, fontWeight: "600", marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  openPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1,
  },
  openDot: { width: 5, height: 5, borderRadius: 99 },
  openTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
  clientPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  clientTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  distBox: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, borderWidth: 1,
    flexDirection: "row", alignItems: "center", gap: 4,
  },
  distTxt: { fontSize: 11, fontWeight: "800" },

  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 32 },
  loadingTxt: { fontSize: 13, marginTop: 8 },
  errorTxt: { color: T.red, fontSize: 13, textAlign: "center" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  retryTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  emptyTxt: { color: T.textDim, fontSize: 13, textAlign: "center" },
});