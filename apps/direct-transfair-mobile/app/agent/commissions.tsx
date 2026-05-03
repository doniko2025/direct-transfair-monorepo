// apps/direct-transfair-mobile/app/agent/commissions.tsx
// apps/direct-transfair-mobile/app/agent/commissions.tsx
// =========================================================
// AGENT COMMISSIONS v4.0 — Direct Transf'air
// Design: Forge & Ambre — #1A0E00 → #211200 · accent #F59E0B
// ✅ Stats période + historique détaillé
// ✅ Filtre périodes animé
// =========================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  SafeAreaView, TouchableOpacity, Platform, StatusBar, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../services/api";

// ─── Design Tokens ──────────────────────────────────────
const T = {
  g1: "#1A0E00",
  g2: "#211200",
  accent: "#F59E0B",
  accentSoft: "#FCD34D",
  accentGlow: "rgba(245,158,11,0.15)",
  ghost: "rgba(255,255,255,0.06)",
  ghostMid: "rgba(255,255,255,0.10)",
  inkBorder: "rgba(255,255,255,0.08)",
  inkLight: "#261800",
  white: "#FFFFFF",
  dim: "#A89070",
  green: "#22C55E",
  red: "#EF4444",
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

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ─── Stat Box ─────────────────────────────────────────────
function StatBox({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={[stS.box, { borderColor: `${color}20` }]}>
      <View style={[stS.iconBox, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={15} color={color} />
      </View>
      <Text style={[stS.value, { color, fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[stS.label, { fontFamily: T.font.sans }]}>{label}</Text>
    </View>
  );
}
const stS = StyleSheet.create({
  box: {
    flex: 1, backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 14, alignItems: "center", borderWidth: 1, gap: 4,
  },
  iconBox: { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center", marginBottom: 2 },
  value: { fontSize: 18, fontWeight: "800" },
  label: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 0.8, textAlign: "center" },
});

// ─── Commission Row ───────────────────────────────────────
function CommRow({ item }: { item: any }) {
  const commission = toNum(item.agencyCommission ?? item.myCommission ?? 0);
  const amount = toNum(item.amount);
  const fees = toNum(item.fees);

  return (
    <View style={crS.row}>
      <View style={crS.dotWrap}>
        <View style={[crS.dot, { backgroundColor: T.accent }]} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[crS.origin, { fontFamily: T.font.sans }]} numberOfLines={1}>
          {item.origin || "Transaction"}
        </Text>
        <Text style={[crS.date, { fontFamily: T.font.sans }]}>{fmtDate(item.createdAt)}</Text>
      </View>
      <View style={crS.right}>
        <Text style={[crS.amount, { fontFamily: T.font.mono }]}>{fmt(amount)} XOF</Text>
        <Text style={[crS.fees, { fontFamily: T.font.sans }]}>Frais : {fmt(fees)}</Text>
        <View style={[crS.comPill, { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.25)" }]}>
          <Text style={[crS.comTxt, { color: T.green, fontFamily: T.font.mono }]}>
            + {fmt(commission)} XOF
          </Text>
        </View>
      </View>
    </View>
  );
}
const crS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.inkBorder },
  dotWrap: { paddingTop: 4, marginRight: 12 },
  dot: { width: 4, height: 32, borderRadius: 99 },
  origin: { color: T.white, fontSize: 13, fontWeight: "700", marginBottom: 2 },
  date: { color: T.dim, fontSize: 10, fontWeight: "600" },
  right: { alignItems: "flex-end", gap: 2, paddingLeft: 10 },
  amount: { color: T.white, fontSize: 12, fontWeight: "700" },
  fees: { color: T.dim, fontSize: 10, fontWeight: "600" },
  comPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1, marginTop: 2 },
  comTxt: { fontSize: 12, fontWeight: "900" },
});

// ─── Main Screen ──────────────────────────────────────────
export default function AgentCommissionsScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState("day");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadStats = async () => {
    setLoading(true);
    fadeAnim.setValue(0);
    try {
      const res = await api.http.get(`/commissions/my-stats?period=${period}`);
      setData(res.data);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e) {
      console.log("Erreur commissions:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadStats(); }, [period]);

  const todayComm = toNum(data?.todayCommissions);
  const totalComm = toNum(data?.totalCommissions);
  const totalVol = toNum(data?.totalVolume);
  const count = toNum(data?.count);
  const history: any[] = Array.isArray(data?.history) ? data.history : [];

  const renderHeader = () => (
    <View>
      {/* Hero card */}
      <LinearGradient
        colors={[`${T.accent}20`, `${T.accent}08`]}
        style={hdS.heroCard}
      >
        <View style={hdS.heroTop}>
          <View style={hdS.heroIconBox}>
            <Ionicons name="trending-up" size={20} color={T.accent} />
          </View>
          <View>
            <Text style={[hdS.heroLabel, { fontFamily: T.font.sans }]}>COMMISSIONS DU JOUR</Text>
          </View>
        </View>
        <Text style={[hdS.heroAmount, { fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit>
          {fmt(todayComm)}
        </Text>
        <Text style={[hdS.heroCur, { color: T.accent, fontFamily: T.font.mono }]}>XOF</Text>
      </LinearGradient>

      {/* Stats row */}
      <View style={hdS.statsRow}>
        <StatBox icon="cash-outline" label="TOTAL PÉRIODE" value={`${fmt(totalComm)}`} color={T.accent} />
        <StatBox icon="analytics-outline" label="VOLUME TRAITÉ" value={fmt(totalVol)} color="#60A5FA" />
        <StatBox icon="list-outline" label="OPÉRATIONS" value={String(Math.round(count))} color={T.green} />
      </View>

      {history.length > 0 && (
        <View style={hdS.sectionRow}>
          <View style={hdS.sectionDot} />
          <Text style={[hdS.sectionLabel, { fontFamily: T.font.sans }]}>
            DÉTAIL · {history.length} TRANSACTION{history.length > 1 ? "S" : ""}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <LinearGradient colors={[T.g1, T.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={s.rolePill}>
              <View style={[s.roleDot, { backgroundColor: T.accent }]} />
              <Text style={[s.roleLabel, { color: T.accent, fontFamily: T.font.sans }]}>AGENT</Text>
            </View>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Mes Commissions</Text>
          </View>
          <TouchableOpacity style={s.refreshBtn} onPress={() => void loadStats()}>
            <Ionicons name="refresh" size={18} color={T.accent} />
          </TouchableOpacity>
        </View>

        {/* ── Period filters ── */}
        <FlatList
          horizontal
          data={PERIODS}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.periods}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            const isActive = period === item.key;
            return (
              <TouchableOpacity
                style={[s.periodPill, isActive && { backgroundColor: T.accentGlow, borderColor: `${T.accent}40` }]}
                onPress={() => setPeriod(item.key)}
                activeOpacity={0.8}
              >
                {isActive && <View style={[s.periodDot, { backgroundColor: T.accent }]} />}
                <Text style={[s.periodTxt, { color: isActive ? T.accent : T.dim, fontFamily: T.font.sans }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
          style={{ maxHeight: 48, marginBottom: 8 }}
        />

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator color={T.accent} size="large" />
          </View>
        ) : (
          <Animated.FlatList
            style={{ opacity: fadeAnim }}
            data={history}
            keyExtractor={(item) => item.id ?? Math.random().toString()}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={renderHeader}
            renderItem={({ item }) => <CommRow item={item} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="bar-chart-outline" size={34} color={T.dim} />
                <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>
                  Aucune commission sur cette période
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

const hdS = StyleSheet.create({
  heroCard: {
    borderRadius: T.radius.lg, padding: 22, marginBottom: 14,
    borderWidth: 1, borderColor: `${T.accent}20`,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  heroIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.accentGlow, justifyContent: "center", alignItems: "center" },
  heroLabel: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },
  heroAmount: { color: T.white, fontSize: 36, fontWeight: "800", letterSpacing: -0.5 },
  heroCur: { fontSize: 11, fontWeight: "900", marginTop: 4, letterSpacing: 1 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: T.accent },
  sectionLabel: { fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },
});

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
  rolePill: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  roleDot: { width: 5, height: 5, borderRadius: 99 },
  roleLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  headerTitle: { color: T.white, fontSize: 22, fontWeight: "700" },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  periods: { paddingHorizontal: 20, gap: 8, alignItems: "center" },
  periodPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: T.radius.md,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
  },
  periodDot: { width: 4, height: 4, borderRadius: 99 },
  periodTxt: { fontSize: 12, fontWeight: "800" },
  list: { paddingHorizontal: 20, paddingTop: 8 },
  historyCard: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    paddingHorizontal: 16, borderWidth: 1, borderColor: T.inkBorder,
  },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTxt: { color: T.dim, fontSize: 13, fontWeight: "600" },
});