//apps/direct-transfair-mobile/app/(tabs)/profile/limits.tsx
// apps/direct-transfair-mobile/app/(tabs)/profile/limits.tsx
// =========================================================
// LIMITS SCREEN v4.0 — Direct Transf'air
// Design: Émeraude Profond (USER uniquement)
// ✅ Plafonds journaliers et mensuels avec progress bar
// =========================================================

import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../../providers/AuthProvider";

const T = {
  g1: "#0B1F14",
  g2: "#0F2A1C",
  accent: "#10B981",
  accentGlow: "rgba(16,185,129,0.15)",
  ghost: "rgba(255,255,255,0.06)",
  inkBorder: "rgba(255,255,255,0.08)",
  inkLight: "#1C2820",
  white: "#FFFFFF",
  dim: "#8A9BB5",
  blue: "#60A5FA",
  amber: "#F59E0B",
  red: "#EF4444",
  radius: { md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

function fmt(n: number, currency = "EUR"): string {
  try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(n); }
  catch { return `${n}${currency}`; }
}

// ─── Limit Card ───────────────────────────────────────────
function LimitCard({
  title, used, max, currency, color, period,
}: {
  title: string; used: number; max: number; currency: string; color: string; period: string;
}) {
  const pct = Math.min((used / max) * 100, 100);
  const remaining = max - used;
  const isWarning = pct > 70;
  const isDanger = pct > 90;

  return (
    <View style={[lcS.card, { borderColor: `${color}20` }]}>
      <View style={lcS.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[lcS.period, { fontFamily: T.font.sans }]}>{period}</Text>
          <Text style={[lcS.title, { fontFamily: T.font.display }]}>{title}</Text>
        </View>
        <View style={[lcS.badge, { backgroundColor: `${color}12`, borderColor: `${color}25` }]}>
          <Text style={[lcS.badgeTxt, { color, fontFamily: T.font.mono }]}>
            {pct.toFixed(0)}%
          </Text>
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
        <View
          style={[
            lcS.progFill,
            {
              width: `${pct}%` as any,
              backgroundColor: isDanger ? T.red : isWarning ? T.amber : color,
            },
          ]}
        />
      </View>

      <View style={lcS.footRow}>
        <Ionicons
          name={isDanger ? "alert-circle-outline" : "checkmark-circle-outline"}
          size={13}
          color={isDanger ? T.red : color}
        />
        <Text style={[lcS.remaining, { color: isDanger ? T.red : T.dim, fontFamily: T.font.sans }]}>
          {fmt(remaining, currency)} restant{isDanger ? " · Limite presque atteinte" : ""}
        </Text>
      </View>
    </View>
  );
}
const lcS = StyleSheet.create({
  card: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 20, marginBottom: 14, borderWidth: 1,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  period: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 3 },
  title: { color: T.white, fontSize: 18, fontWeight: "700" },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, borderWidth: 1 },
  badgeTxt: { fontSize: 12, fontWeight: "900" },
  amountRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 12 },
  used: { fontSize: 26, fontWeight: "800", letterSpacing: -0.3 },
  slash: { color: T.dim, fontSize: 16, fontWeight: "700" },
  max: { color: T.dim, fontSize: 14, fontWeight: "800" },
  progBg: { height: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden", marginBottom: 10 },
  progFill: { height: 4, borderRadius: 99 },
  footRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  remaining: { fontSize: 11, fontWeight: "600" },
});

// ─── Main Screen ──────────────────────────────────────────
export default function LimitsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Plafonds selon niveau KYC (placeholder — remplacer par API)
  const LIMITS = {
    daily:   { used: 150,  max: 2000,  currency: "EUR", color: T.accent },
    monthly: { used: 450,  max: 10000, currency: "EUR", color: T.blue },
    yearly:  { used: 1800, max: 50000, currency: "EUR", color: "#A78BFA" },
  };

  return (
    <LinearGradient colors={[T.g1, T.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
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
            <View style={[s.infoIconBox, { backgroundColor: `${T.blue}15` }]}>
              <Ionicons name="information-circle-outline" size={18} color={T.blue} />
            </View>
            <Text style={[s.infoTxt, { fontFamily: T.font.sans }]}>
              Ces plafonds sont fixés pour votre sécurité et conformément à la réglementation en vigueur.
            </Text>
          </View>

          {/* Plafond KYC */}
          <View style={s.kycCard}>
            <View style={s.kycRow}>
              <View style={[s.kycIconBox, { backgroundColor: T.accentGlow }]}>
                <Ionicons name="shield-checkmark-outline" size={16} color={T.accent} />
              </View>
              <View>
                <Text style={[s.kycLabel, { fontFamily: T.font.sans }]}>NIVEAU DE VÉRIFICATION</Text>
                <Text style={[s.kycValue, { color: T.accent, fontFamily: T.font.display }]}>
                  KYC Niveau 1
                </Text>
              </View>
            </View>
            <Text style={[s.kycHint, { fontFamily: T.font.sans }]}>
              Complétez votre vérification pour augmenter vos plafonds
            </Text>
          </View>

          {/* Limits */}
          <View style={s.sectionRow}>
            <View style={[s.sectionDot, { backgroundColor: T.accent }]} />
            <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>PLAFONDS ACTIFS</Text>
          </View>

          <LimitCard
            title="Plafond Journalier"
            period="AUJOURD'HUI"
            used={LIMITS.daily.used}
            max={LIMITS.daily.max}
            currency={LIMITS.daily.currency}
            color={LIMITS.daily.color}
          />
          <LimitCard
            title="Plafond Mensuel"
            period="CE MOIS"
            used={LIMITS.monthly.used}
            max={LIMITS.monthly.max}
            currency={LIMITS.monthly.currency}
            color={LIMITS.monthly.color}
          />
          <LimitCard
            title="Plafond Annuel"
            period="CETTE ANNÉE"
            used={LIMITS.yearly.used}
            max={LIMITS.yearly.max}
            currency={LIMITS.yearly.currency}
            color={LIMITS.yearly.color}
          />

          {/* Demande d'augmentation */}
          <TouchableOpacity style={s.requestBtn} activeOpacity={0.85}>
            <LinearGradient
              colors={[T.accent, "#34D399"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.requestGrad}
            >
              <Ionicons name="trending-up-outline" size={17} color={T.g1} />
              <Text style={[s.requestTxt, { fontFamily: T.font.sans }]}>
                Demander une augmentation
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 80 }} />
        </ScrollView>
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

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  infoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: `${T.blue}10`, borderRadius: T.radius.md, padding: 14, borderWidth: 1, borderColor: `${T.blue}20`, marginBottom: 16 },
  infoIconBox: { width: 32, height: 32, borderRadius: 9, justifyContent: "center", alignItems: "center", marginTop: 1 },
  infoTxt: { flex: 1, color: T.blue, fontSize: 12, fontWeight: "600", lineHeight: 17 },

  kycCard: { backgroundColor: T.ghost, borderRadius: T.radius.lg, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: T.inkBorder },
  kycRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  kycIconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  kycLabel: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 1.2, marginBottom: 2 },
  kycValue: { fontSize: 15, fontWeight: "800" },
  kycHint: { color: T.dim, fontSize: 11, fontWeight: "600" },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionDot: { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },

  requestBtn: { borderRadius: T.radius.md, overflow: "hidden", marginTop: 4 },
  requestGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 17, gap: 8 },
  requestTxt: { color: T.g1, fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
});