// apps/direct-transfair-mobile/app/(tabs)/qr.tsx
// =========================================================
// QR CODE SCREEN v4.0 — Direct Transf'air
// Design: Dark premium thématique par rôle (USER = Émeraude)
// ✅ QR placeholder stylisé, scanner, partage
// =========================================================

import React, { useRef } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  Platform, StatusBar, Animated, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../providers/AuthProvider";

// ─── Thèmes ──────────────────────────────────────────────
const ROLE_THEMES = {
  SUPER_ADMIN:   { g1: "#0A0A0F", g2: "#12121A", accent: "#D4A853", accentSoft: "#F0C97A" },
  COMPANY_ADMIN: { g1: "#030B1A", g2: "#071224", accent: "#34D399", accentSoft: "#6EE7B7" },
  AGENT:         { g1: "#1A0E00", g2: "#211200", accent: "#F59E0B", accentSoft: "#FCD34D" },
  USER:          { g1: "#0B1F14", g2: "#0F2A1C", accent: "#10B981", accentSoft: "#34D399" },
} as const;

const T = {
  ghost: "rgba(255,255,255,0.06)",
  ghostMid: "rgba(255,255,255,0.10)",
  inkBorder: "rgba(255,255,255,0.08)",
  white: "#FFFFFF",
  dim: "#8A9BB5",
  radius: { md: 14, lg: 20, xl: 28 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── QR Frame décoratif ───────────────────────────────────
function QRFrame({ accent }: { accent: string }) {
  const CORNER_SIZE = 24;
  const CORNER_THICKNESS = 3;
  const corners = [
    { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
    { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
    { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
    { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  ];
  return (
    <View style={qrS.frame}>
      {corners.map((corner, i) => (
        <View
          key={i}
          style={[
            qrS.corner,
            { width: CORNER_SIZE, height: CORNER_SIZE, borderColor: accent },
            corner as any,
          ]}
        />
      ))}
      {/* QR placeholder icon */}
      <Ionicons name="qr-code" size={160} color={T.white} style={{ opacity: 0.9 }} />
    </View>
  );
}
const qrS = StyleSheet.create({
  frame: {
    width: 220, height: 220,
    justifyContent: "center", alignItems: "center",
    position: "relative",
  },
  corner: {
    position: "absolute",
    borderRadius: 4,
  },
});

// ─── Action Button ────────────────────────────────────────
function ActionBtn({ icon, label, accent, onPress, variant = "ghost" }: {
  icon: string; label: string; accent: string; onPress?: () => void;
  variant?: "ghost" | "accent";
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={[
          abS.btn,
          variant === "accent"
            ? { backgroundColor: accent, borderColor: accent }
            : { backgroundColor: `${accent}12`, borderColor: `${accent}25` },
        ]}
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() =>
          Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()
        }
      >
        <Ionicons
          name={icon as any}
          size={20}
          color={variant === "accent" ? "#000" : accent}
        />
        <Text
          style={[
            abS.label,
            { fontFamily: T.font.sans },
            { color: variant === "accent" ? "#000" : accent },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
const abS = StyleSheet.create({
  btn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: T.radius.md, borderWidth: 1,
  },
  label: { fontSize: 13, fontWeight: "800" },
});

// ─── Main Screen ──────────────────────────────────────────
export default function QRCodeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const role = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;

  const initials = user?.firstName
    ? `${user.firstName[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "DT";

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : "Client";

  const userId = user?.id?.slice(0, 12).toUpperCase() ?? "—";

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Mon QR Code</Text>
          <TouchableOpacity style={s.shareBtn} hitSlop={8}>
            <Ionicons name="share-outline" size={20} color={theme.accent} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Sous-titre */}
          <Text style={[s.subtitle, { fontFamily: T.font.sans }]}>
            Présentez ce code pour recevoir de l'argent instantanément.
          </Text>

          {/* Carte QR */}
          <View style={s.qrCard}>
            {/* Ligne accent haut */}
            <View style={[s.qrCardAccentLine, { backgroundColor: theme.accent }]} />

            {/* Identité */}
            <View style={s.identityRow}>
              <LinearGradient
                colors={[`${theme.accent}25`, `${theme.accent}08`]}
                style={s.avatarBox}
              >
                <Text style={[s.avatarInitials, { color: theme.accent, fontFamily: T.font.display }]}>
                  {initials}
                </Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[s.userName, { fontFamily: T.font.display }]}>{displayName}</Text>
                <Text style={[s.userPhone, { fontFamily: T.font.sans }]}>
                  {user?.phone ?? user?.email ?? "Direct Transf'air"}
                </Text>
                <View style={[s.idPill, { borderColor: `${theme.accent}25` }]}>
                  <Text style={[s.idTxt, { color: theme.accent, fontFamily: T.font.mono }]}>
                    {userId}
                  </Text>
                </View>
              </View>
            </View>

            {/* Divider */}
            <View style={s.divider} />

            {/* QR Frame */}
            <View style={s.qrArea}>
              {/* Background subtle glow */}
              <View style={[s.qrGlowBox, { borderColor: `${theme.accent}15` }]}>
                <QRFrame accent={theme.accent} />
              </View>
              <View style={[s.qrBadge, { backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}25` }]}>
                <View style={[s.qrDot, { backgroundColor: theme.accent }]} />
                <Text style={[s.qrBadgeTxt, { color: theme.accent, fontFamily: T.font.sans }]}>
                  QR ACTIF · DIRECT TRANSF'AIR
                </Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={s.actionsRow}>
            <ActionBtn
              icon="scan-outline"
              label="Scanner"
              accent={theme.accent}
              variant="accent"
              onPress={() => {}}
            />
            <ActionBtn
              icon="copy-outline"
              label="Copier l'ID"
              accent={theme.accent}
              onPress={() => {}}
            />
          </View>

          {/* Note sécurité */}
          <View style={s.secNote}>
            <Ionicons name="shield-checkmark-outline" size={13} color={theme.accent} />
            <Text style={[s.secTxt, { color: theme.accent, fontFamily: T.font.sans }]}>
              Code sécurisé · Valide uniquement pour votre compte
            </Text>
          </View>

          {/* Espace pour la tab bar flottante */}
          <View style={{ height: 110 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  headerTitle: { color: T.white, fontSize: 20, fontWeight: "700" },
  shareBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },

  content: {
    paddingHorizontal: 20,
    alignItems: "center",
    paddingBottom: 20,
  },
  subtitle: {
    color: T.dim, fontSize: 13, fontWeight: "600",
    textAlign: "center", marginBottom: 20, lineHeight: 19,
    paddingHorizontal: 20,
  },

  qrCard: {
    backgroundColor: T.ghost, borderRadius: T.radius.xl,
    width: "100%", maxWidth: 400, overflow: "hidden",
    borderWidth: 1, borderColor: T.inkBorder,
    marginBottom: 16,
  },
  qrCardAccentLine: { height: 3, width: "100%" },

  identityRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 20, paddingBottom: 16,
  },
  avatarBox: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  avatarInitials: { fontSize: 22, fontWeight: "900" },
  userName: { color: T.white, fontSize: 17, fontWeight: "700", marginBottom: 2 },
  userPhone: { color: T.dim, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  idPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 7, borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  idTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },

  divider: { height: 1, backgroundColor: T.inkBorder, marginHorizontal: 20 },

  qrArea: {
    alignItems: "center", padding: 24, paddingTop: 20, gap: 14,
  },
  qrGlowBox: {
    padding: 16, borderRadius: T.radius.lg,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
  },
  qrBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1,
  },
  qrDot: { width: 5, height: 5, borderRadius: 99 },
  qrBadgeTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },

  actionsRow: { flexDirection: "row", gap: 12, width: "100%", maxWidth: 400, marginBottom: 14 },

  secNote: {
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  secTxt: { fontSize: 11, fontWeight: "700" },
});