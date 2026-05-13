// apps/direct-transfair-mobile/app/(tabs)/admin/commissions/config.tsx
// =========================================================
// COMMISSIONS CONFIG v5.0 — Direct Transf'air
// ✅ Thème CLAIR — zéro dark/sombre
// =========================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, SafeAreaView, ScrollView, StatusBar, Platform, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../services/api";
import { useAuth } from "../../../../providers/AuthProvider";

const T = {
  pageBg:   "#F2F4F8",
  surface:  "#FFFFFF",
  border:   "#E4E9F0",
  borderMd: "#CDD5E0",
  ink:      "#0F172A",
  inkSub:   "#64748B",
  inkMuted: "#94A3B8",
  blue:     "#1956F0",
  blueLt:   "#EEF2FF",
  blueMd:   "#C7D5FF",
  green:    "#16A34A",
  greenLt:  "#DCFCE7",
  amber:    "#D97706",
  amberLt:  "#FEF3C7",
  red:      "#DC2626",
  redLt:    "#FEE2E2",
  white:    "#FFFFFF",
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
  font: {
    display:  Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:     Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:     Platform.select({ ios: "Courier New", android: "monospace",          default: "monospace" }),
  },
};

const ROLE_ACCENT: Record<string, { color: string; bg: string }> = {
  SUPER_ADMIN:   { color: T.blue,  bg: T.blueLt  },
  COMPANY_ADMIN: { color: T.green, bg: T.greenLt },
  AGENT:         { color: T.amber, bg: T.amberLt },
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

// ─── Stat Card ────────────────────────────────────────────
function StatCard({ label, value, icon, color, bgColor }: {
  label: string; value: number; icon: string; color: string; bgColor: string;
}) {
  return (
    <View style={[stS.card, { borderTopColor: color }]}>
      <View style={[stS.iconBox, { backgroundColor: bgColor }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={[stS.value, { color, fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit>
        {fmt(value)}
      </Text>
      <Text style={[stS.label, { fontFamily: T.font.sans }]}>{label}</Text>
    </View>
  );
}
const stS = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: T.surface, borderRadius: T.radius.lg,
    padding: 14, alignItems: "center",
    borderWidth: 1, borderTopWidth: 3, borderColor: T.border, gap: 4,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  iconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  value:   { fontSize: 20, fontWeight: "800" },
  label:   { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 0.8, textAlign: "center", textTransform: "uppercase" },
});

// ─── Commission Row ────────────────────────────────────────
function CommissionRow({ item, accent }: { item: any; accent: { color: string; bg: string } }) {
  const amount     = toNum(item.amount);
  const fees       = toNum(item.fees);
  const commission = toNum(item.myCommission ?? item.agencyCommission ?? 0);

  return (
    <View style={crS.row}>
      <View style={crS.left}>
        <View style={[crS.colorBar, { backgroundColor: accent.color }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[crS.origin, { fontFamily: T.font.sans }]} numberOfLines={1}>
            {item.origin || item.reference || "—"}
          </Text>
          <Text style={[crS.date, { fontFamily: T.font.sans }]}>
            {new Date(item.createdAt || item.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(",", "")}
          </Text>
        </View>
      </View>
      <View style={crS.right}>
        <Text style={[crS.amount, { fontFamily: T.font.mono }]}>{fmt(amount)}</Text>
        <Text style={[crS.fees, { fontFamily: T.font.sans }]}>Frais: {fmt(fees)}</Text>
        <View style={[crS.comPill, { backgroundColor: accent.bg, borderColor: `${accent.color}25` }]}>
          <Text style={[crS.comTxt, { color: accent.color, fontFamily: T.font.mono }]}>+{fmt(commission)}</Text>
        </View>
      </View>
    </View>
  );
}
const crS = StyleSheet.create({
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  left:  { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  colorBar: { width: 4, height: 34, borderRadius: 99 },
  origin:   { color: T.ink, fontSize: 13, fontWeight: "700", marginBottom: 2 },
  date:     { color: T.inkMuted, fontSize: 10, fontWeight: "600" },
  right:    { alignItems: "flex-end", gap: 3, paddingLeft: 10 },
  amount:   { color: T.ink, fontSize: 14, fontWeight: "800" },
  fees:     { color: T.inkSub, fontSize: 10, fontWeight: "600" },
  comPill:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  comTxt:   { fontSize: 11, fontWeight: "900" },
});

// ─── Main Screen ──────────────────────────────────────────
export default function AdminCommissionsScreen() {
  const router   = useRouter();
  const { user } = useAuth();
  const role     = user?.role ?? "COMPANY_ADMIN";
  const accent   = ROLE_ACCENT[role] ?? ROLE_ACCENT.COMPANY_ADMIN;

  const [period,  setPeriod]  = useState("day");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats,   setStats]   = useState({ totalFees: 0, platformNet: 0, distributed: 0, count: 0 });
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
        totalFees  += fees;
        platformNet += plat;
        distributed += fees - plat;
      });
      setStats({ totalFees, platformNet, distributed, count: data.length });
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { console.log("Erreur commissions"); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { void loadData(); }, [loadData]);

  const pct = stats.totalFees > 0 ? Math.min((stats.platformNet / stats.totalFees) * 100, 100) : 0;

  return (
    <SafeAreaView style={cs.safe}>
      <StatusBar backgroundColor={T.surface} barStyle="dark-content" />

      <View style={cs.header}>
        <TouchableOpacity style={cs.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[cs.headerTitle, { fontFamily: T.font.display }]}>Commissions</Text>
          <Text style={[cs.headerSub, { color: accent.color, fontFamily: T.font.sans }]}>
            {stats.count} transaction{stats.count > 1 ? "s" : ""}
          </Text>
        </View>
        <TouchableOpacity style={[cs.iconBtn, { backgroundColor: accent.bg }]} onPress={() => void loadData()}>
          <Ionicons name="refresh" size={19} color={accent.color} />
        </TouchableOpacity>
      </View>

      {/* Period filters */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={cs.periods}
      >
        {PERIODS.map((p) => {
          const isActive = period === p.key;
          return (
            <TouchableOpacity
              key={p.key}
              style={[cs.periodPill, isActive && { backgroundColor: accent.bg, borderColor: `${accent.color}40` }]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[cs.periodTxt, { fontFamily: T.font.sans, color: isActive ? accent.color : T.inkSub }]}>
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
          contentContainerStyle={cs.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats */}
          <View style={cs.statsRow}>
            <StatCard label="Total frais"  value={stats.totalFees}   icon="cash-outline"     color={accent.color}  bgColor={accent.bg} />
            <StatCard label="Plateforme"   value={stats.platformNet}  icon="business-outline" color={T.blue}       bgColor={T.blueLt}  />
            <StatCard label="Distribué"    value={stats.distributed}  icon="people-outline"   color={T.amber}      bgColor={T.amberLt} />
          </View>

          {/* Hero marge nette */}
          <View style={[cs.heroCard, { borderTopColor: accent.color }]}>
            <View style={{ flex: 1 }}>
              <Text style={[cs.heroLabel, { fontFamily: T.font.sans }]}>MARGE NETTE PLATEFORME</Text>
              <Text
                style={[cs.heroAmount, { color: accent.color, fontFamily: T.font.display }]}
                numberOfLines={1} adjustsFontSizeToFit
              >
                {fmt(stats.platformNet)}
              </Text>
              <Text style={[cs.heroCur, { color: accent.color, fontFamily: T.font.mono }]}>XOF</Text>
              {/* Barre progress */}
              <View style={[cs.progBg, { backgroundColor: `${accent.color}12` }]}>
                <View style={[cs.progFill, { width: `${pct}%` as any, backgroundColor: accent.color }]} />
              </View>
              <Text style={[cs.progLabel, { fontFamily: T.font.sans }]}>
                {pct.toFixed(1)}% des frais totaux
              </Text>
            </View>
          </View>

          {/* Historique */}
          <View style={cs.sectionRow}>
            <View style={[cs.sectionDot, { backgroundColor: accent.color }]} />
            <Text style={[cs.sectionLabel, { fontFamily: T.font.sans }]}>
              DÉTAIL ({history.length} TRANSACTIONS)
            </Text>
          </View>

          {history.length === 0 ? (
            <View style={cs.empty}>
              <Ionicons name="bar-chart-outline" size={32} color={T.inkMuted} />
              <Text style={[cs.emptyTxt, { fontFamily: T.font.sans }]}>Aucune transaction sur cette période</Text>
            </View>
          ) : (
            <View style={cs.historyCard}>
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

const cs = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.pageBg },
  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface,
    paddingHorizontal: 18, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn: { width: 38, height: 38, borderRadius: 11, backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.border, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: T.ink, fontSize: 20, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center" },

  periods: { paddingHorizontal: 14, gap: 8, paddingVertical: 12 },
  periodPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: T.radius.md,
    backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border,
  },
  periodTxt: { fontSize: 12, fontWeight: "800" },

  scroll: { padding: 14 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },

  heroCard: {
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    padding: 20, marginBottom: 20,
    borderWidth: 1, borderTopWidth: 3, borderColor: T.border,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  heroLabel:  { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.2, marginBottom: 6, textTransform: "uppercase" },
  heroAmount: { fontSize: 34, fontWeight: "800", letterSpacing: -0.5, marginBottom: 4 },
  heroCur:    { fontSize: 11, fontWeight: "900", marginBottom: 14 },
  progBg:     { height: 6, borderRadius: 99, overflow: "hidden", marginBottom: 8 },
  progFill:   { height: 6, borderRadius: 99 },
  progLabel:  { fontSize: 10, color: T.inkSub, fontWeight: "700" },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionDot: { width: 6, height: 6, borderRadius: 99 },
  sectionLabel: { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.5, textTransform: "uppercase" },

  historyCard: {
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    paddingHorizontal: 16, borderWidth: 1, borderColor: T.border,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTxt: { color: T.inkSub, fontSize: 13, fontWeight: "600" },
});