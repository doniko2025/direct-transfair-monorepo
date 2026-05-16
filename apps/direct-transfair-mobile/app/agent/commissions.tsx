// apps/direct-transfair-mobile/app/agent/commissions.tsx
// =========================================================
// AGENT COMMISSIONS v5.0 — Direct Transf'air
// Design: Thème clair · Violet #6C47FF · Ultra-moderne
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
import { api } from "../../services/api";

// ─── Design System ──────────────────────────────────────
const C = {
  violet:       "#6C47FF",
  violetLight:  "#F5F3FF",
  violetBorder: "#EDE9FE",

  heroGlass:    "rgba(255,255,255,0.14)",
  heroGlassBdr: "rgba(255,255,255,0.22)",
  heroDim:      "rgba(255,255,255,0.60)",
  heroGlow:     "rgba(255,255,255,0.08)",

  pageBg:       "#F4F2FF",
  white:        "#FFFFFF",
  cardBorder:   "#EDE9FE",
  inputBg:      "#F8F7FF",

  ink:          "#12082E",
  inkMid:       "#4B3F72",
  inkSoft:      "#8B80A8",

  green:        "#10B981",
  greenBg:      "#ECFDF5",
  greenBorder:  "#A7F3D0",
  greenDark:    "#065F46",

  blue:         "#3B82F6",
  blueBg:       "#EFF6FF",
  blueBorder:   "#BFDBFE",

  amber:        "#F59E0B",
  amberBg:      "#FFFBEB",
  amberBorder:  "#FDE68A",

  purple:       "#8B5CF6",
  purpleBg:     "#F5F3FF",
  purpleBorder: "#DDD6FE",

  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
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
  const d = new Date(iso), now = new Date();
  if (now.getTime() - d.getTime() < 86400000) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ─── Stat Box ───────────────────────────────────────────
function StatBox({ icon, label, value, accent, bg }: { icon: string; label: string; value: string; accent: string; bg: string }) {
  return (
    <View style={[st.box, { borderColor: `${accent}25` }]}>
      <View style={[st.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={15} color={accent} />
      </View>
      <Text style={[st.value, { color: accent, fontFamily: C.font.mono }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[st.label, { fontFamily: C.font.sans }]}>{label}</Text>
    </View>
  );
}
const st = StyleSheet.create({
  box:     { flex: 1, backgroundColor: C.white, borderRadius: C.r.lg, padding: 13, alignItems: "center", borderWidth: 1, gap: 4, shadowColor: C.violet, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  iconBox: { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center", marginBottom: 2 },
  value:   { fontSize: 17, fontWeight: "900" },
  label:   { fontSize: 9, fontWeight: "800", color: C.inkSoft, letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center" },
});

// ─── Commission Row ─────────────────────────────────────
function CommRow({ item }: { item: any }) {
  const commission = toNum(item.agencyCommission ?? item.myCommission ?? 0);
  const amount     = toNum(item.amount);
  const fees       = toNum(item.fees);
  return (
    <View style={cr.row}>
      {/* Timeline dot */}
      <View style={cr.timeline}>
        <View style={cr.timelineDot} />
        <View style={cr.timelineLine} />
      </View>
      <View style={cr.card}>
        <View style={cr.top}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[cr.origin, { fontFamily: C.font.sans }]} numberOfLines={1}>{item.origin || "Transaction"}</Text>
            <View style={cr.dateRow}>
              <Ionicons name="time-outline" size={10} color={C.inkSoft} />
              <Text style={[cr.date, { fontFamily: C.font.sans }]}>{fmtDate(item.createdAt)}</Text>
            </View>
          </View>
          <View style={cr.right}>
            <Text style={[cr.amount, { fontFamily: C.font.mono }]}>{fmt(amount)} XOF</Text>
            <Text style={[cr.fees, { fontFamily: C.font.sans }]}>Frais : {fmt(fees)}</Text>
          </View>
        </View>
        <View style={cr.commPill}>
          <Ionicons name="trending-up" size={11} color={C.green} />
          <Text style={[cr.commTxt, { fontFamily: C.font.mono }]}>+ {fmt(commission)} XOF</Text>
        </View>
      </View>
    </View>
  );
}
const cr = StyleSheet.create({
  row:          { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  timeline:     { alignItems: "center", paddingTop: 14 },
  timelineDot:  { width: 10, height: 10, borderRadius: C.r.pill, backgroundColor: C.violet, borderWidth: 2, borderColor: C.violetBorder },
  timelineLine: { width: 2, flex: 1, backgroundColor: C.violetBorder, marginTop: 4 },
  card: {
    flex: 1, backgroundColor: C.white, borderRadius: C.r.lg,
    padding: 14, borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.violet, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  top:      { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  origin:   { color: C.ink, fontSize: 13, fontWeight: "700", marginBottom: 3 },
  dateRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  date:     { color: C.inkSoft, fontSize: 10, fontWeight: "600" },
  right:    { alignItems: "flex-end" },
  amount:   { color: C.ink, fontSize: 12, fontWeight: "700" },
  fees:     { color: C.inkSoft, fontSize: 10, fontWeight: "600", marginTop: 2 },
  commPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.greenBg, borderRadius: C.r.sm, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.greenBorder, alignSelf: "flex-start" },
  commTxt:  { color: C.greenDark, fontSize: 12, fontWeight: "900" },
});

// ─── Main ───────────────────────────────────────────────
export default function AgentCommissionsScreen() {
  const router = useRouter();
  const [period,  setPeriod]  = useState("day");
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadStats = async () => {
    setLoading(true); fadeAnim.setValue(0);
    try {
      const res = await api.http.get(`/commissions/my-stats?period=${period}`);
      setData(res.data);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e) { console.log("Commissions error:", e); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadStats(); }, [period]);

  const todayComm = toNum(data?.todayCommissions);
  const totalComm = toNum(data?.totalCommissions);
  const totalVol  = toNum(data?.totalVolume);
  const count     = toNum(data?.count);
  const history: any[] = Array.isArray(data?.history) ? data.history : [];

  const renderHeader = () => (
    <View>
      {/* Hero card commissions */}
      <View style={h.heroCard}>
        <View style={h.heroTop}>
          <View style={[h.heroIconBox, { backgroundColor: C.violetLight }]}>
            <Ionicons name="trending-up" size={20} color={C.violet} />
          </View>
          <View>
            <Text style={[h.heroLbl, { fontFamily: C.font.sans }]}>COMMISSIONS DU JOUR</Text>
            <View style={h.heroBadge}>
              <View style={h.heroBadgeDot} />
              <Text style={[h.heroBadgeTxt, { fontFamily: C.font.sans }]}>Temps réel</Text>
            </View>
          </View>
        </View>
        <Text style={[h.heroAmt, { fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit>
          {fmt(todayComm)}
        </Text>
        <Text style={[h.heroCur, { fontFamily: C.font.mono }]}>XOF</Text>

        {/* Progress visuel */}
        <View style={h.progRow}>
          <View style={h.progBg}>
            <View style={[h.progFill, { width: totalComm > 0 ? `${Math.min((todayComm / totalComm) * 100, 100)}%` as any : "0%" }]} />
          </View>
          <Text style={[h.progTxt, { fontFamily: C.font.sans }]}>
            {totalComm > 0 ? Math.round((todayComm / totalComm) * 100) : 0}% du total
          </Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={h.statsRow}>
        <StatBox icon="cash-outline"      label="Total période" value={fmt(totalComm)} accent={C.violet} bg={C.violetLight} />
        <StatBox icon="analytics-outline" label="Volume"        value={fmt(totalVol)}  accent={C.blue}   bg={C.blueBg} />
        <StatBox icon="list-outline"      label="Opérations"    value={String(Math.round(count))} accent={C.green} bg={C.greenBg} />
      </View>

      {history.length > 0 && (
        <View style={h.secRow}>
          <View style={h.secDot} />
          <Text style={[h.secLbl, { fontFamily: C.font.sans }]}>
            DÉTAIL · {history.length} TRANSACTION{history.length > 1 ? "S" : ""}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.violet} />

      {/* ── Hero ── */}
      <View style={s.hero}>
        <View style={s.glow} />
        <View style={s.heroRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={s.pill}>
              <View style={s.pillDot} />
              <Text style={[s.pillTxt, { fontFamily: C.font.sans }]}>AGENT</Text>
            </View>
            <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Mes Commissions</Text>
          </View>
          <TouchableOpacity style={s.backBtn} onPress={() => void loadStats()}>
            <Ionicons name="refresh" size={18} color={C.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filtres périodes */}
      <FlatList
        horizontal data={PERIODS}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.periods}
        keyExtractor={(item) => item.key}
        style={s.periodsList}
        renderItem={({ item }) => {
          const active = period === item.key;
          return (
            <TouchableOpacity
              style={[s.periodPill, active && { backgroundColor: C.violet, borderColor: C.violet }]}
              onPress={() => setPeriod(item.key)}
              activeOpacity={0.8}
            >
              {active && <View style={s.activeDot} />}
              <Text style={[s.periodTxt, { color: active ? C.white : C.inkMid, fontFamily: C.font.sans }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={C.violet} size="large" />
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
              <View style={s.emptyIconBox}>
                <Ionicons name="bar-chart-outline" size={32} color={C.inkSoft} />
              </View>
              <Text style={[s.emptyTitle, { fontFamily: C.font.serif }]}>Aucune commission</Text>
              <Text style={[s.emptySub,   { fontFamily: C.font.sans  }]}>Pas de transactions sur cette période</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 80 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const h = StyleSheet.create({
  heroCard: {
    backgroundColor: C.white, borderRadius: C.r.xl,
    padding: 22, marginBottom: 16,
    borderWidth: 1.5, borderColor: C.violetBorder,
    shadowColor: C.violet, shadowOpacity: 0.10, shadowRadius: 16, elevation: 6,
  },
  heroTop:       { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  heroIconBox:   { width: 40, height: 40, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  heroLbl:       { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 4, textTransform: "uppercase" },
  heroBadge:     { flexDirection: "row", alignItems: "center", gap: 4 },
  heroBadgeDot:  { width: 5, height: 5, borderRadius: C.r.pill, backgroundColor: C.green },
  heroBadgeTxt:  { fontSize: 9, fontWeight: "700", color: C.green },
  heroAmt:       { color: C.ink, fontSize: 36, fontWeight: "800", letterSpacing: -0.5 },
  heroCur:       { color: C.violet, fontSize: 11, fontWeight: "900", marginTop: 4, letterSpacing: 1, marginBottom: 14 },
  progRow:       { flexDirection: "row", alignItems: "center", gap: 10 },
  progBg:        { flex: 1, height: 5, backgroundColor: C.violetLight, borderRadius: C.r.pill, overflow: "hidden" },
  progFill:      { height: 5, backgroundColor: C.violet, borderRadius: C.r.pill },
  progTxt:       { fontSize: 10, fontWeight: "700", color: C.inkSoft },
  statsRow:      { flexDirection: "row", gap: 10, marginBottom: 20 },
  secRow:        { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  secDot:        { width: 5, height: 5, borderRadius: C.r.pill, backgroundColor: C.violet },
  secLbl:        { fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1.5 },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  hero: {
    backgroundColor: C.violet,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 48 : 16,
    paddingBottom: 22, overflow: "hidden",
  },
  glow:      { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: C.heroGlow, top: -60, right: -40 },
  heroRow:   { flexDirection: "row", alignItems: "center", gap: 14 },
  backBtn: {
    width: 38, height: 38, borderRadius: C.r.sm,
    backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr,
    justifyContent: "center", alignItems: "center",
  },
  pill:      { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, borderRadius: C.r.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 4 },
  pillDot:   { width: 4, height: 4, borderRadius: C.r.pill, backgroundColor: "#A5F3FC" },
  pillTxt:   { color: "#E8E0FF", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  heroTitle: { color: C.white, fontSize: 22, fontWeight: "700" },

  periodsList: { maxHeight: 52, marginTop: 12 },
  periods:     { paddingHorizontal: 18, gap: 8, alignItems: "center" },
  periodPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: C.r.pill,
    backgroundColor: C.white, borderWidth: 1.5, borderColor: C.cardBorder,
  },
  activeDot: { width: 4, height: 4, borderRadius: C.r.pill, backgroundColor: C.white },
  periodTxt: { fontSize: 12, fontWeight: "800" },

  list:  { paddingHorizontal: 18, paddingTop: 16 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyIconBox: { width: 64, height: 64, borderRadius: 18, backgroundColor: C.white, borderWidth: 1, borderColor: C.cardBorder, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle:   { color: C.ink, fontSize: 17, fontWeight: "700" },
  emptySub:     { color: C.inkSoft, fontSize: 12, fontWeight: "600" },
});