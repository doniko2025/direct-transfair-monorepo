// apps/direct-transfair-mobile/app/(tabs)/profile/locations.tsx
// =========================================================
// LOCATIONS v6.3 — Direct Transf'air
// ✅ v6.2 : fetchAgencies multi-endpoints, 403 silencieux
// ✅ v6.3 :
//    - Téléphone affiché sur chaque carte (si disponible)
//    - Email affiché sur chaque carte (si disponible)
//    - Chaque info cliquable : tel: / mailto: via Linking
//    - Affichage conditionnel : rien si champ absent en base
//    - Carte wrapper → View (pas de faux tap sans action)
// =========================================================

import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, StatusBar, Platform, ActivityIndicator,
  RefreshControl, Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { Agency } from "../../../services/types";
import { useAuth } from "../../../providers/AuthProvider";
import { api } from "../../../services/api";

// ─── Thème par rôle ──────────────────────────────────────
const ROLE_THEMES = {
  SUPER_ADMIN:   { bg: "#F8FAFF", accent: "#1D4ED8", accentSoft: "#EFF6FF" },
  COMPANY_ADMIN: { bg: "#F0FDFA", accent: "#0D9488", accentSoft: "#CCFBF1" },
  AGENT:         { bg: "#FFFBEB", accent: "#D97706", accentSoft: "#FEF3C7" },
  USER:          { bg: "#F0FDF4", accent: "#059669", accentSoft: "#DCFCE7" },
} as const;

const T = {
  surface: "#FFFFFF",
  text:    "#0F172A",
  textSub: "#475569",
  textDim: "#94A3B8",
  border:  "#E2E8F0",
  borderLight: "#F1F5F9",
  green:   "#16A34A",
  red:     "#DC2626",
  blue:    "#2563EB",
  blueSoft:"#EFF6FF",
  radius:  { md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

const AGENCY_ENDPOINTS = ["/agencies", "/agencies/public", "/locations"] as const;

function unwrapAgencies(raw: unknown): Agency[] {
  if (Array.isArray(raw)) return raw as Agency[];
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.data))  return r.data  as Agency[];
    if (Array.isArray(r.items)) return r.items as Agency[];
  }
  return [];
}

// ─── Ouvre tel: ou mailto: sans crash ────────────────────
async function openLink(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  } catch { /* noop */ }
}

export default function LocationsScreen() {
  const router   = useRouter();
  const { user } = useAuth();

  const role  = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;

  const [agencies,   setAgencies]   = useState<Agency[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const fetchAgencies = useCallback(async () => {
    try {
      setError(null);
      let found: Agency[] = [];
      let allForbidden = true;

      for (const endpoint of AGENCY_ENDPOINTS) {
        try {
          const res = await api.http.get<unknown>(endpoint);
          found        = unwrapAgencies(res.data);
          allForbidden = false;
          break;
        } catch (err: any) {
          const status = err?.response?.status as number | undefined;
          if (status === 403 || status === 401) continue;
          throw err;
        }
      }

      setAgencies(allForbidden ? [] : found);
    } catch (e: any) {
      const raw = e?.response?.data?.message;
      setError(Array.isArray(raw) ? raw[0] : (raw || "Impossible de charger les agences."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchAgencies(); }, [fetchAgencies]);

  const onRefresh = () => { setRefreshing(true); void fetchAgencies(); };

  // ── Carte agence ─────────────────────────────────────────
  const renderItem = ({ item }: { item: Agency }) => {
    const ag = item as any;

    // ✅ Champs contact — plusieurs noms possibles selon le backend
    const phone = ag.phone || ag.phoneNumber || ag.tel || null;
    const email = ag.email || ag.contactEmail || null;
    const hasContact = !!(phone || email);

    return (
      <View style={s.card}>

        {/* Icône agence */}
        <View style={[s.iconBox, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="location" size={20} color={theme.accent} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>

          {/* Nom */}
          <Text style={[s.name, { fontFamily: T.font.sans }]} numberOfLines={1}>
            {item.name}
          </Text>

          {/* Adresse */}
          <Text style={[s.address, { fontFamily: T.font.sans }]} numberOfLines={1}>
            {[ag.address, item.city, item.country].filter(Boolean).join(", ")}
          </Text>

          {/* Statut + client (SuperAdmin) */}
          <View style={s.metaRow}>
            <View style={[
              s.openPill,
              {
                backgroundColor: item.isActive ? "#DCFCE7" : "#FEE2E2",
                borderColor:     item.isActive ? "#16A34A40" : "#DC262640",
              },
            ]}>
              <View style={[s.openDot, { backgroundColor: item.isActive ? T.green : T.red }]} />
              <Text style={[s.openTxt, { color: item.isActive ? T.green : T.red, fontFamily: T.font.sans }]}>
                {item.isActive ? "Ouvert" : "Fermé"}
              </Text>
            </View>
            {role === "SUPER_ADMIN" && ag.clientName ? (
              <View style={[s.clientPill, { backgroundColor: theme.accentSoft }]}>
                <Text style={[s.clientTxt, { color: theme.accent, fontFamily: T.font.sans }]}>
                  {ag.clientName}
                </Text>
              </View>
            ) : null}
          </View>

          {/* ── Contact (téléphone + email) ── */}
          {hasContact && (
            <View>
              <View style={s.contactDivider} />
              <View style={s.contactRow}>

                {/* Téléphone — cliquable */}
                {phone && (
                  <TouchableOpacity
                    style={s.contactBtn}
                    onPress={() => openLink(`tel:${phone.replace(/\s/g, "")}`)}
                    activeOpacity={0.7}
                    hitSlop={8}
                  >
                    <View style={[s.contactIconBox, { backgroundColor: theme.accentSoft }]}>
                      <Ionicons name="call-outline" size={11} color={theme.accent} />
                    </View>
                    <Text style={[s.contactTxt, { color: T.textSub, fontFamily: T.font.mono }]}>
                      {phone}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Email — cliquable */}
                {email && (
                  <TouchableOpacity
                    style={[s.contactBtn, { flex: 1 }]}
                    onPress={() => openLink(`mailto:${email}`)}
                    activeOpacity={0.7}
                    hitSlop={8}
                  >
                    <View style={[s.contactIconBox, { backgroundColor: T.blueSoft }]}>
                      <Ionicons name="mail-outline" size={11} color={T.blue} />
                    </View>
                    <Text
                      style={[s.contactTxt, { color: T.textSub, fontFamily: T.font.sans }]}
                      numberOfLines={1}
                    >
                      {email}
                    </Text>
                  </TouchableOpacity>
                )}

              </View>
            </View>
          )}
        </View>

        {/* Badge devise */}
        <View style={[s.currBox, { backgroundColor: theme.accentSoft, borderColor: theme.accent + "40" }]}>
          <Text style={[s.currTxt, { color: theme.accent, fontFamily: T.font.mono }]}>
            {item.primaryCurrency ?? "—"}
          </Text>
        </View>
      </View>
    );
  };

  const headerSub = loading
    ? "Chargement…"
    : error
      ? "Erreur de chargement"
      : agencies.length === 0
        ? "Aucun point disponible pour le moment"
        : `${agencies.length} point${agencies.length > 1 ? "s" : ""} Direct Transf'air`;

  return (
    <LinearGradient colors={[theme.bg, "rgba(255,255,255,0.3)"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Nos Agences</Text>
            <Text style={[s.headerSub, { color: error ? T.red : theme.accent, fontFamily: T.font.sans }]}>
              {headerSub}
            </Text>
          </View>
        </View>

        {/* ── Chargement ── */}
        {loading && (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[s.loadingTxt, { fontFamily: T.font.sans, color: T.textSub }]}>
              Chargement des agences…
            </Text>
          </View>
        )}

        {/* ── Erreur réseau ── */}
        {!loading && !!error && (
          <View style={s.centered}>
            <Ionicons name="cloud-offline-outline" size={44} color={T.red} />
            <Text style={[s.errorTxt, { fontFamily: T.font.sans }]}>{error}</Text>
            <TouchableOpacity
              style={[s.retryBtn, { backgroundColor: theme.accent }]}
              onPress={onRefresh}
            >
              <Text style={[s.retryTxt, { fontFamily: T.font.sans }]}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Liste ── */}
        {!loading && !error && (
          <FlatList
            data={agencies}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.accent}
                colors={[theme.accent]}
              />
            }
            ListHeaderComponent={
              agencies.length > 0 ? (
                <View style={s.sectionRow}>
                  <View style={[s.sectionDot, { backgroundColor: theme.accent }]} />
                  <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>
                    {role === "SUPER_ADMIN" ? "TOUTES LES AGENCES" : "POINTS DE SERVICE"}
                  </Text>
                </View>
              ) : null
            }
            renderItem={renderItem}
            ListEmptyComponent={
              <View style={s.centered}>
                <View style={[s.emptyIcon, { backgroundColor: theme.accentSoft }]}>
                  <Ionicons name="storefront-outline" size={30} color={theme.accent} />
                </View>
                <Text style={[s.emptyTitle, { fontFamily: T.font.display }]}>
                  Aucune agence disponible
                </Text>
                <Text style={[s.emptySubtxt, { fontFamily: T.font.sans }]}>
                  Les points Direct Transf'air{"\n"}apparaîtront ici dès leur ouverture.
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
  headerSub:   { fontSize: 11, fontWeight: "700", marginTop: 2 },

  list:       { paddingHorizontal: 20, paddingTop: 16 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionDot: { width: 6, height: 6, borderRadius: 99 },
  sectionLabel: { fontSize: 10, fontWeight: "900", color: T.textSub, letterSpacing: 1.5, textTransform: "uppercase" },

  // ── Carte ──
  card: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: T.surface, borderRadius: 16, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: T.border,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  iconBox:  { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 1, flexShrink: 0 },
  name:     { color: T.text, fontSize: 14, fontWeight: "700", marginBottom: 3 },
  address:  { color: T.textDim, fontSize: 11, fontWeight: "600", marginBottom: 6 },
  metaRow:  { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  openPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  openDot:  { width: 5, height: 5, borderRadius: 99 },
  openTxt:  { fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
  clientPill:{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  clientTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  currBox:  { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, borderWidth: 1, alignItems: "center", alignSelf: "flex-start", marginTop: 2, flexShrink: 0 },
  currTxt:  { fontSize: 11, fontWeight: "800" },

  // ── Contact ──
  contactDivider: { height: 1, backgroundColor: T.borderLight, marginTop: 9, marginBottom: 7 },
  contactRow:     { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  contactBtn:     { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
  contactIconBox: { width: 20, height: 20, borderRadius: 6, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  contactTxt:     { fontSize: 10, fontWeight: "700", color: T.textSub, flexShrink: 1 },

  // ── États ──
  centered:   { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 32 },
  loadingTxt: { fontSize: 13, marginTop: 8 },
  errorTxt:   { color: T.red, fontSize: 13, textAlign: "center", lineHeight: 20 },
  retryBtn:   { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 4 },
  retryTxt:   { color: "#fff", fontSize: 13, fontWeight: "700" },
  emptyIcon:    { width: 64, height: 64, borderRadius: 18, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle:   { color: T.text, fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptySubtxt:  { color: T.textDim, fontSize: 12, textAlign: "center", lineHeight: 18 },
});