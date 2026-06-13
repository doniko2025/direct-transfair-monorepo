// apps/direct-transfair-mobile/app/(tabs)/qr.tsx
// =========================================================
// QR CODE SCREEN v5.1 — Direct Transf'air
// ✅ v5.1 : fond blanc neutre #FAFAFA sur tous les rôles
//    - pageBg unifié (plus de teinte verte/ambrée par rôle)
//    - Héro rôle coloré conservé (identité visuelle forte)
//    - Ombres cartes renforcées
//    - Logique métier 100 % inchangée
// =========================================================

import React, { useRef } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  Platform, StatusBar, Animated, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";

// ─── Thèmes par rôle — pageBg unifié blanc neutre ────────
const ROLE_THEMES = {
  SUPER_ADMIN:   {
    primary: "#B45309", light: "#FFFBEB", pale: "#FEF3C7", border: "#FDE68A",
    pageBg: "#FAFAFA",  // ← unifié (était #FFFDF5)
    heroGlass: "rgba(255,255,255,0.14)", heroGlassBdr: "rgba(255,255,255,0.22)",
  },
  COMPANY_ADMIN: {
    primary: "#059669", light: "#F0FDF4", pale: "#ECFDF5", border: "#A7F3D0",
    pageBg: "#FAFAFA",  // ← unifié (était #F0FDF8)
    heroGlass: "rgba(255,255,255,0.14)", heroGlassBdr: "rgba(255,255,255,0.22)",
  },
  AGENT: {
    primary: "#D97706", light: "#FFFBEB", pale: "#FEF3C7", border: "#FDE68A",
    pageBg: "#FAFAFA",  // ← unifié (était #FFFDF5)
    heroGlass: "rgba(255,255,255,0.14)", heroGlassBdr: "rgba(255,255,255,0.22)",
  },
  USER: {
    primary: "#059669", light: "#F0FDF4", pale: "#ECFDF5", border: "#A7F3D0",
    pageBg: "#FAFAFA",  // ← unifié (était #F0FDF8)
    heroGlass: "rgba(255,255,255,0.14)", heroGlassBdr: "rgba(255,255,255,0.22)",
  },
} as const;

const BASE = {
  white:      "#FFFFFF",
  ink:        "#0D1F14",
  inkMid:     "#1F5C3A",
  inkSoft:    "#6B9E85",
  cardBorder: "#E5E5EA",  // ← neutre (était #E2F0E8)
  slateBg:    "#F5F5F5",  // ← neutre (était #F8FAF9)

  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── QR Frame décoratif ───────────────────────────────────
function QRFrame({ accent }: { accent: string }) {
  const CORNER = 28;
  const THICK  = 3;
  const corners = [
    { top: 0, left: 0, borderTopWidth: THICK, borderLeftWidth: THICK },
    { top: 0, right: 0, borderTopWidth: THICK, borderRightWidth: THICK },
    { bottom: 0, left: 0, borderBottomWidth: THICK, borderLeftWidth: THICK },
    { bottom: 0, right: 0, borderBottomWidth: THICK, borderRightWidth: THICK },
  ];
  return (
    <View style={{ width: 200, height: 200, justifyContent: "center", alignItems: "center", position: "relative" }}>
      {corners.map((c, i) => (
        <View key={i} style={[{ position: "absolute", width: CORNER, height: CORNER, borderRadius: 4, borderColor: accent }, c as any]} />
      ))}
      <Ionicons name="qr-code" size={160} color={BASE.ink} style={{ opacity: 0.85 }} />
    </View>
  );
}

// ─── Action Button ────────────────────────────────────────
function ActionBtn({ icon, label, accent, bg, onPress, filled = false }: {
  icon: string; label: string; accent: string; bg: string;
  onPress?: () => void; filled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={[
          ab.btn,
          filled
            ? { backgroundColor: accent, ...Platform.select({ ios: { shadowColor: accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) }
            : { backgroundColor: BASE.white, borderColor: BASE.cardBorder, borderWidth: 1.5,
                ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 }, android: { elevation: 3 } }) },
        ]}
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30 }).start()}
      >
        <Ionicons name={icon as any} size={19} color={filled ? BASE.white : accent} />
        <Text style={[ab.lbl, { color: filled ? BASE.white : accent, fontFamily: BASE.font.sans }]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
const ab = StyleSheet.create({
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: BASE.r.md },
  lbl: { fontSize: 13, fontWeight: "800" },
});

// ─── Main ────────────────────────────────────────────────
export default function QRCodeScreen() {
  const router  = useRouter();
  const { user } = useAuth();

  const role  = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;

  const heroAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.spring(heroAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
  }, []);

  const initials    = user?.firstName ? `${user.firstName[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() : "DT";
  const displayName = user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Client";
  const userId      = user?.id?.slice(0, 12).toUpperCase() ?? "—";

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.pageBg }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

      {/* ── Hero coloré par rôle ── */}
      <Animated.View style={[s.hero, {
        backgroundColor: theme.primary,
        opacity: heroAnim,
        transform: [{ scale: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
      }]}>
        <View style={s.glow} />
        <View style={s.heroRow}>
          <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.heroGlass, borderColor: theme.heroGlassBdr }]} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={BASE.white} />
          </TouchableOpacity>
          <Text style={[s.heroTitle, { fontFamily: BASE.font.serif }]}>Mon QR Code</Text>
          <TouchableOpacity style={[s.shareBtn, { backgroundColor: theme.heroGlass, borderColor: theme.heroGlassBdr }]} hitSlop={8}>
            <Ionicons name="share-outline" size={18} color={BASE.white} />
          </TouchableOpacity>
        </View>
        <Text style={[s.heroSub, { fontFamily: BASE.font.sans }]}>
          Présentez ce code pour recevoir de l'argent instantanément
        </Text>
      </Animated.View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false}>

        {/* ── QR Card blanche ombrée ── */}
        <View style={s.qrCard}>
          <View style={[s.qrCardTop, { backgroundColor: theme.primary }]} />

          <View style={s.identityRow}>
            <View style={[s.avatarBox, { backgroundColor: theme.pale, borderColor: theme.border }]}>
              <Text style={[s.avatarInitials, { color: theme.primary, fontFamily: BASE.font.serif }]}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.userName, { fontFamily: BASE.font.serif }]}>{displayName}</Text>
              <Text style={[s.userContact, { fontFamily: BASE.font.sans }]}>
                {user?.phone ?? user?.email ?? "Direct Transf'air"}
              </Text>
              <View style={[s.idPill, { backgroundColor: theme.pale, borderColor: theme.border }]}>
                <Text style={[s.idTxt, { color: theme.primary, fontFamily: BASE.font.mono }]}>#{userId}</Text>
              </View>
            </View>
          </View>

          <View style={s.divider} />

          <View style={s.qrArea}>
            <View style={[s.qrBox, { borderColor: `${theme.primary}20` }]}>
              <QRFrame accent={theme.primary} />
            </View>
            <View style={[s.qrActiveBadge, { backgroundColor: theme.pale, borderColor: theme.border }]}>
              <View style={[s.qrActiveDot, { backgroundColor: theme.primary }]} />
              <Text style={[s.qrActiveTxt, { color: theme.primary, fontFamily: BASE.font.sans }]}>
                QR ACTIF · DIRECT TRANSF'AIR
              </Text>
            </View>
          </View>

          <View style={s.infoStrip}>
            <View style={s.infoItem}>
              <Ionicons name="flash-outline" size={14} color={theme.primary} />
              <Text style={[s.infoTxt, { fontFamily: BASE.font.sans }]}>Instantané</Text>
            </View>
            <View style={[s.infoSep, { backgroundColor: theme.border }]} />
            <View style={s.infoItem}>
              <Ionicons name="shield-checkmark-outline" size={14} color={theme.primary} />
              <Text style={[s.infoTxt, { fontFamily: BASE.font.sans }]}>Sécurisé</Text>
            </View>
            <View style={[s.infoSep, { backgroundColor: theme.border }]} />
            <View style={s.infoItem}>
              <Ionicons name="lock-closed-outline" size={14} color={theme.primary} />
              <Text style={[s.infoTxt, { fontFamily: BASE.font.sans }]}>Chiffré</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={s.actionsRow}>
          <ActionBtn icon="scan-outline"  label="Scanner"   accent={theme.primary} bg={theme.pale} filled onPress={() => {}} />
          <ActionBtn icon="copy-outline"  label="Copier ID" accent={theme.primary} bg={theme.pale}        onPress={() => {}} />
        </View>

        <View style={s.secNote}>
          <Ionicons name="shield-checkmark-outline" size={13} color={theme.primary} />
          <Text style={[s.secTxt, { color: BASE.inkSoft, fontFamily: BASE.font.sans }]}>
            Code sécurisé · Valide uniquement pour votre compte
          </Text>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },

  hero: {
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 48 : 16,
    paddingBottom: 22, overflow: "hidden",
  },
  glow:      { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.08)", top: -60, right: -40 },
  heroRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  backBtn:   { width: 38, height: 38, borderRadius: BASE.r.sm, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  heroTitle: { color: BASE.white, fontSize: 20, fontWeight: "700" },
  shareBtn:  { width: 38, height: 38, borderRadius: BASE.r.sm, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  heroSub:   { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600", textAlign: "center", lineHeight: 18 },

  scroll: { paddingHorizontal: 20, paddingTop: 20, alignItems: "center" },

  qrCard: {
    backgroundColor: BASE.white,
    borderRadius: BASE.r.xl, width: "100%", maxWidth: 400,
    overflow: "hidden", marginBottom: 16,
    borderWidth: 1, borderColor: BASE.cardBorder,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 16 },
      android: { elevation: 6 },
    }),
  },
  qrCardTop:    { height: 4, width: "100%" },
  identityRow:  { flexDirection: "row", alignItems: "center", gap: 14, padding: 20, paddingBottom: 16 },
  avatarBox:    { width: 52, height: 52, borderRadius: 16, justifyContent: "center", alignItems: "center", borderWidth: 1.5 },
  avatarInitials: { fontSize: 20, fontWeight: "900" },
  userName:     { color: BASE.ink, fontSize: 17, fontWeight: "700", marginBottom: 3 },
  userContact:  { color: BASE.inkSoft, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  idPill:       { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: BASE.r.xs, borderWidth: 1 },
  idTxt:        { fontSize: 10, fontWeight: "900", letterSpacing: 1 },

  divider: { height: 1, backgroundColor: BASE.cardBorder, marginHorizontal: 20 },

  qrArea: { alignItems: "center", padding: 24, gap: 14 },
  qrBox:  { padding: 16, borderRadius: BASE.r.lg, backgroundColor: BASE.slateBg, borderWidth: 1 },
  qrActiveBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BASE.r.pill, borderWidth: 1 },
  qrActiveDot:   { width: 5, height: 5, borderRadius: BASE.r.pill },
  qrActiveTxt:   { fontSize: 9, fontWeight: "900", letterSpacing: 1 },

  infoStrip: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 14, paddingTop: 0, gap: 0 },
  infoItem:  { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  infoTxt:   { fontSize: 11, fontWeight: "700", color: BASE.inkSoft },
  infoSep:   { width: 1, height: 14, marginHorizontal: 4 },

  actionsRow: { flexDirection: "row", gap: 12, width: "100%", maxWidth: 400, marginBottom: 14 },
  secNote:    { flexDirection: "row", alignItems: "center", gap: 6 },
  secTxt:     { fontSize: 11, fontWeight: "600" },
});