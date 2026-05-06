// apps/direct-transfair-mobile/app/(tabs)/profile/limits.tsx
// =========================================================
// LIMITS SCREEN v5.0 — Direct Transf'air
// Design: Thème CLAIR, clean & aéré
// ✅ Plafonds journaliers et mensuels avec progress bar
// =========================================================

import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../providers/AuthProvider";

const T = {
  bg: "#F0FDF4",
  accent: "#16A34A",
  accentLight: "#DCFCE7",
  accentMid: "#86EFAC",
  white: "#FFFFFF",
  cardBg: "#FFFFFF",
  border: "#E5E8EF",
  borderLight: "#EFF1F5",
  pageBackground: "#F4F6F9",
  text: "#111827",
  textSub: "#6B7280",
  textMuted: "#9CA3AF",
  blue: "#2563EB",
  blueBg: "#DBEAFE",
  amber: "#D97706",
  amberBg: "#FEF3C7",
  purple: "#7C3AED",
  purpleBg: "#EDE9FE",
  red: "#DC2626",
  redBg: "#FEF2F2",
  radius: { md: 12, lg: 16, xl: 20 },
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

function fmt(n: number, currency = "EUR"): string {
  try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(n); }
  catch { return `${n} ${currency}`; }
}

// ─── Limit Card ───────────────────────────────────────────
function LimitCard({ title, used, max, currency, color, colorBg, period }: {
  title: string; used: number; max: number; currency: string;
  color: string; colorBg: string; period: string;
}) {
  const pct = Math.min((used / max) * 100, 100);
  const remaining = max - used;
  const isWarning = pct > 70;
  const isDanger = pct > 90;
  const barColor = isDanger ? T.red : isWarning ? T.amber : color;

  return (
    <View style={[lcS.card, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <View style={lcS.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[lcS.period, { fontFamily: T.font.sans, color: T.textMuted }]}>{period}</Text>
          <Text style={[lcS.title, { fontFamily: T.font.display }]}>{title}</Text>
        </View>
        <View style={[lcS.badge, { backgroundColor: colorBg }]}>
          <Text style={[lcS.badgeTxt, { color, fontFamily: T.font.mono }]}>{pct.toFixed(0)}%</Text>
        </View>
      </View>

      <View style={lcS.amountRow}>
        <Text style={[lcS.used, { color, fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit>
          {fmt(used, currency)}
        </Text>
        <Text style={[lcS.slash, { fontFamily: T.font.sans }]}>/</Text>
        <Text style={[lcS.max, { fontFamily: T.font.mono }]}>{fmt(max, currency)}</Text>
      </View>

      <View style={lcS.progBg}>
        <View style={[lcS.progFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
      </View>

      <View style={lcS.footRow}>
        <Ionicons
          name={isDanger ? "alert-circle-outline" : "checkmark-circle-outline"}
          size={13}
          color={isDanger ? T.red : T.textMuted}
        />
        <Text style={[lcS.remaining, { color: isDanger ? T.red : T.textSub, fontFamily: T.font.sans }]}>
          {fmt(remaining, currency)} restant{isDanger ? " · Limite presque atteinte" : ""}
        </Text>
      </View>
    </View>
  );
}
const lcS = StyleSheet.create({
  card: {
    backgroundColor: T.cardBg, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: T.border,
    ...T.shadow,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  period: { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 3 },
  title: { color: T.text, fontSize: 17, fontWeight: "700" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeTxt: { fontSize: 12, fontWeight: "800" },
  amountRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 12 },
  used: { fontSize: 26, fontWeight: "700", letterSpacing: -0.3 },
  slash: { color: T.textMuted, fontSize: 16 },
  max: { color: T.textSub, fontSize: 14, fontWeight: "700" },
  progBg: { height: 5, backgroundColor: T.borderLight, borderRadius: 99, overflow: "hidden", marginBottom: 10 },
  progFill: { height: 5, borderRadius: 99 },
  footRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  remaining: { fontSize: 11, fontWeight: "600" },
});

// ─── Main Screen ──────────────────────────────────────────
export default function LimitsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const LIMITS = {
    daily:   { used: 150,  max: 2000,  currency: "EUR", color: T.accent,  colorBg: T.accentLight },
    monthly: { used: 450,  max: 10000, currency: "EUR", color: T.blue,    colorBg: T.blueBg },
    yearly:  { used: 1800, max: 50000, currency: "EUR", color: T.purple,  colorBg: T.purpleBg },
  };

  return (
    <View style={[s.root, { backgroundColor: T.bg }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={T.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Mes Plafonds</Text>
            <Text style={[s.headerSub, { color: T.accent, fontFamily: T.font.sans }]}>
              Transferts & virements
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Info banner */}
          <View style={s.infoBanner}>
            <View style={[s.infoIconBox, { backgroundColor: T.blueBg }]}>
              <Ionicons name="information-circle-outline" size={18} color={T.blue} />
            </View>
            <Text style={[s.infoTxt, { fontFamily: T.font.sans }]}>
              Ces plafonds sont fixés pour votre sécurité et conformément à la réglementation en vigueur.
            </Text>
          </View>

          {/* KYC Card */}
          <View style={s.kycCard}>
            <View style={s.kycRow}>
              <View style={[s.kycIconBox, { backgroundColor: T.accentLight }]}>
                <Ionicons name="shield-checkmark-outline" size={16} color={T.accent} />
              </View>
              <View>
                <Text style={[s.kycLabel, { fontFamily: T.font.sans }]}>NIVEAU DE VÉRIFICATION</Text>
                <Text style={[s.kycValue, { color: T.accent, fontFamily: T.font.display }]}>KYC Niveau 1</Text>
              </View>
            </View>
            <View style={s.kycHintRow}>
              <Ionicons name="arrow-up-circle-outline" size={13} color={T.textMuted} />
              <Text style={[s.kycHint, { fontFamily: T.font.sans }]}>
                Complétez votre vérification pour augmenter vos plafonds
              </Text>
            </View>
          </View>

          {/* Section label */}
          <View style={s.sectionRow}>
            <View style={[s.sectionDot, { backgroundColor: T.accent }]} />
            <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>PLAFONDS ACTIFS</Text>
          </View>

          <LimitCard title="Plafond Journalier" period="AUJOURD'HUI" {...LIMITS.daily} />
          <LimitCard title="Plafond Mensuel" period="CE MOIS" {...LIMITS.monthly} />
          <LimitCard title="Plafond Annuel" period="CETTE ANNÉE" {...LIMITS.yearly} />

          {/* CTA */}
          <TouchableOpacity style={[s.requestBtn, { backgroundColor: T.accent }]} activeOpacity={0.85}>
            <Ionicons name="trending-up-outline" size={17} color={T.white} />
            <Text style={[s.requestTxt, { fontFamily: T.font.sans }]}>Demander une augmentation</Text>
          </TouchableOpacity>

          <View style={{ height: 80 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: T.radius.md,
    backgroundColor: T.cardBg, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.border, ...T.shadow,
  },
  headerTitle: { color: T.text, fontSize: 22, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  infoBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: T.blueBg, borderRadius: T.radius.md,
    padding: 14, borderWidth: 1, borderColor: "#BFDBFE", marginBottom: 14,
  },
  infoIconBox: { width: 32, height: 32, borderRadius: 9, justifyContent: "center", alignItems: "center", marginTop: 1 },
  infoTxt: { flex: 1, color: T.blue, fontSize: 12, fontWeight: "600", lineHeight: 17 },

  kycCard: {
    backgroundColor: T.cardBg, borderRadius: T.radius.lg,
    padding: 16, marginBottom: 20, borderWidth: 1, borderColor: T.border, ...T.shadow,
  },
  kycRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  kycIconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  kycLabel: { fontSize: 9, fontWeight: "800", color: T.textMuted, letterSpacing: 1.2, marginBottom: 2 },
  kycValue: { fontSize: 15, fontWeight: "700" },
  kycHintRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  kycHint: { color: T.textSub, fontSize: 11, fontWeight: "600" },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionDot: { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: T.textMuted, letterSpacing: 1.5 },

  requestBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: T.radius.md, marginTop: 8,
  },
  requestTxt: { color: T.white, fontWeight: "800", fontSize: 13, letterSpacing: 0.4 },
});