// apps/direct-transfair-mobile/app/(tabs)/admin/commissions/config.tsx
// =========================================================
// COMMISSIONS CONFIG v5.0 — Direct Transf'air
// Design: Thème 100% clair · Ultra-moderne
// =========================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, SafeAreaView, ScrollView, StatusBar, Platform, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../services/api";
import { useAuth } from "../../../../providers/AuthProvider";

// ─── Design System ──────────────────────────────────────
const C = {
  pageBg:    "#F4F6FB",
  white:     "#FFFFFF",
  border:    "#E4E9F2",
  borderMd:  "#CDD5E0",

  ink:       "#0F172A",
  inkSub:    "#64748B",
  inkMuted:  "#94A3B8",

  blue:      "#1956F0",
  blueLt:    "#EEF2FF",
  blueMd:    "#C7D5FF",

  green:     "#16A34A",
  greenLt:   "#DCFCE7",
  greenMd:   "#A7F3D0",

  amber:     "#D97706",
  amberLt:   "#FEF3C7",

  red:       "#DC2626",
  redLt:     "#FEE2E2",

  violet:    "#7C3AED",
  violetLt:  "#EDE9FE",

  teal:      "#0F766E",
  tealLt:    "#CCFBF1",

  r: { sm: 8, md: 12, lg: 16, xl: 20, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",          default: "monospace" }),
  },
};

const ROLE_ACCENT: Record<string, { color: string; bg: string; border: string }> = {
  SUPER_ADMIN:   { color: C.blue,   bg: C.blueLt,   border: C.blueMd },
  COMPANY_ADMIN: { color: C.green,  bg: C.greenLt,  border: C.greenMd },
  AGENT:         { color: C.amber,  bg: C.amberLt,  border: "#FDE68A" },
};

const PERIODS = [
  { key: "day",     label: "Aujourd'hui" },
  { key: "week",    label: "7 Jours" },
  { key: "month",   label: "Ce Mois" },
  { key: "quarter", label: "Trimestre" },
  { key: "year",    label: "Année" },
];

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}
function fmt(n: number): string {
  try { return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n); }
  catch { return Math.round(n).toString(); }
}

// ─── Stat Card ──────────────────────────────────────────
function StatCard({ label, value, icon, color, bg }: {
  label: string; value: number; icon: string; color: string; bg: string;
}) {
  return (
    <View style={[st.card, { borderTopColor: color }]}>
      <View style={[st.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={[st.value, { color, fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit>
        {fmt(value)}
      </Text>
      <Text style={[st.label, { fontFamily: C.font.sans }]}>{label}</Text>
    </View>
  );
}
const st = StyleSheet.create({
  card:    { flex: 1, backgroundColor: C.white, borderRadius: C.r.lg, padding: 14, alignItems: "center", borderWidth: 1, borderTopWidth: 3, borderColor: C.border, gap: 4, shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  iconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  value:   { fontSize: 20, fontWeight: "800" },
  label:   { fontSize: 9, fontWeight: "900", color: C.inkMuted, letterSpacing: 0.8, textAlign: "center", textTransform: "uppercase" },
});

// ─── Commission Row ─────────────────────────────────────
function CommissionRow({ item, accent }: { item: any; accent: { color: string; bg: string } }) {
  const amount     = toNum(item.amount);
  const fees       = toNum(item.fees);
  const commission = toNum(item.myCommission ?? item.agencyCommission ?? 0);

  return (
    <View style={cr.row}>
      <View style={cr.left}>
        <View style={[cr.bar, { backgroundColor: accent.color }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[cr.origin, { fontFamily: C.font.sans }]} numberOfLines={1}>
            {item.origin || item.reference || "—"}
          </Text>
          <Text style={[cr.date, { fontFamily: C.font.sans }]}>
            {new Date(item.createdAt || item.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
          </Text>
        </View>
      </View>
      <View style={cr.right}>
        <Text style={[cr.amount, { fontFamily: C.font.mono }]}>{fmt(amount)} F</Text>
        <Text style={[cr.fees, { fontFamily: C.font.sans }]}>Frais : {fmt(fees)}</Text>
        <View style={[cr.pill, { backgroundColor: accent.bg, borderColor: `${accent.color}30` }]}>
          <Ionicons name="trending-up" size={10} color={accent.color} />
          <Text style={[cr.pillTxt, { color: accent.color, fontFamily: C.font.mono }]}>+{fmt(commission)}</Text>
        </View>
      </View>
    </View>
  );
}
const cr = StyleSheet.create({
  row:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  left:   { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  bar:    { width: 4, height: 34, borderRadius: C.r.pill },
  origin: { color: C.ink, fontSize: 13, fontWeight: "700", marginBottom: 2 },
  date:   { color: C.inkMuted, fontSize: 10, fontWeight: "600" },
  right:  { alignItems: "flex-end", gap: 3, paddingLeft: 10 },
  amount: { color: C.ink, fontSize: 14, fontWeight: "800" },
  fees:   { color: C.inkSub, fontSize: 10, fontWeight: "600" },
  pill:   { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: C.r.pill, borderWidth: 1 },
  pillTxt:{ fontSize: 11, fontWeight: "900" },
});

// ─── Main ───────────────────────────────────────────────
export default function AdminCommissionsScreen() {
  const router   = useRouter();
  const { user } = useAuth();
  const role     = user?.role ?? "COMPANY_ADMIN";
  const accent   = ROLE_ACCENT[role] ?? ROLE_ACCENT.COMPANY_ADMIN;

  const [period,  setPeriod]  = useState("day");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats,   setStats]   = useState({ totalFees: 0, platformNet: 0, distributed: 0, count: 0 });

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await api.http.get(`/commissions/history?period=${period}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setHistory(data);
      let totalFees = 0, platformNet = 0, distributed = 0;
      data.forEach((tx: any) => {
        const fees = toNum(tx.fees);
        const plat = toNum(tx.breakdown?.platform?.amount ?? 0);
        totalFees   += fees;
        platformNet += plat;
        distributed += fees - plat;
      });
      setStats({ totalFees, platformNet, distributed, count: data.length });
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { console.log("Erreur commissions"); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => {
    void loadData();
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
  }, [loadData]);

  const pct = stats.totalFees > 0 ? Math.min((stats.platformNet / stats.totalFees) * 100, 100) : 0;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={C.white} barStyle="dark-content" />

      {/* ── Header blanc ── */}
      <Animated.View style={[s.header, { opacity: headerAnim }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { fontFamily: C.font.serif }]}>Commissions</Text>
          <Text style={[s.headerSub, { color: accent.color, fontFamily: C.font.sans }]}>
            {stats.count} transaction{stats.count > 1 ? "s" : ""}
          </Text>
        </View>
        <TouchableOpacity style={[s.iconBtn, { backgroundColor: accent.bg }]} onPress={() => void loadData()}>
          <Ionicons name="refresh" size={18} color={accent.color} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Filtres périodes ── */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.periods}
        style={s.periodsWrap}
      >
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <TouchableOpacity
              key={p.key}
              style={[s.periodPill, active && { backgroundColor: accent.bg, borderColor: `${accent.color}40` }]}
              onPress={() => setPeriod(p.key)}
            >
              {active && <View style={[s.periodDot, { backgroundColor: accent.color }]} />}
              <Text style={[s.periodTxt, { fontFamily: C.font.sans, color: active ? accent.color : C.inkSub, fontWeight: active ? "800" : "600" }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={accent.color} size="large" />
        </View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats row */}
          <View style={s.statsRow}>
            <StatCard label="Total frais"  value={stats.totalFees}   icon="cash-outline"     color={accent.color} bg={accent.bg} />
            <StatCard label="Plateforme"   value={stats.platformNet}  icon="business-outline" color={C.blue}      bg={C.blueLt} />
            <StatCard label="Distribué"    value={stats.distributed}  icon="people-outline"   color={C.amber}     bg={C.amberLt} />
          </View>

          {/* Hero marge nette */}
          <View style={[s.heroCard, { borderTopColor: accent.color }]}>
            <View style={s.heroTop}>
              <View style={[s.heroIconBox, { backgroundColor: accent.bg }]}>
                <Ionicons name="trending-up" size={18} color={accent.color} />
              </View>
              <View>
                <Text style={[s.heroLabel, { fontFamily: C.font.sans }]}>MARGE NETTE PLATEFORME</Text>
                <Text style={[s.heroPeriod, { fontFamily: C.font.sans }]}>
                  {PERIODS.find((p) => p.key === period)?.label}
                </Text>
              </View>
            </View>
            <Text style={[s.heroAmt, { color: accent.color, fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit>
              {fmt(stats.platformNet)}
            </Text>
            <Text style={[s.heroCur, { color: accent.color, fontFamily: C.font.mono }]}>XOF</Text>
            <View style={[s.progBg, { backgroundColor: `${accent.color}14` }]}>
              <View style={[s.progFill, { width: `${pct}%` as any, backgroundColor: accent.color }]} />
            </View>
            <Text style={[s.progLbl, { fontFamily: C.font.sans }]}>{pct.toFixed(1)}% des frais totaux</Text>
          </View>

          {/* Historique */}
          <View style={s.secRow}>
            <View style={[s.secDot, { backgroundColor: accent.color }]} />
            <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>DÉTAIL · {history.length} TRANSACTIONS</Text>
          </View>

          {history.length === 0 ? (
            <View style={s.empty}>
              <View style={[s.emptyBox, { borderColor: C.border }]}>
                <Ionicons name="bar-chart-outline" size={32} color={C.inkMuted} />
              </View>
              <Text style={[s.emptyTitle, { fontFamily: C.font.serif }]}>Aucune commission</Text>
              <Text style={[s.emptyTxt, { fontFamily: C.font.sans }]}>Pas de transactions sur cette période</Text>
            </View>
          ) : (
            <View style={s.historyCard}>
              {history.map((item, idx) => (
                <CommissionRow key={item.id ?? idx} item={item} accent={accent} />
              ))}
            </View>
          )}

          <View style={{ height: 100 }} />
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.white,
    paddingHorizontal: 18, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn:     { width: 38, height: 38, borderRadius: C.r.md, backgroundColor: C.pageBg, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: C.ink, fontSize: 20, fontWeight: "700" },
  headerSub:   { fontSize: 11, fontWeight: "700", marginTop: 2 },
  iconBtn:     { width: 38, height: 38, borderRadius: C.r.md, justifyContent: "center", alignItems: "center" },

  periodsWrap: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  periods:     { paddingHorizontal: 14, gap: 8, paddingVertical: 10, alignItems: "center" },
  periodPill:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: C.r.pill, backgroundColor: C.pageBg, borderWidth: 1.5, borderColor: C.border },
  periodDot:   { width: 5, height: 5, borderRadius: C.r.pill },
  periodTxt:   { fontSize: 12 },

  scroll:    { padding: 16 },
  statsRow:  { flexDirection: "row", gap: 10, marginBottom: 14 },

  heroCard: {
    backgroundColor: C.white, borderRadius: C.r.xl,
    padding: 20, marginBottom: 20,
    borderWidth: 1, borderTopWidth: 3, borderColor: C.border,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 4,
  },
  heroTop:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  heroIconBox:{ width: 36, height: 36, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  heroLabel:  { fontSize: 9,  fontWeight: "900", color: C.inkMuted, letterSpacing: 1.2, textTransform: "uppercase" },
  heroPeriod: { fontSize: 11, fontWeight: "700", color: C.inkSub, marginTop: 2 },
  heroAmt:    { fontSize: 36, fontWeight: "800", letterSpacing: -0.5, marginBottom: 4 },
  heroCur:    { fontSize: 11, fontWeight: "900", marginBottom: 14 },
  progBg:     { height: 6, borderRadius: C.r.pill, overflow: "hidden", marginBottom: 8 },
  progFill:   { height: 6, borderRadius: C.r.pill },
  progLbl:    { fontSize: 10, color: C.inkSub, fontWeight: "700" },

  secRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  secDot:  { width: 5, height: 5, borderRadius: C.r.pill },
  secLbl:  { fontSize: 10, fontWeight: "900", color: C.inkMuted, letterSpacing: 1.5, textTransform: "uppercase" },

  historyCard: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    paddingHorizontal: 16, borderWidth: 1, borderColor: C.border,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },

  empty:      { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyBox:   { width: 68, height: 68, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle: { color: C.ink, fontSize: 16, fontWeight: "700" },
  emptyTxt:   { color: C.inkSub, fontSize: 12, fontWeight: "600" },
});