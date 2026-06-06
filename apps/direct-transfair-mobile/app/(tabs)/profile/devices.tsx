// apps/direct-transfair-mobile/app/(tabs)/profile/devices.tsx
// =========================================================
// DEVICES v6.0 — Direct Transf'air
// ✅ v6.0 : Zéro donnée en dur — tout vient de GET /auth/devices
//           api.getDevices()  → liste les vrais appareils
//           api.revokeDevice() → révoque un appareil
//           Appareil actuel détecté via deviceId stocké en AsyncStorage
// =========================================================

import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Platform, Alert, ActivityIndicator,
  RefreshControl, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  surface:   "#FFFFFF",
  text:      "#0F172A",
  textSub:   "#475569",
  textDim:   "#94A3B8",
  border:    "#E2E8F0",
  green:     "#16A34A",
  greenSoft: "#DCFCE7",
  red:       "#DC2626",
  redSoft:   "#FEE2E2",
  blue:      "#0284C7",
  infoSoft:  "#E0F2FE",
  radius:    { md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// ─── Icône selon plateforme ───────────────────────────────
function platformIcon(platform?: string): string {
  const p = (platform ?? "").toUpperCase();
  if (p === "IOS")     return "phone-portrait-outline";
  if (p === "ANDROID") return "phone-portrait-outline";
  if (p === "WEB")     return "desktop-outline";
  if (p === "DESKTOP") return "laptop-outline";
  return "phone-portrait-outline";
}

// ─── Formatage date relative ──────────────────────────────
function relativeTime(isoDate?: string | null): string {
  if (!isoDate) return "Date inconnue";
  try {
    const diff = Date.now() - new Date(isoDate).getTime();
    if (diff < 60_000)      return "En ligne maintenant";
    if (diff < 3_600_000)   return `Il y a ${Math.floor(diff / 60_000)} min`;
    if (diff < 86_400_000)  return `Il y a ${Math.floor(diff / 3_600_000)} h`;
    if (diff < 604_800_000) return `Il y a ${Math.floor(diff / 86_400_000)} jour${Math.floor(diff / 86_400_000) > 1 ? "s" : ""}`;
    return new Date(isoDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "Date inconnue"; }
}

// ─── Device Card ──────────────────────────────────────────
function DeviceCard({ device, isCurrent, onRevoke, revoking }: {
  device: any; isCurrent: boolean; onRevoke: () => void; revoking: boolean;
}) {
  const icon   = platformIcon(device.platform);
  const status = (device.status ?? "").toUpperCase();
  const isTrusted  = status === "TRUSTED";
  const isSuspended = status === "REVOKED";

  const detail = [
    device.ipAddress,
    relativeTime(device.lastUsedAt),
  ].filter(Boolean).join(" · ");

  const deviceLabel = device.deviceName ?? device.deviceModel ?? `Appareil ${device.platform ?? "inconnu"}`;

  return (
    <View style={[
      dcS.card,
      isCurrent && { borderColor: `${T.green}40` },
      isSuspended && { opacity: 0.6 },
    ]}>
      <View style={[dcS.iconBox, { backgroundColor: isCurrent ? T.greenSoft : "#F3F4F6" }]}>
        <Ionicons name={icon as any} size={18} color={isCurrent ? T.green : T.textDim} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[dcS.name, { fontFamily: T.font.sans }]} numberOfLines={1}>
          {deviceLabel}
        </Text>
        {device.osVersion && (
          <Text style={[dcS.os, { fontFamily: T.font.mono }]}>{device.osVersion}</Text>
        )}
        <Text style={[dcS.detail, { fontFamily: T.font.sans }]} numberOfLines={1}>{detail}</Text>
      </View>
      {isCurrent ? (
        <View style={dcS.activeBadge}>
          <View style={dcS.activeDot} />
          <Text style={[dcS.activeTxt, { fontFamily: T.font.sans }]}>Actif</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[dcS.revokeBtn, revoking && { opacity: 0.5 }]}
          onPress={onRevoke}
          disabled={revoking || isSuspended}
        >
          {revoking
            ? <ActivityIndicator size="small" color={T.red} />
            : <Text style={[dcS.revokeTxt, { fontFamily: T.font.sans }]}>
                {isSuspended ? "Révoqué" : "Déconnecter"}
              </Text>
          }
        </TouchableOpacity>
      )}
    </View>
  );
}
const dcS = StyleSheet.create({
  card:       { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  iconBox:    { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  name:       { color: T.text, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  os:         { color: T.textDim, fontSize: 10, fontWeight: "600", marginBottom: 1 },
  detail:     { color: T.textDim, fontSize: 11, fontWeight: "600" },
  activeBadge:{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: T.greenSoft, borderWidth: 1, borderColor: `${T.green}40` },
  activeDot:  { width: 5, height: 5, borderRadius: 99, backgroundColor: T.green },
  activeTxt:  { color: T.green, fontSize: 10, fontWeight: "900" },
  revokeBtn:  { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#FECACA", minWidth: 96, alignItems: "center" },
  revokeTxt:  { color: T.red, fontSize: 11, fontWeight: "800" },
});

// ─── Main Screen ──────────────────────────────────────────
export default function DevicesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const role  = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;

  const [devices,    setDevices]    = useState<any[]>([]);
  const [currentId,  setCurrentId]  = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [revoking,   setRevoking]   = useState<Record<string, boolean>>({});
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Charge l'ID de l'appareil actuel depuis AsyncStorage ──
  useEffect(() => {
    AsyncStorage.getItem("deviceId")
      .then((id) => { if (id) setCurrentId(id); })
      .catch(() => {});
  }, []);

  // ── Chargement des appareils depuis l'API ──────────────
  const fetchDevices = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await api.getDevices();
      setDevices(data);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e: any) {
      const raw = e?.response?.data?.message ?? e?.message ?? "Impossible de charger les appareils";
      setError(Array.isArray(raw) ? raw[0] : String(raw));
    } finally {
      if (mode === "refresh") setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchDevices("init"); }, [fetchDevices]);

  // ── Révoquer un appareil ──────────────────────────────
  const handleRevoke = (device: any) => {
    const name = device.deviceName ?? device.deviceModel ?? "cet appareil";
    Alert.alert(
      "Déconnecter cet appareil",
      `Voulez-vous déconnecter "${name}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnecter",
          style: "destructive",
          onPress: async () => {
            setRevoking((prev) => ({ ...prev, [device.id]: true }));
            try {
              await api.revokeDevice(device.id);
              await fetchDevices("refresh");
            } catch (e: any) {
              const raw = e?.response?.data?.message ?? e?.message ?? "Erreur lors de la déconnexion";
              Alert.alert("Erreur", Array.isArray(raw) ? raw[0] : String(raw));
            } finally {
              setRevoking((prev) => ({ ...prev, [device.id]: false }));
            }
          },
        },
      ]
    );
  };

  // ── Séparer appareil actuel des autres ─────────────────
  // L'appareil actuel = celui dont l'id correspond au deviceId stocké,
  // ou à défaut le dernier utilisé (lastUsedAt le plus récent)
  const sortedDevices = [...devices].sort((a, b) => {
    const ta = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
    const tb = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
    return tb - ta;
  });

  const currentDevice = currentId
    ? sortedDevices.find((d) => d.id === currentId || d.deviceId === currentId)
    : sortedDevices[0]; // fallback : le plus récemment utilisé

  const otherDevices = sortedDevices.filter((d) => d.id !== currentDevice?.id);

  return (
    <LinearGradient colors={[theme.bg, "rgba(255,255,255,0.3)"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Appareils Connectés</Text>
            <Text style={[s.headerSub, { color: theme.accent, fontFamily: T.font.sans }]}>
              {loading
                ? "Chargement…"
                : `${devices.length} appareil${devices.length > 1 ? "s" : ""}${otherDevices.length > 0 ? ` · ${otherDevices.length} autre${otherDevices.length > 1 ? "s" : ""}` : ""}`
              }
            </Text>
          </View>
        </View>

        {/* Chargement */}
        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : error ? (
          <View style={s.centered}>
            <Ionicons name="alert-circle-outline" size={36} color={T.red} />
            <Text style={[s.errorTxt, { fontFamily: T.font.sans }]}>{error}</Text>
            <TouchableOpacity style={[s.retryBtn, { borderColor: theme.accent }]} onPress={() => fetchDevices("init")}>
              <Text style={[s.retryTxt, { color: theme.accent, fontFamily: T.font.sans }]}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Animated.ScrollView
            style={{ opacity: fadeAnim }}
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void fetchDevices("refresh")}
                tintColor={theme.accent}
                colors={[theme.accent]}
              />
            }
          >
            {/* Info banner */}
            <View style={[s.infoBanner, { backgroundColor: T.infoSoft, borderColor: T.blue }]}>
              <Ionicons name="shield-outline" size={16} color={T.blue} />
              <Text style={[s.infoTxt, { fontFamily: T.font.sans }]}>
                Gérez les appareils ayant accès à votre compte. Déconnectez ceux que vous ne reconnaissez pas.
              </Text>
            </View>

            {/* Appareil actuel */}
            {currentDevice && (
              <>
                <View style={s.sectionRow}>
                  <View style={[s.sectionDot, { backgroundColor: T.green }]} />
                  <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>APPAREIL ACTUEL</Text>
                </View>
                <DeviceCard
                  device={currentDevice}
                  isCurrent
                  onRevoke={() => {}}
                  revoking={false}
                />
              </>
            )}

            {/* Autres appareils */}
            {otherDevices.length > 0 && (
              <>
                <View style={[s.sectionRow, { marginTop: 20 }]}>
                  <View style={[s.sectionDot, { backgroundColor: T.textDim }]} />
                  <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>AUTRES APPAREILS</Text>
                </View>
                {otherDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    isCurrent={false}
                    onRevoke={() => handleRevoke(device)}
                    revoking={revoking[device.id] ?? false}
                  />
                ))}
              </>
            )}

            {/* Aucun appareil */}
            {devices.length === 0 && (
              <View style={s.centered}>
                <Ionicons name="phone-portrait-outline" size={36} color={T.textDim} />
                <Text style={[s.errorTxt, { fontFamily: T.font.sans }]}>
                  Aucun appareil enregistré
                </Text>
              </View>
            )}

            <View style={{ height: 80 }} />
          </Animated.ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 12,
    backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn:     { width: 38, height: 38, borderRadius: 10, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  headerTitle: { color: T.text, fontSize: 18, fontWeight: "700" },
  headerSub:   { fontSize: 11, fontWeight: "700", marginTop: 2 },

  scroll:   { paddingHorizontal: 20, paddingTop: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 32 },
  errorTxt: { color: T.textSub, fontSize: 13, fontWeight: "600", textAlign: "center" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginTop: 4 },
  retryTxt: { fontWeight: "800", fontSize: 13 },

  infoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 20 },
  infoTxt:    { flex: 1, color: T.blue, fontSize: 12, fontWeight: "600", lineHeight: 18 },

  sectionRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionDot:   { width: 6, height: 6, borderRadius: 99 },
  sectionLabel: { fontSize: 10, fontWeight: "900", color: T.textSub, letterSpacing: 1.5, textTransform: "uppercase" },
});