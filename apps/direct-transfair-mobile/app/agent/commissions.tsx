// apps/direct-transfair-mobile/app/agent/commissions.tsx
// =========================================================
// AGENT COMMISSIONS v6.0 — Direct Transf'air
// ✅ v5.0 : stats période + historique détaillé
// ✅ v6.0 :
//    - Couleur : violet → Bleu agent #2563EB (cohérent avec le héro)
//    - Hero card compactée : padding 22→14, montant 36→24, icône 40→32
//    - Montant + devise sur la même ligne (plus compact)
//    - Filtres période : FlatList → ScrollView (fix gap non supporté)
//    - Timeline dots mis à jour → bleu
//    - pageBg bleu pâle cohérent avec AgentDashboard
// =========================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  SafeAreaView, TouchableOpacity, Platform, StatusBar,
  Animated, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";

// ─── Couleur bleu agent (identique au héro d'accueil) ────
const AGENT_BLUE      = "#2563EB";
const AGENT_BLUE_DARK = "#1D4ED8";

// ─── Design System ──────────────────────────────────────
const C = {
  violet:       AGENT_BLUE,       // ✅ bleu au lieu de violet
  violetLight:  "#EFF6FF",
  violetBorder: "#DBEAFE",

  heroGlass:    "rgba(255,255,255,0.14)",
  heroGlassBdr: "rgba(255,255,255,0.22)",
  heroDim:      "rgba(255,255,255,0.65)",
  heroGlow:     "rgba(255,255,255,0.08)",

  pageBg:       "#EFF6FF",        // ✅ bleu pâle cohérent
  white:        "#FFFFFF",
  cardBorder:   "#DBEAFE",
  inputBg:      "#F0F4FF",

  ink:          "#0F172A",
  inkMid:       "#374151",
  inkSoft:      "#6B7280",

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
    serif: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace" }),
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
  if (now.getTime() - d.getTime() < 86400000)
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ─── Stat Box ───────────────────────────────────────────
function StatBox({ icon, label, value, accent, bg }: {
  icon: string; label: string; value: string; accent: string; bg: string;
}) {
  return (
    <View style={[st.box, { borderColor: `${accent}22` }]}>
      <View style={[st.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={14} color={accent} />
      </View>
      <Text
        style={[st.value, { color: accent, fontFamily: C.font.mono }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={[st.label, { fontFamily: C.font.sans }]}>{label}</Text>
    </View>
  );
}
const st = StyleSheet.create({
  box:     { flex: 1, backgroundColor: C.white, borderRadius: C.r.lg, padding: 12, alignItems: "center", borderWidth: 1, gap: 3, shadowColor: AGENT_BLUE, shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 },
  iconBox: { width: 28, height: 28, borderRadius: 9, justifyContent: "center", alignItems: "center", marginBottom: 2 },
  value:   { fontSize: 16, fontWeight: "900" },
  label:   { fontSize: 8, fontWeight: "800", color: C.inkSoft, letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center" },
});

// ─── Commission Row ─────────────────────────────────────
function CommRow({ item }: { item: any }) {
  const commission = toNum(item.agencyCommission ?? item.myCommission ?? 0);
  const amount     = toNum(item.amount);
  const fees       = toNum(item.fees);
  return (
    <View style={cr.row}>
      {/* Timeline */}
      <View style={cr.timeline}>
        {/* ✅ dot bleu au lieu de violet */}
        <View style={cr.timelineDot} />
        <View style={cr.timelineLine} />
      </View>
      <View style={cr.card}>
        <View style={cr.top}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[cr.origin, { fontFamily: C.font.sans }]} numberOfLines={1}>
              {item.origin || "Transaction"}
            </Text>
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
  // ✅ Timeline dot bleu
  timelineDot:  { width: 10, height: 10, borderRadius: C.r.pill, backgroundColor: AGENT_BLUE, borderWidth: 2, borderColor: "#BFDBFE" },
  timelineLine: { width: 2, flex: 1, backgroundColor: "#BFDBFE", marginTop: 4 },
  card: {
    flex: 1, backgroundColor: C.white, borderRadius: C.r.lg,
    padding: 12, borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: AGENT_BLUE, shadowOpacity: 0.03, shadowRadius: 5, elevation: 1,
  },
  top:      { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
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
  const router   = useRouter();
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

  // Progression du jour vs total (seulement si on a des données)
  const progressPct = totalComm > 0 ? Math.min((todayComm / totalComm) * 100, 100) : 0;

  const renderHeader = () => (
    <View>
      {/* ✅ Hero card compactée — padding 22→14, montant+devise sur 1 ligne */}
      <View style={h.heroCard}>

        {/* Ligne 1 : icône + label + badge */}
        <View style={h.heroTop}>
          <View style={[h.heroIconBox, { backgroundColor: C.violetLight }]}>
            <Ionicons name="trending-up" size={15} color={AGENT_BLUE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[h.heroLbl, { fontFamily: C.font.sans }]}>COMMISSIONS DU JOUR</Text>
            <View style={h.heroBadge}>
              <View style={h.heroBadgeDot} />
              <Text style={[h.heroBadgeTxt, { fontFamily: C.font.sans }]}>Temps réel</Text>
            </View>
          </View>
          {/* ✅ Total période affiché directement dans la carte */}
          <View style={h.periodTotal}>
            <Text style={[h.periodTotalLbl, { fontFamily: C.font.sans }]}>Période</Text>
            <Text style={[h.periodTotalVal, { fontFamily: C.font.mono, color: AGENT_BLUE }]}>
              {fmt(totalComm)}
            </Text>
          </View>
        </View>

        {/* Ligne 2 : montant + devise sur la même ligne ✅ */}
        <View style={h.amtRow}>
          <Text style={[h.heroAmt, { fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit>
            {fmt(todayComm)}
          </Text>
          <View style={h.heroCurBadge}>
            <Text style={[h.heroCur, { fontFamily: C.font.mono }]}>XOF</Text>
          </View>
        </View>

        {/* Ligne 3 : barre de progression */}
        <View style={h.progRow}>
          <View style={h.progBg}>
            <View style={[h.progFill, { width: `${progressPct}%` as any }]} />
          </View>
          <Text style={[h.progTxt, { fontFamily: C.font.sans }]}>
            {Math.round(progressPct)}% du total
          </Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={h.statsRow}>
        <StatBox icon="analytics-outline" label="Volume"     value={fmt(totalVol)}              accent={C.blue}   bg={C.blueBg}   />
        <StatBox icon="list-outline"      label="Opérations" value={String(Math.round(count))}  accent={C.green}  bg={C.greenBg}  />
        <StatBox icon="star-outline"      label="Moy./op."   value={count > 0 ? fmt(totalVol / count) : "0"} accent={C.purple} bg={C.purpleBg} />
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
      {/* ✅ StatusBar bleu */}
      <StatusBar barStyle="light-content" backgroundColor={AGENT_BLUE} />

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

      {/* ── Filtres période — ScrollView (fix gap) ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.periodsList}
        contentContainerStyle={s.periods}
      >
        {PERIODS.map((item) => {
          const active = period === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                s.periodPill,
                active && { backgroundColor: AGENT_BLUE, borderColor: AGENT_BLUE },
              ]}
              onPress={() => setPeriod(item.key)}
              activeOpacity={0.8}
            >
              {active && <View style={s.activeDot} />}
              <Text style={[
                s.periodTxt,
                { fontFamily: C.font.sans },
                { color: active ? C.white : C.inkMid },
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={AGENT_BLUE} size="large" />
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

// ─── Styles hero card ────────────────────────────────────
const h = StyleSheet.create({

  // ✅ Carte commission compactée — padding 22→14
  heroCard: {
    backgroundColor: C.white,
    borderRadius:    C.r.lg,     // xl→lg
    padding:         14,         // 22→14
    marginBottom:    14,
    borderWidth:     1,
    borderColor:     C.violetBorder,
    shadowColor:     AGENT_BLUE,
    shadowOpacity:   0.07,
    shadowRadius:    8,          // 16→8
    elevation:       2,          // 6→2
  },

  // Ligne 1 : icône + label + total période
  heroTop: {
    flexDirection:  "row",
    alignItems:     "flex-start",
    gap:            10,
    marginBottom:   10,          // 14→10
  },
  heroIconBox: {
    width: 32, height: 32,       // 40→32
    borderRadius: 10,            // 13→10
    justifyContent: "center", alignItems: "center",
  },
  heroLbl:  { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 3, textTransform: "uppercase" },
  heroBadge:    { flexDirection: "row", alignItems: "center", gap: 4 },
  heroBadgeDot: { width: 5, height: 5, borderRadius: C.r.pill, backgroundColor: C.green },
  heroBadgeTxt: { fontSize: 9, fontWeight: "700", color: C.green },

  // Total période affiché en haut à droite de la carte
  periodTotal: {
    alignItems: "flex-end",
    paddingLeft: 8,
  },
  periodTotalLbl: { fontSize: 8, fontWeight: "700", color: C.inkSoft, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 2 },
  periodTotalVal: { fontSize: 13, fontWeight: "900" },

  // Ligne 2 : montant + devise alignés baseline ✅
  amtRow: {
    flexDirection:  "row",
    alignItems:     "baseline",
    gap:            8,
    marginBottom:   8,           // plus compact
  },
  heroAmt: {
    color:       C.ink,
    fontSize:    24,             // 36→24
    fontWeight:  "800",
    letterSpacing: -0.3,
  },
  heroCurBadge: {
    backgroundColor: C.violetLight,
    borderRadius:    C.r.xs,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: C.violetBorder,
  },
  heroCur: {
    color:       AGENT_BLUE,
    fontSize:    10,
    fontWeight:  "900",
    letterSpacing: 1,
  },

  // Ligne 3 : barre de progression
  progRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  progBg:   { flex: 1, height: 4, backgroundColor: C.violetLight, borderRadius: C.r.pill, overflow: "hidden" },
  progFill: { height: 4, backgroundColor: AGENT_BLUE, borderRadius: C.r.pill },
  progTxt:  { fontSize: 10, fontWeight: "700", color: C.inkSoft, minWidth: 70, textAlign: "right" },

  // Stats row (plus compact maintenant qu'il y a seulement 3 items)
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  secRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  secDot:   { width: 5, height: 5, borderRadius: C.r.pill, backgroundColor: AGENT_BLUE },
  secLbl:   { fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1.5 },
});

// ─── Styles page ────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  // ✅ Hero bleu compact
  hero: {
    backgroundColor: AGENT_BLUE,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop:    Platform.OS === "android" ? 44 : 16,
    paddingBottom: 16,           // 22→16
    overflow: "hidden",
  },
  glow:      { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.07)", top: -60, right: -40 },
  heroRow:   { flexDirection: "row", alignItems: "center", gap: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: C.r.sm,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
    justifyContent: "center", alignItems: "center",
  },
  pill:    { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", borderRadius: C.r.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 4 },
  pillDot: { width: 4, height: 4, borderRadius: C.r.pill, backgroundColor: "#BAE6FD" },
  pillTxt: { color: "#E0F2FE", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  heroTitle: { color: C.white, fontSize: 20, fontWeight: "700" },

  // ✅ Filtres période : ScrollView + marginRight (plus de gap)
  periodsList: {
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    flexShrink: 0,
  },
  periods: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  periodPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: C.r.pill,
    backgroundColor: C.white,
    borderWidth: 1.5, borderColor: C.cardBorder,
    marginRight: 8,            // ✅ marginRight au lieu de gap dans le parent
  },
  activeDot: { width: 4, height: 4, borderRadius: C.r.pill, backgroundColor: C.white },
  periodTxt: { fontSize: 12, fontWeight: "800" },

  list:  { paddingHorizontal: 16, paddingTop: 14 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyIconBox: {
    width: 60, height: 60, borderRadius: 17,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.cardBorder,
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  emptyTitle: { color: C.ink, fontSize: 17, fontWeight: "700" },
  emptySub:   { color: C.inkSoft, fontSize: 12, fontWeight: "600" },
});