// apps/direct-transfair-mobile/app/(tabs)/admin/commissions/history.tsx
// =========================================================
// COMMISSIONS HISTORY v5.0 — Direct Transf'air
// Design: Thème 100% clair · Ultra-moderne
// ✅ Zéro dark, zéro sombre, zéro backgroundColor sur header
// =========================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity,
  ActivityIndicator, Platform, StatusBar, Animated, ScrollView,
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

  r: { sm: 8, md: 12, lg: 16, xl: 20, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",          default: "monospace" }),
  },
};

const ROLE_ACCENT: Record<string, { color: string; bg: string; border: string }> = {
  SUPER_ADMIN:   { color: C.blue,  bg: C.blueLt,  border: C.blueMd },
  COMPANY_ADMIN: { color: C.green, bg: C.greenLt, border: C.greenMd },
  AGENT:         { color: C.amber, bg: C.amberLt, border: "#FDE68A" },
};

const FILTERS = [
  { label: "Aujourd'hui", value: "TODAY" },
  { label: "7 Jours",     value: "WEEK" },
  { label: "Ce Mois",     value: "MONTH" },
  { label: "Trimestre",   value: "QUARTER" },
  { label: "Année",       value: "YEAR" },
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

// ─── Commission Card ────────────────────────────────────
function CommCard({ item, accent }: { item: any; accent: { color: string; bg: string; border: string } }) {
  const scale = useRef(new Animated.Value(1)).current;

  const fees        = toNum(item.fees);
  const senderAmt   = toNum(item.breakdown?.sender?.amount   ?? 0);
  const payerAmt    = toNum(item.breakdown?.payer?.amount    ?? 0);
  const platformAmt = toNum(item.breakdown?.platform?.amount ?? 0);

  const isPaid = item.status === "PAID" || item.status === "VALIDATED";

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 12 }}>
      <TouchableOpacity
        style={cc.card}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        {/* Barre latérale colorée */}
        <View style={[cc.sideBar, { backgroundColor: accent.color }]} />

        <View style={cc.body}>
          {/* Top row */}
          <View style={cc.top}>
            <View style={[cc.statusIcon, { backgroundColor: isPaid ? C.greenLt : C.amberLt }]}>
              <Ionicons
                name={isPaid ? "checkmark-circle-outline" : "time-outline"}
                size={16}
                color={isPaid ? C.green : C.amber}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[cc.ref, { fontFamily: C.font.sans }]} numberOfLines={1}>
                {item.reference || item.origin || "Réf. —"}
              </Text>
              <Text style={[cc.date, { fontFamily: C.font.sans }]}>
                {item.date
                  ? new Date(item.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
                  : "—"
                }
                {item.date
                  ? " · " + new Date(item.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                  : ""
                }
              </Text>
            </View>
            <View style={cc.totalBox}>
              <Text style={[cc.totalLabel, { fontFamily: C.font.sans }]}>FRAIS</Text>
              <Text style={[cc.totalValue, { fontFamily: C.font.mono, color: C.ink }]}>{fmt(fees)} F</Text>
            </View>
          </View>

          <View style={cc.divider} />

          {/* Répartition */}
          <View style={cc.breakdown}>
            <View style={cc.bPart}>
              <View style={[cc.bIconBox, { backgroundColor: C.blueLt }]}>
                <Ionicons name="person-outline" size={12} color={C.blue} />
              </View>
              <Text style={[cc.bLabel, { fontFamily: C.font.sans }]}>Expéditeur</Text>
              <Text style={[cc.bValue, { color: C.blue, fontFamily: C.font.mono }]}>+{fmt(senderAmt)}</Text>
            </View>

            <View style={cc.bSep} />

            <View style={cc.bPart}>
              <View style={[cc.bIconBox, { backgroundColor: C.greenLt }]}>
                <Ionicons name="storefront-outline" size={12} color={C.green} />
              </View>
              <Text style={[cc.bLabel, { fontFamily: C.font.sans }]}>Payeur</Text>
              <Text style={[cc.bValue, { color: C.green, fontFamily: C.font.mono }]}>+{fmt(payerAmt)}</Text>
            </View>

            <View style={cc.bSep} />

            <View style={cc.bPart}>
              <View style={[cc.bIconBox, { backgroundColor: accent.bg }]}>
                <Ionicons name="business-outline" size={12} color={accent.color} />
              </View>
              <Text style={[cc.bLabel, { fontFamily: C.font.sans, color: accent.color }]}>Plateforme</Text>
              <Text style={[cc.bValue, { color: accent.color, fontFamily: C.font.mono, fontSize: 13 }]}>+{fmt(platformAmt)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const cc = StyleSheet.create({
  card:       { flexDirection: "row", backgroundColor: C.white, borderRadius: C.r.lg, overflow: "hidden", borderWidth: 1, borderColor: C.border, shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sideBar:    { width: 4 },
  body:       { flex: 1, padding: 14 },
  top:        { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  statusIcon: { width: 36, height: 36, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  ref:        { fontSize: 13, fontWeight: "700", color: C.ink, marginBottom: 3 },
  date:       { fontSize: 10, fontWeight: "600", color: C.inkMuted },
  totalBox:   { alignItems: "flex-end" },
  totalLabel: { fontSize: 8, fontWeight: "900", color: C.inkMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 },
  totalValue: { fontSize: 15, fontWeight: "900" },
  divider:    { height: 1, backgroundColor: C.border, marginBottom: 12 },
  breakdown:  { flexDirection: "row", alignItems: "stretch" },
  bPart:      { flex: 1, alignItems: "center", gap: 5 },
  bSep:       { width: 1, backgroundColor: C.border },
  bIconBox:   { width: 26, height: 26, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  bLabel:     { fontSize: 9,  fontWeight: "900", color: C.inkMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  bValue:     { fontSize: 12, fontWeight: "900" },
});

// ─── Summary Card ───────────────────────────────────────
function SummaryCard({ totalFees, platformNet, accent }: { totalFees: number; platformNet: number; accent: { color: string; bg: string; border: string } }) {
  const pct = totalFees > 0 ? Math.min((platformNet / totalFees) * 100, 100) : 0;
  return (
    <View style={[sc.card, { borderTopColor: accent.color }]}>
      <View style={sc.row}>
        <View style={sc.item}>
          <Text style={[sc.lbl, { fontFamily: C.font.sans }]}>Total frais perçus</Text>
          <Text style={[sc.val, { fontFamily: C.font.serif, color: C.ink }]}>{fmt(totalFees)} <Text style={sc.cur}>F</Text></Text>
        </View>
        <View style={[sc.sep]} />
        <View style={[sc.item, { alignItems: "flex-end" }]}>
          <Text style={[sc.lbl, { fontFamily: C.font.sans }]}>Gain plateforme net</Text>
          <Text style={[sc.val, { fontFamily: C.font.serif, color: accent.color }]}>+{fmt(platformNet)} <Text style={[sc.cur, { color: accent.color }]}>F</Text></Text>
        </View>
      </View>
      <View style={[sc.progBg, { backgroundColor: `${accent.color}14` }]}>
        <View style={[sc.progFill, { width: `${pct}%` as any, backgroundColor: accent.color }]} />
      </View>
      <Text style={[sc.progLbl, { fontFamily: C.font.sans, color: accent.color }]}>{pct.toFixed(1)}% des frais → Plateforme</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card:     { backgroundColor: C.white, borderRadius: C.r.xl, padding: 18, marginBottom: 16, borderWidth: 1, borderTopWidth: 3, borderColor: C.border, shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 4 },
  row:      { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  item:     { flex: 1 },
  sep:      { width: 1, height: 40, backgroundColor: C.border, marginHorizontal: 14 },
  lbl:      { fontSize: 9,  fontWeight: "900", color: C.inkMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  val:      { fontSize: 22, fontWeight: "800" },
  cur:      { fontSize: 12, fontWeight: "900", color: C.inkSub },
  progBg:   { height: 5, borderRadius: C.r.pill, overflow: "hidden", marginBottom: 6 },
  progFill: { height: 5, borderRadius: C.r.pill },
  progLbl:  { fontSize: 10, fontWeight: "700" },
});

// ─── Main ───────────────────────────────────────────────
export default function CommissionHistoryScreen() {
  const router   = useRouter();
  const { user } = useAuth();
  const role     = user?.role ?? "COMPANY_ADMIN";
  const accent   = ROLE_ACCENT[role] ?? ROLE_ACCENT.COMPANY_ADMIN;

  const [period,  setPeriod]  = useState("TODAY");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totals,  setTotals]  = useState({ fees: 0, platform: 0 });

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  const fetchHistory = async () => {
    setLoading(true);
    fadeAnim.setValue(0);
    try {
      if (typeof api.getCommissionHistory !== "function") return;
      const data     = await api.getCommissionHistory(period);
      const safeData = Array.isArray(data) ? data : [];
      setHistory(safeData);
      const fees     = safeData.reduce((acc: number, item: any) => acc + toNum(item.fees), 0);
      const platform = safeData.reduce((acc: number, item: any) => acc + toNum(item.breakdown?.platform?.amount ?? 0), 0);
      setTotals({ fees, platform });
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e) { console.error("Erreur historique commissions:", e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    void fetchHistory();
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
  }, [period]);

  return (
    <SafeAreaView style={s.safe}>
      {/* StatusBar clair */}
      <StatusBar backgroundColor={C.white} barStyle="dark-content" />

      {/* ── Header blanc ── */}
      <Animated.View style={[s.header, { opacity: headerAnim }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { fontFamily: C.font.serif }]}>Historique Commissions</Text>
          <Text style={[s.headerSub, { color: accent.color, fontFamily: C.font.sans }]}>
            {history.length} transaction{history.length > 1 ? "s" : ""}
          </Text>
        </View>
        <TouchableOpacity style={[s.iconBtn, { backgroundColor: accent.bg }]} onPress={() => void fetchHistory()}>
          <Ionicons name="refresh" size={18} color={accent.color} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Filtres ── */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filters}
        style={s.filtersWrap}
      >
        {FILTERS.map((f) => {
          const active = period === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              style={[s.filterPill, active && { backgroundColor: accent.bg, borderColor: `${accent.color}40` }]}
              onPress={() => setPeriod(f.value)}
            >
              {active && <View style={[s.filterDot, { backgroundColor: accent.color }]} />}
              <Text style={[s.filterTxt, { fontFamily: C.font.sans, color: active ? accent.color : C.inkSub, fontWeight: active ? "800" : "600" }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={accent.color} />
        </View>
      ) : (
        <Animated.FlatList
          style={{ opacity: fadeAnim }}
          data={history}
          keyExtractor={(item, idx) => item.id?.toString() ?? idx.toString()}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            history.length > 0
              ? <SummaryCard totalFees={totals.fees} platformNet={totals.platform} accent={accent} />
              : null
          }
          renderItem={({ item }) => <CommCard item={item} accent={accent} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyBox}>
                <Ionicons name="receipt-outline" size={32} color={C.inkMuted} />
              </View>
              <Text style={[s.emptyTitle, { fontFamily: C.font.serif }]}>Aucune commission</Text>
              <Text style={[s.emptyTxt, { fontFamily: C.font.sans }]}>Pas de transactions sur cette période</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.white,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn:     { width: 38, height: 38, borderRadius: C.r.md, backgroundColor: C.pageBg, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: C.ink, fontSize: 20, fontWeight: "700" },
  headerSub:   { fontSize: 11, fontWeight: "700", marginTop: 2 },
  iconBtn:     { width: 38, height: 38, borderRadius: C.r.md, justifyContent: "center", alignItems: "center" },

  filtersWrap: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  filters:     { paddingHorizontal: 14, gap: 8, paddingVertical: 10, alignItems: "center" },
  filterPill:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: C.r.pill, backgroundColor: C.pageBg, borderWidth: 1.5, borderColor: C.border },
  filterDot:   { width: 5, height: 5, borderRadius: C.r.pill },
  filterTxt:   { fontSize: 12 },

  list:  { paddingHorizontal: 16, paddingTop: 16 },

  empty:      { alignItems: "center", paddingVertical: 50, gap: 8 },
  emptyBox:   { width: 70, height: 70, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle: { color: C.ink, fontSize: 17, fontWeight: "700" },
  emptyTxt:   { color: C.inkSub, fontSize: 12, fontWeight: "600" },
});