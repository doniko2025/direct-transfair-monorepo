// apps/direct-transfair-mobile/app/agent/commissions.tsx
// =========================================================
// AGENT COMMISSIONS v6.1 — Direct Transf'air
// ✅ v6.0 : bleu agent, hero compact, filtres ScrollView
// ✅ v6.1 :
//   FIX espaces vides :
//     - Animated.FlatList + loading view → flex: 1 ajouté
//       (même bug que wallet-clients : sans flex:1 le FlatList
//        ne prend pas l'espace dispo et laisse un grand vide)
//   Filtre période redesigné :
//     - ScrollView de pills horizontal SUPPRIMÉ
//     - Remplacé par 1 bouton compact "Période sélectionnée ˅"
//     - Tap → bottom sheet vertical avec la liste des 5 périodes
//       (radio button + icône + description par option)
// =========================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  SafeAreaView, TouchableOpacity, Platform, StatusBar,
  Animated, ScrollView, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";

const AGENT_BLUE      = "#2563EB";
const AGENT_BLUE_DARK = "#1D4ED8";

const C = {
  violet:       AGENT_BLUE,
  violetLight:  "#EFF6FF",
  violetBorder: "#DBEAFE",
  heroGlass:    "rgba(255,255,255,0.14)",
  heroGlassBdr: "rgba(255,255,255,0.22)",
  heroDim:      "rgba(255,255,255,0.65)",
  heroGlow:     "rgba(255,255,255,0.08)",
  pageBg:       "#FFFFFF",   // ✅ v6.1 : blanc pur (cohérent avec les autres pages)
  white:        "#FFFFFF",
  cardBorder:   "#E8EDF5",
  ink:          "#0F172A",
  inkMid:       "#374151",
  inkSoft:      "#6B7280",
  green:        "#10B981", greenBg:  "#ECFDF5", greenBorder: "#A7F3D0", greenDark: "#065F46",
  blue:         "#3B82F6", blueBg:   "#EFF6FF", blueBorder:  "#BFDBFE",
  amber:        "#F59E0B", amberBg:  "#FFFBEB", amberBorder: "#FDE68A",
  purple:       "#8B5CF6", purpleBg: "#F5F3FF", purpleBorder:"#DDD6FE",
  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif:  Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:   Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:   Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// ─── Périodes avec métadonnées ────────────────────────────
const PERIODS = [
  { key: "day",     label: "Aujourd'hui", desc: "Transactions du jour",     icon: "sunny-outline"      },
  { key: "week",    label: "7 Jours",     desc: "7 derniers jours",         icon: "calendar-outline"   },
  { key: "month",   label: "Ce Mois",     desc: "Mois en cours",            icon: "calendar-number-outline" },
  { key: "quarter", label: "Trimestre",   desc: "90 derniers jours",        icon: "stats-chart-outline"},
  { key: "year",    label: "Année",       desc: "12 derniers mois",         icon: "trending-up-outline"},
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

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

// ─── ✅ v6.1 — Period Dropdown Modal (liste verticale) ───
function PeriodDropdown({ visible, current, onSelect, onClose }: {
  visible: boolean;
  current: PeriodKey;
  onSelect: (k: PeriodKey) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={pd.overlay} activeOpacity={1} onPress={onClose}>
        <View style={pd.sheet}>
          <View style={pd.handle} />
          <Text style={[pd.title, { fontFamily: C.font.serif }]}>Sélectionner une période</Text>

          {PERIODS.map((p) => {
            const isActive = current === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                style={[pd.item, isActive && pd.itemActive]}
                onPress={() => { onSelect(p.key); onClose(); }}
                activeOpacity={0.8}
              >
                {/* Icône */}
                <View style={[pd.iconBox, isActive && { backgroundColor: `${AGENT_BLUE}18` }]}>
                  <Ionicons name={p.icon as any} size={17} color={isActive ? AGENT_BLUE : C.inkSoft} />
                </View>

                {/* Label + description */}
                <View style={{ flex: 1 }}>
                  <Text style={[pd.label, { fontFamily: C.font.sans, color: isActive ? AGENT_BLUE : C.ink, fontWeight: isActive ? "800" : "600" }]}>
                    {p.label}
                  </Text>
                  <Text style={[pd.desc, { fontFamily: C.font.sans }]}>{p.desc}</Text>
                </View>

                {/* Radio button */}
                <View style={[pd.radio, isActive && pd.radioActive]}>
                  {isActive && <View style={pd.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={{ height: 24 }} />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
const pd = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet:   { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20 },
  handle:  { width: 36, height: 4, borderRadius: 99, backgroundColor: C.cardBorder, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  title:   { fontSize: 18, fontWeight: "700", color: C.ink, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#F0F4FB", marginBottom: 8 },
  item:    { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 15, paddingHorizontal: 10, borderRadius: 12, marginBottom: 4 },
  itemActive: { backgroundColor: `${AGENT_BLUE}08` },
  iconBox: { width: 38, height: 38, borderRadius: 11, backgroundColor: "#F4F7FB", justifyContent: "center", alignItems: "center" },
  label:   { fontSize: 15 },
  desc:    { fontSize: 11, color: C.inkSoft, marginTop: 2, fontWeight: "500" },
  radio:   { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.cardBorder, justifyContent: "center", alignItems: "center" },
  radioActive: { borderColor: AGENT_BLUE },
  radioDot:{ width: 10, height: 10, borderRadius: 5, backgroundColor: AGENT_BLUE },
});

// ─── Stat Box ─────────────────────────────────────────────
function StatBox({ icon, label, value, accent, bg }: {
  icon: string; label: string; value: string; accent: string; bg: string;
}) {
  return (
    <View style={[st.box, { borderColor: `${accent}22` }]}>
      <View style={[st.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={14} color={accent} />
      </View>
      <Text style={[st.value, { color: accent, fontFamily: C.font.mono }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[st.label, { fontFamily: C.font.sans }]}>{label}</Text>
    </View>
  );
}
const st = StyleSheet.create({
  box:     { flex: 1, backgroundColor: C.white, borderRadius: C.r.lg, padding: 12, alignItems: "center", borderWidth: 1, gap: 3, shadowColor: "#64748B", shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  iconBox: { width: 28, height: 28, borderRadius: 9, justifyContent: "center", alignItems: "center", marginBottom: 2 },
  value:   { fontSize: 16, fontWeight: "900" },
  label:   { fontSize: 8, fontWeight: "800", color: C.inkSoft, letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center" },
});

// ─── Commission Row ───────────────────────────────────────
function CommRow({ item }: { item: any }) {
  const commission = toNum(item.agencyCommission ?? item.myCommission ?? 0);
  const amount     = toNum(item.amount);
  const fees       = toNum(item.fees);
  return (
    <View style={cr.row}>
      <View style={cr.timeline}>
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
            <Text style={[cr.fees,   { fontFamily: C.font.sans  }]}>Frais : {fmt(fees)}</Text>
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
  timelineDot:  { width: 10, height: 10, borderRadius: C.r.pill, backgroundColor: AGENT_BLUE, borderWidth: 2, borderColor: "#BFDBFE" },
  timelineLine: { width: 2, flex: 1, backgroundColor: "#BFDBFE", marginTop: 4 },
  card:         { flex: 1, backgroundColor: C.white, borderRadius: C.r.lg, padding: 12, borderWidth: 1, borderColor: C.cardBorder, shadowColor: "#64748B", shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  top:          { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  origin:       { color: C.ink, fontSize: 13, fontWeight: "700", marginBottom: 3 },
  dateRow:      { flexDirection: "row", alignItems: "center", gap: 4 },
  date:         { color: C.inkSoft, fontSize: 10, fontWeight: "600" },
  right:        { alignItems: "flex-end" },
  amount:       { color: C.ink, fontSize: 12, fontWeight: "700" },
  fees:         { color: C.inkSoft, fontSize: 10, fontWeight: "600", marginTop: 2 },
  commPill:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.greenBg, borderRadius: C.r.sm, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.greenBorder, alignSelf: "flex-start" },
  commTxt:      { color: C.greenDark, fontSize: 12, fontWeight: "900" },
});

// ─── Main ─────────────────────────────────────────────────
export default function AgentCommissionsScreen() {
  const router   = useRouter();
  const [period,          setPeriod]          = useState<PeriodKey>("day");
  const [data,            setData]            = useState<any>(null);
  const [loading,         setLoading]         = useState(true);
  // ✅ v6.1 : état pour le dropdown période
  const [showPeriodDrop,  setShowPeriodDrop]  = useState(false);
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

  const todayComm  = toNum(data?.todayCommissions);
  const totalComm  = toNum(data?.totalCommissions);
  const totalVol   = toNum(data?.totalVolume);
  const count      = toNum(data?.count);
  const history: any[] = Array.isArray(data?.history) ? data.history : [];
  const progressPct = totalComm > 0 ? Math.min((todayComm / totalComm) * 100, 100) : 0;

  const currentPeriod = PERIODS.find(p => p.key === period)!;

  const renderHeader = () => (
    <View>
      {/* Carte commission */}
      <View style={h.heroCard}>
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
          <View style={h.periodTotal}>
            <Text style={[h.periodTotalLbl, { fontFamily: C.font.sans }]}>PÉRIODE</Text>
            <Text style={[h.periodTotalVal, { fontFamily: C.font.mono, color: AGENT_BLUE }]}>
              {fmt(totalComm)}
            </Text>
          </View>
        </View>
        <View style={h.amtRow}>
          <Text style={[h.heroAmt, { fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit>
            {fmt(todayComm)}
          </Text>
          <View style={h.heroCurBadge}>
            <Text style={[h.heroCur, { fontFamily: C.font.mono }]}>XOF</Text>
          </View>
        </View>
        <View style={h.progRow}>
          <View style={h.progBg}>
            <View style={[h.progFill, { width: `${progressPct}%` as any }]} />
          </View>
          <Text style={[h.progTxt, { fontFamily: C.font.sans }]}>{Math.round(progressPct)}% du total</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={h.statsRow}>
        <StatBox icon="analytics-outline" label="Volume"     value={fmt(totalVol)}             accent={C.blue}   bg={C.blueBg}   />
        <StatBox icon="list-outline"      label="Opérations" value={String(Math.round(count))} accent={C.green}  bg={C.greenBg}  />
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
      <StatusBar barStyle="light-content" backgroundColor={AGENT_BLUE} />

      {/* ── Hero bleu ── */}
      <View style={s.hero}>
        <View style={s.glow} />
        <View style={s.heroRow}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={18} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={s.pill}>
              <View style={s.pillDot} />
              <Text style={[s.pillTxt, { fontFamily: C.font.sans }]}>AGENT</Text>
            </View>
            <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Mes Commissions</Text>
          </View>
          <TouchableOpacity style={s.iconBtn} onPress={() => void loadStats()}>
            <Ionicons name="refresh" size={18} color={C.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ✅ v6.1 — BOUTON DROPDOWN PÉRIODE (remplace la ligne de pills) */}
      <View style={s.periodBar}>
        <TouchableOpacity
          style={s.periodBtn}
          onPress={() => setShowPeriodDrop(true)}
          activeOpacity={0.85}
        >
          {/* Icône de la période sélectionnée */}
          <View style={s.periodBtnIcon}>
            <Ionicons name={currentPeriod.icon as any} size={16} color={AGENT_BLUE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.periodBtnLabel, { fontFamily: C.font.sans }]}>{currentPeriod.label}</Text>
            <Text style={[s.periodBtnDesc,  { fontFamily: C.font.sans }]}>{currentPeriod.desc}</Text>
          </View>
          {/* Badge du nom de période actif */}
          <View style={s.periodBtnBadge}>
            <Text style={[s.periodBtnBadgeTxt, { fontFamily: C.font.sans }]}>
              {PERIODS.findIndex(p => p.key === period) + 1}/{PERIODS.length}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={AGENT_BLUE} />
        </TouchableOpacity>
      </View>

      {/* ✅ v6.1 FIX espaces vides : flex:1 sur le FlatList + loading */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={AGENT_BLUE} size="large" />
        </View>
      ) : (
        <Animated.FlatList
          style={{ flex: 1, opacity: fadeAnim }}   // ← ✅ flex:1 ajouté
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

      {/* ✅ v6.1 — Modal dropdown période */}
      <PeriodDropdown
        visible={showPeriodDrop}
        current={period}
        onSelect={setPeriod}
        onClose={() => setShowPeriodDrop(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles hero card ────────────────────────────────────
const h = StyleSheet.create({
  heroCard: {
    backgroundColor: C.white, borderRadius: C.r.lg, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: "#64748B", shadowOpacity: 0.09, shadowRadius: 14, elevation: 5,
  },
  heroTop:     { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  heroIconBox: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  heroLbl:     { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 3, textTransform: "uppercase" },
  heroBadge:   { flexDirection: "row", alignItems: "center", gap: 4 },
  heroBadgeDot:{ width: 5, height: 5, borderRadius: C.r.pill, backgroundColor: C.green },
  heroBadgeTxt:{ fontSize: 9, fontWeight: "700", color: C.green },
  periodTotal: { alignItems: "flex-end", paddingLeft: 8 },
  periodTotalLbl: { fontSize: 8, fontWeight: "700", color: C.inkSoft, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 2 },
  periodTotalVal: { fontSize: 13, fontWeight: "900" },
  amtRow:      { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 8 },
  heroAmt:     { color: C.ink, fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  heroCurBadge:{ backgroundColor: C.violetLight, borderRadius: C.r.xs, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: C.violetBorder },
  heroCur:     { color: AGENT_BLUE, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  progRow:     { flexDirection: "row", alignItems: "center", gap: 10 },
  progBg:      { flex: 1, height: 4, backgroundColor: C.violetLight, borderRadius: C.r.pill, overflow: "hidden" },
  progFill:    { height: 4, backgroundColor: AGENT_BLUE, borderRadius: C.r.pill },
  progTxt:     { fontSize: 10, fontWeight: "700", color: C.inkSoft, minWidth: 70, textAlign: "right" },
  statsRow:    { flexDirection: "row", gap: 8, marginBottom: 18 },
  secRow:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  secDot:      { width: 5, height: 5, borderRadius: C.r.pill, backgroundColor: AGENT_BLUE },
  secLbl:      { fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1.5 },
});

// ─── Styles page ──────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  // Héro bleu compact
  hero: {
    backgroundColor: AGENT_BLUE,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop:    Platform.OS === "android" ? 44 : 16,
    paddingBottom: 16,
    overflow: "hidden",
    shadowColor: "#1D4ED8", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 10,
  },
  glow:      { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.07)", top: -60, right: -40 },
  heroRow:   { flexDirection: "row", alignItems: "center", gap: 14 },
  iconBtn:   { width: 36, height: 36, borderRadius: C.r.sm, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", justifyContent: "center", alignItems: "center" },
  pill:      { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", borderRadius: C.r.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 4 },
  pillDot:   { width: 4, height: 4, borderRadius: C.r.pill, backgroundColor: "#BAE6FD" },
  pillTxt:   { color: "#E0F2FE", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  heroTitle: { color: C.white, fontSize: 20, fontWeight: "700" },

  // ✅ v6.1 : barre dropdown période — compact, 1 seule ligne
  periodBar: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: "#F0F4FB",
  },
  periodBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: `${AGENT_BLUE}08`,
    borderWidth: 1.5, borderColor: `${AGENT_BLUE}25`,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
  },
  periodBtnIcon:  { width: 34, height: 34, borderRadius: 10, backgroundColor: `${AGENT_BLUE}14`, justifyContent: "center", alignItems: "center" },
  periodBtnLabel: { fontSize: 13, fontWeight: "700", color: AGENT_BLUE },
  periodBtnDesc:  { fontSize: 10, color: C.inkSoft, fontWeight: "500", marginTop: 1 },
  periodBtnBadge: { paddingHorizontal: 7, paddingVertical: 3, backgroundColor: `${AGENT_BLUE}15`, borderRadius: 8 },
  periodBtnBadgeTxt: { fontSize: 10, fontWeight: "800", color: AGENT_BLUE },

  list:  { paddingHorizontal: 16, paddingTop: 14 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyIconBox: {
    width: 60, height: 60, borderRadius: 17,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.cardBorder,
    justifyContent: "center", alignItems: "center", marginBottom: 4,
    shadowColor: "#64748B", shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  emptyTitle: { color: C.ink, fontSize: 17, fontWeight: "700" },
  emptySub:   { color: C.inkSoft, fontSize: 12, fontWeight: "600" },
});