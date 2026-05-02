//apps/direct-transfair-mobile/app/(tabs)/admin/commissions/config.tsx
// apps/direct-transfair-mobile/app/(tabs)/admin/commissions/config.tsx
// =========================================================
// COMMISSIONS CONFIG v4.0 — Direct Transf'air
// Design: Thème dynamique — stats + historique + config
// =========================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, SafeAreaView, ScrollView, StatusBar, Platform, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../../services/api";
import { useAuth } from "../../../../providers/AuthProvider";

const ROLE_THEMES = {
  SUPER_ADMIN:   { g1: "#0A0A0F", g2: "#12121A", accent: "#D4A853" },
  COMPANY_ADMIN: { g1: "#030B1A", g2: "#071224", accent: "#34D399" },
  AGENT:         { g1: "#1A0E00", g2: "#211200", accent: "#F59E0B" },
} as const;

const T = {
  ghost: "rgba(255,255,255,0.06)",
  ghostMid: "rgba(255,255,255,0.10)",
  white: "#FFFFFF",
  dim: "#8A9BB5",
  inkBorder: "rgba(255,255,255,0.08)",
  amber: "#F59E0B",
  green: "#22C55E",
  radius: { sm: 10, md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
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

// ─── Stats Card ───────────────────────────────────────────
function StatCard({ label, value, currency = "XOF", icon, color }: any) {
  return (
    <View style={stS.card}>
      <View style={[stS.iconBox, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[stS.value, { color, fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit>
        {fmt(value)}
      </Text>
      <Text style={[stS.currency, { fontFamily: T.font.mono }]}>{currency}</Text>
      <Text style={[stS.label, { fontFamily: T.font.sans }]}>{label}</Text>
    </View>
  );
}
const stS = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 16, alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder, gap: 4,
  },
  iconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  value: { fontSize: 20, fontWeight: "800" },
  currency: { color: T.dim, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  label: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 0.8, textAlign: "center" },
});

// ─── TX Commission Row ────────────────────────────────────
function CommissionRow({ item, accent }: { item: any; accent: string }) {
  const amount = toNum(item.amount);
  const fees = toNum(item.fees);
  const commission = toNum(item.myCommission ?? item.agencyCommission ?? 0);

  return (
    <View style={crS.row}>
      <View style={crS.left}>
        <View style={[crS.dot, { backgroundColor: accent }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[crS.origin, { fontFamily: T.font.sans }]} numberOfLines={1}>{item.origin || "—"}</Text>
          <Text style={[crS.date, { fontFamily: T.font.sans }]}>
            {new Date(item.createdAt || item.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(",", "")}
          </Text>
        </View>
      </View>
      <View style={crS.right}>
        <Text style={[crS.amount, { fontFamily: T.font.mono }]}>{fmt(amount)}</Text>
        <Text style={[crS.fees, { fontFamily: T.font.sans }]}>Frais: {fmt(fees)}</Text>
        <View style={[crS.comPill, { backgroundColor: `${accent}15`, borderColor: `${accent}25` }]}>
          <Text style={[crS.comTxt, { color: accent, fontFamily: T.font.mono }]}>+{fmt(commission)}</Text>
        </View>
      </View>
    </View>
  );
}
const crS = StyleSheet.create({
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.inkBorder,
  },
  left: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  dot: { width: 4, height: 32, borderRadius: 99 },
  origin: { color: T.white, fontSize: 13, fontWeight: "700", marginBottom: 2 },
  date: { color: T.dim, fontSize: 10, fontWeight: "600" },
  right: { alignItems: "flex-end", gap: 3, paddingLeft: 10 },
  amount: { color: T.white, fontSize: 14, fontWeight: "800" },
  fees: { color: T.dim, fontSize: 10, fontWeight: "600" },
  comPill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1,
  },
  comTxt: { fontSize: 11, fontWeight: "900" },
});

export default function AdminCommissionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const role = (user?.role ?? "COMPANY_ADMIN") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.COMPANY_ADMIN;

  const [period, setPeriod] = useState("day");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalFees: 0, platformNet: 0, distributed: 0, count: 0 });
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.http.get(`/commissions/history?period=${period}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setHistory(data);

      let totalFees = 0, platformNet = 0, distributed = 0;
      data.forEach((tx: any) => {
        const fees = toNum(tx.fees);
        const plat = toNum(tx.breakdown?.platform?.amount ?? 0);
        totalFees += fees;
        platformNet += plat;
        distributed += fees - plat;
      });
      setStats({ totalFees, platformNet, distributed, count: data.length });
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { console.log("Erreur commissions"); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { void loadData(); }, [loadData]);

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Commissions</Text>
            <Text style={[s.headerSub, { color: theme.accent, fontFamily: T.font.sans }]}>
              {stats.count} transaction{stats.count > 1 ? "s" : ""}
            </Text>
          </View>
          <TouchableOpacity style={s.refreshBtn} onPress={() => void loadData()}>
            <Ionicons name="refresh" size={20} color={theme.accent} />
          </TouchableOpacity>
        </View>

        {/* Period filters */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.periods}
        >
          {PERIODS.map((p) => {
            const isActive = period === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                style={[s.periodPill, isActive && { backgroundColor: `${theme.accent}20`, borderColor: `${theme.accent}40` }]}
                onPress={() => setPeriod(p.key)}
              >
                <Text style={[s.periodTxt, { color: isActive ? theme.accent : T.dim, fontFamily: T.font.sans }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator color={theme.accent} size="large" />
          </View>
        ) : (
          <Animated.ScrollView
            style={{ opacity: fadeAnim }}
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Stats */}
            <View style={s.statsRow}>
              <StatCard label="TOTAL FRAIS" value={stats.totalFees} icon="cash-outline" color={theme.accent} />
              <StatCard label="PLATEFORME" value={stats.platformNet} icon="business-outline" color="#60A5FA" />
              <StatCard label="DISTRIBUÉ" value={stats.distributed} icon="people-outline" color={T.amber} />
            </View>

            {/* Hero marge */}
            <View style={[s.heroCard, { borderColor: `${theme.accent}20` }]}>
              <View>
                <Text style={[s.heroLabel, { fontFamily: T.font.sans }]}>MARGE NETTE PLATEFORME</Text>
                <Text style={[s.heroAmount, { color: theme.accent, fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit>
                  {fmt(stats.platformNet)}
                </Text>
                <Text style={[s.heroCur, { color: theme.accent, fontFamily: T.font.mono }]}>XOF</Text>
              </View>
              <View style={[s.heroProgress]}>
                {stats.totalFees > 0 && (
                  <View
                    style={[
                      s.heroProgressFill,
                      {
                        height: `${Math.min((stats.platformNet / stats.totalFees) * 100, 100)}%` as any,
                        backgroundColor: theme.accent,
                      },
                    ]}
                  />
                )}
              </View>
            </View>

            {/* Historique */}
            <View style={s.sectionRow}>
              <View style={[s.sectionDot, { backgroundColor: theme.accent }]} />
              <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>
                DÉTAIL ({history.length} TRANSACTIONS)
              </Text>
            </View>

            {history.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="bar-chart-outline" size={32} color={T.dim} />
                <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucune transaction sur cette période</Text>
              </View>
            ) : (
              <View style={s.historyCard}>
                {history.map((item, idx) => (
                  <CommissionRow key={item.id ?? idx} item={item} accent={theme.accent} />
                ))}
              </View>
            )}

            <View style={{ height: 100 }} />
          </Animated.ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 14, gap: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  headerTitle: { color: T.white, fontSize: 22, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  periods: { paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  periodPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: T.radius.md,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
  },
  periodTxt: { fontSize: 12, fontWeight: "800" },
  scroll: { paddingHorizontal: 20 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  heroCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 22, marginBottom: 20, borderWidth: 1,
  },
  heroLabel: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 1.2, marginBottom: 6 },
  heroAmount: { fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  heroCur: { fontSize: 11, fontWeight: "900", marginTop: 2 },
  heroProgress: {
    width: 6, height: 80, backgroundColor: T.ghost,
    borderRadius: 99, overflow: "hidden", justifyContent: "flex-end",
  },
  heroProgressFill: { width: 6, borderRadius: 99 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionDot: { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },
  historyCard: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    paddingHorizontal: 16, borderWidth: 1, borderColor: T.inkBorder,
  },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTxt: { color: T.dim, fontSize: 13, fontWeight: "600" },
});