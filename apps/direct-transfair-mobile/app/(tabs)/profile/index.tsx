//apps/direct-transfair-mobile/app/(tabs)/profile/index.tsx
// apps/direct-transfair-mobile/app/(tabs)/profile/index.tsx
// =========================================================
// PROFILE INDEX v4.0 — Direct Transf'air
// Design: Dark premium thématique par rôle
// ✅ Menu adapté par rôle (pas de plafonds pour admins)
// ✅ Jauge sécurité, déconnexion élégante
// =========================================================

import React, { useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Platform, Alert, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../../providers/AuthProvider";

// ─── Thèmes par rôle ─────────────────────────────────────
const ROLE_THEMES = {
  SUPER_ADMIN:   { g1: "#0A0A0F", g2: "#12121A", accent: "#D4A853", label: "Super Admin",    icon: "shield-checkmark" },
  COMPANY_ADMIN: { g1: "#030B1A", g2: "#071224", accent: "#34D399", label: "Admin Société",  icon: "business" },
  AGENT:         { g1: "#1A0E00", g2: "#211200", accent: "#F59E0B", label: "Agent",           icon: "people" },
  USER:          { g1: "#0B1F14", g2: "#0F2A1C", accent: "#10B981", label: "Client",          icon: "person" },
} as const;

const T = {
  ghost: "rgba(255,255,255,0.06)",
  ghostMid: "rgba(255,255,255,0.10)",
  inkBorder: "rgba(255,255,255,0.08)",
  white: "#FFFFFF",
  dim: "#8A9BB5",
  red: "#EF4444",
  radius: { sm: 10, md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Menu Row ─────────────────────────────────────────────
function MenuRow({
  icon, label, accent, onPress, rightElement, danger = false, disabled = false,
}: {
  icon: string; label: string; accent: string; onPress?: () => void;
  rightElement?: React.ReactNode; danger?: boolean; disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={mrS.row}
        onPress={onPress}
        disabled={disabled || !onPress}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={[mrS.iconBox, { backgroundColor: danger ? "rgba(239,68,68,0.10)" : `${accent}12` }]}>
          <Ionicons name={icon as any} size={18} color={danger ? T.red : accent} />
        </View>
        <Text style={[mrS.label, { fontFamily: T.font.sans }, danger && { color: T.red }]}>
          {label}
        </Text>
        {rightElement ?? (
          <View style={[mrS.chevronBox, { backgroundColor: `${accent}10` }]}>
            <Ionicons name="chevron-forward" size={13} color={danger ? T.red : accent} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
const mrS = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.inkBorder,
  },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  label: { flex: 1, fontSize: 14, fontWeight: "600", color: T.white },
  chevronBox: { width: 26, height: 26, borderRadius: 8, justifyContent: "center", alignItems: "center" },
});

// ─── Section ──────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={[sS.title, { fontFamily: T.font.sans }]}>{title}</Text>
      <View style={sS.card}>{children}</View>
    </View>
  );
}
const sS = StyleSheet.create({
  title: { fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 10 },
  card: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    paddingHorizontal: 16, borderWidth: 1, borderColor: T.inkBorder,
  },
});

// ─── Main Screen ──────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const role = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;

  const isAdmin = role === "SUPER_ADMIN" || role === "COMPANY_ADMIN";
  const isAgent = role === "AGENT";
  const isUser = role === "USER";

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : "Utilisateur";

  const initials = user?.firstName
    ? `${user.firstName[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "DT";

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Fermer votre session Direct Transf'air ?")) void logout();
      return;
    }
    Alert.alert(
      "Déconnexion sécurisée",
      "Êtes-vous sûr de vouloir fermer votre session ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Me déconnecter",
          style: "destructive",
          onPress: async () => {
            await logout();
            if (router.canDismiss()) router.dismissAll();
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  };

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero identité ── */}
          <View style={s.hero}>
            <LinearGradient
              colors={[`${theme.accent}25`, `${theme.accent}08`]}
              style={s.avatarBox}
            >
              <Text style={[s.initials, { color: theme.accent, fontFamily: T.font.display }]}>
                {initials}
              </Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[s.name, { fontFamily: T.font.display }]}>{displayName}</Text>
              <Text style={[s.userId, { fontFamily: T.font.mono }]}>
                {user?.id?.slice(0, 12).toUpperCase() ?? "—"}
              </Text>
              <View style={[s.rolePill, { backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}25` }]}>
                <Ionicons name={theme.icon as any} size={11} color={theme.accent} />
                <Text style={[s.roleLabel, { color: theme.accent, fontFamily: T.font.sans }]}>
                  {theme.label}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Jauge sécurité (Clients seulement) ── */}
          {isUser && (
            <View style={s.secCard}>
              <View style={s.secTop}>
                <Ionicons name="shield-checkmark" size={16} color={theme.accent} />
                <Text style={[s.secTitle, { fontFamily: T.font.sans }]}>Sécurité du compte</Text>
                <Text style={[s.secScore, { color: theme.accent, fontFamily: T.font.display }]}>85%</Text>
              </View>
              <View style={s.secBarBg}>
                <View style={[s.secBarFill, { width: "85%", backgroundColor: theme.accent }]} />
              </View>
              <Text style={[s.secHint, { fontFamily: T.font.sans }]}>
                Activez la validation 2FA pour atteindre 100%
              </Text>
            </View>
          )}

          {/* ── MON COMPTE ── */}
          <Section title="MON COMPTE">
            <MenuRow
              icon="person-outline"
              label="Informations personnelles"
              accent={theme.accent}
              onPress={() => router.push("/(tabs)/profile/personal-info")}
            />
            {/* Moyens de paiement : USER uniquement */}
            {isUser && (
              <MenuRow
                icon="card-outline"
                label="Moyens de paiement"
                accent={theme.accent}
                onPress={() => router.push("/(tabs)/profile/payment-methods")}
              />
            )}
            {/* Plafonds : USER uniquement — pas pertinent pour admins/agents */}
            {isUser && (
              <MenuRow
                icon="speedometer-outline"
                label="Mes plafonds de transfert"
                accent={theme.accent}
                onPress={() => router.push("/(tabs)/profile/limits")}
              />
            )}
            {/* Points de retrait : USER + AGENT */}
            {(isUser || isAgent) && (
              <MenuRow
                icon="location-outline"
                label="Points Direct Transf'air"
                accent={theme.accent}
                onPress={() => router.push("/(tabs)/profile/locations")}
              />
            )}
          </Section>

          {/* ── SÉCURITÉ & APPAREILS ── */}
          <Section title="SÉCURITÉ & APPAREILS">
            <MenuRow
              icon="phone-portrait-outline"
              label="Appareils connectés"
              accent={theme.accent}
              onPress={() => router.push("/(tabs)/profile/devices")}
            />
            <MenuRow
              icon="keypad-outline"
              label="Modifier mon code secret"
              accent={theme.accent}
              onPress={() => router.push("/(tabs)/profile/security")}
            />
            <MenuRow
              icon="finger-print-outline"
              label="Biométrie (Face ID / Touch ID)"
              accent={theme.accent}
              rightElement={
                <View style={[s.toggle, { backgroundColor: theme.accent }]}>
                  <View style={s.toggleKnob} />
                </View>
              }
            />
          </Section>

          {/* ── ADMIN SEULEMENT ── */}
          {isAdmin && (
            <Section title="ADMINISTRATION">
              <MenuRow
                icon="analytics-outline"
                label="Tableau de bord admin"
                accent={theme.accent}
                onPress={() => router.back()}
              />
              <MenuRow
                icon="notifications-outline"
                label="Préférences de notifications"
                accent={theme.accent}
                onPress={() => {}}
              />
            </Section>
          )}

          {/* ── DÉCONNEXION ── */}
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <Ionicons name="power-outline" size={18} color={T.red} />
            <Text style={[s.logoutTxt, { fontFamily: T.font.sans }]}>Fermer la session</Text>
          </TouchableOpacity>

          {isUser && (
            <TouchableOpacity style={s.deleteBtn} activeOpacity={0.7}>
              <Ionicons name="warning-outline" size={14} color={T.dim} />
              <Text style={[s.deleteTxt, { fontFamily: T.font.sans }]}>Supprimer mon compte</Text>
            </TouchableOpacity>
          )}

          <Text style={[s.version, { fontFamily: T.font.mono }]}>
            Direct Transf'air v4.0 · Build 500
          </Text>

          <View style={{ height: 110 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 54 : 20, paddingBottom: 20 },

  hero: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24 },
  avatarBox: {
    width: 60, height: 60, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  initials: { fontSize: 24, fontWeight: "900" },
  name: { color: T.white, fontSize: 20, fontWeight: "700", marginBottom: 3 },
  userId: { color: T.dim, fontSize: 10, fontWeight: "700", marginBottom: 8, letterSpacing: 1 },
  rolePill: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
  roleLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },

  secCard: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 16, marginBottom: 20, borderWidth: 1, borderColor: T.inkBorder,
  },
  secTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  secTitle: { flex: 1, fontSize: 13, fontWeight: "700", color: T.white },
  secScore: { fontSize: 18, fontWeight: "900" },
  secBarBg: { height: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 99, marginBottom: 8, overflow: "hidden" },
  secBarFill: { height: 4, borderRadius: 99 },
  secHint: { color: T.dim, fontSize: 10, fontWeight: "600" },

  toggle: { width: 42, height: 23, borderRadius: 99, justifyContent: "center", paddingHorizontal: 2 },
  toggleKnob: { width: 19, height: 19, borderRadius: 99, backgroundColor: T.white, alignSelf: "flex-end" },

  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "rgba(239,68,68,0.08)", borderRadius: T.radius.md,
    paddingVertical: 16, marginTop: 8, marginBottom: 12,
    borderWidth: 1, borderColor: "rgba(239,68,68,0.18)",
  },
  logoutTxt: { color: T.red, fontWeight: "800", fontSize: 14 },

  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, marginBottom: 20 },
  deleteTxt: { color: T.dim, fontSize: 12, fontWeight: "600" },

  version: { textAlign: "center", color: T.dim, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
});