// apps/direct-transfair-mobile/components/dashboards/AgentDashboard.tsx
// =========================================================
// AGENT DASHBOARD v7.0 — Direct Transf'air
// ✅ v5.2 : stats réelles depuis les transactions agent
// ✅ v6.0 :
//    - Violet → Bleu professionnel (#2563EB), non agressif
//    - Héro plus compact (paddingBottom 18→10, balCard 16→12)
//    - Arc concave Option C (react-native-svg) comme CompanyAdmin
//    - pageBg bleu clair (#EFF6FF) au lieu de violet pâle
//    - Icône notification → router.push("/(tabs)/notifications")
// ✅ v7.0 :
//    - Héro réduit de ~50 % : paddingTop, polices, paddings divisés
//    - Tout le contenu conservé, rien omis
//    - CONCAVE_H 70 → 50 pour proportionner l'arc au héro plus court
// =========================================================

import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  ScrollView, SafeAreaView, StatusBar, Animated, Platform,
  useWindowDimensions, Dimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Rect } from "react-native-svg";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const { width: SW } = Dimensions.get("window");

// ─── Bleu agent — non agressif ───────────────────────────
const AGENT_BLUE      = "#2563EB"; // bleu-600 Tailwind, professionnel
const AGENT_BLUE_DARK = "#1D4ED8"; // bleu-700
const CONCAVE_H       = 50;        // ✅ v7 : réduit (70→50) pour proportionner l'arc

// ─── Design System ──────────────────────────────────────
const C = {
  // ✅ Violet remplacé par bleu professionnel
  violet:       AGENT_BLUE,
  violetDark:   AGENT_BLUE_DARK,
  violetLight:  "#EFF6FF",
  violetBorder: "#DBEAFE",

  heroGlass:    "rgba(255,255,255,0.14)",
  heroGlassBdr: "rgba(255,255,255,0.22)",
  heroDim:      "rgba(255,255,255,0.72)",
  heroGlow1:    "rgba(255,255,255,0.07)",
  heroGlow2:    "rgba(255,255,255,0.04)",

  // ✅ pageBg bleu clair
  pageBg:       "#EFF6FF",
  white:        "#FFFFFF",
  cardBorder:   "#DBEAFE",

  ink:          "#0F172A",
  inkMid:       "#374151",
  inkSoft:      "#6B7280",

  green:        "#10B981",
  greenBg:      "#ECFDF5",
  greenBorder:  "#A7F3D0",
  greenDark:    "#065F46",

  red:          "#EF4444",
  redBg:        "#FEF2F2",
  redBorder:    "#FECACA",

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
    serif:   Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif",        default: "sans-serif" }),
    medium:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace" }),
  },
};

// ─── Helpers ────────────────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}
function fmt(n: number, currency: string): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

// ─── Arc Concave — même technique que CompanyDashboard ───
function HeroConcave() {
  const d  = `M 0 0 L 0 ${CONCAVE_H} Q ${SW / 2} 0 ${SW} ${CONCAVE_H} L ${SW} 0 Z`;
  const bd = `M 0 ${CONCAVE_H} Q ${SW / 2} 0 ${SW} ${CONCAVE_H}`;
  return (
    <Svg width={SW} height={CONCAVE_H} style={{ marginTop: -1 }}>
      <Rect x={0} y={0} width={SW} height={CONCAVE_H} fill={C.pageBg} />
      <Path d={d} fill={AGENT_BLUE} />
      <Path d={bd} fill="none" stroke="rgba(37,99,235,0.22)" strokeWidth={1.5} />
    </Svg>
  );
}

// ─── Op Card ────────────────────────────────────────────
function OpCard({ title, subtitle, icon, accent, bg, onPress, badge }: {
  title: string; subtitle: string; icon: string;
  accent: string; bg: string; onPress: () => void; badge?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={op.card} onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={[op.corner, { backgroundColor: bg }]} />
        <View style={[op.iconWrap, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={20} color={accent} />
        </View>
        {badge && (
          <View style={[op.badge, { backgroundColor: C.blueBg, borderColor: C.blueBorder }]}>
            <Text style={[op.badgeTxt, { color: C.blue, fontFamily: C.font.sans }]}>{badge}</Text>
          </View>
        )}
        <Text style={[op.title, { fontFamily: C.font.medium }]}>{title}</Text>
        <Text style={[op.sub, { fontFamily: C.font.sans }]} numberOfLines={2}>{subtitle}</Text>
        <View style={[op.arrow, { backgroundColor: bg }]}>
          <Ionicons name="arrow-forward" size={11} color={accent} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const op = StyleSheet.create({
  card:     { backgroundColor: C.white, borderRadius: C.r.lg, padding: 14, borderWidth: 1, borderColor: C.cardBorder, shadowColor: AGENT_BLUE, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, overflow: "hidden", minHeight: 130 },
  corner:   { position: "absolute", top: -16, right: -16, width: 56, height: 56, borderRadius: 28, opacity: 0.45 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  badge:    { position: "absolute", top: 9, right: 9, paddingHorizontal: 6, paddingVertical: 2, borderRadius: C.r.xs, borderWidth: 1 },
  badgeTxt: { fontSize: 7, fontWeight: "600", letterSpacing: 0.3 },
  title:    { fontSize: 13, fontWeight: "500", color: C.ink, marginBottom: 3, lineHeight: 18 },
  sub:      { fontSize: 10, fontWeight: "400", color: C.inkSoft, marginBottom: 10, lineHeight: 14 },
  arrow:    { position: "absolute", bottom: 10, right: 10, width: 22, height: 22, borderRadius: 7, justifyContent: "center", alignItems: "center" },
});

// ─── Report Row ─────────────────────────────────────────
function ReportRow({ title, sub, icon, accent, bg, onPress, value }: {
  title: string; sub: string; icon: string;
  accent: string; bg: string; onPress: () => void; value?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 10 }}>
      <TouchableOpacity
        style={rr.row} onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={[rr.iconBox, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={18} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[rr.title, { fontFamily: C.font.medium }]}>{title}</Text>
          <Text style={[rr.sub,   { fontFamily: C.font.sans   }]}>{sub}</Text>
        </View>
        {value && <Text style={[rr.value, { color: accent, fontFamily: C.font.mono }]}>{value}</Text>}
        <View style={[rr.chevron, { backgroundColor: bg }]}>
          <Ionicons name="chevron-forward" size={13} color={accent} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const rr = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.white, borderRadius: C.r.md, padding: 13, borderWidth: 1, borderColor: C.cardBorder, shadowColor: AGENT_BLUE, shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  iconBox: { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  title:   { fontSize: 13, fontWeight: "500", color: C.ink, marginBottom: 2 },
  sub:     { fontSize: 10, fontWeight: "400", color: C.inkSoft },
  value:   { fontSize: 12, fontWeight: "500" },
  chevron: { width: 24, height: 24, borderRadius: 7, justifyContent: "center", alignItems: "center" },
});

// ─── Stat Chip ──────────────────────────────────────────
function StatChip({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={sc.chip}>
      <Text style={[sc.val, { color: accent, fontFamily: C.font.medium }]}>{value}</Text>
      <Text style={[sc.lbl, { fontFamily: C.font.sans }]}>{label}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  chip: { flex: 1, backgroundColor: C.white, borderRadius: C.r.md, padding: 11, alignItems: "center", borderWidth: 1, borderColor: C.cardBorder, shadowColor: AGENT_BLUE, shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  val:  { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  lbl:  { fontSize: 9, fontWeight: "400", color: C.inkSoft, letterSpacing: 0.5, textTransform: "uppercase" },
});

// ─── Main ───────────────────────────────────────────────
export default function AgentDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [refreshing, setRefreshing] = useState(false);
  const [agencyData, setAgencyData] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, validated: 0, pending: 0 });

  const COUNTRY_CURRENCY_MAP: Record<string, string> = {
    GN: "GNF", SN: "XOF", ML: "XOF", CI: "XOF", BF: "XOF", BJ: "XOF",
    TG: "XOF", NE: "XOF", GW: "XOF", FR: "EUR", DE: "EUR", BE: "EUR",
    IT: "EUR", ES: "EUR", PT: "EUR", NL: "EUR", GB: "GBP", US: "USD",
  };
  const agencyCountryCode = ((agencyData?.country ?? user?.agency?.country ?? "") as string).trim().toUpperCase().substring(0, 2);
  const derivedCurrency   = COUNTRY_CURRENCY_MAP[agencyCountryCode] ?? "XOF";
  const agencyName        = agencyData?.name ?? user?.agency?.name ?? "Mon Agence";
  const currency          = agencyData?.primaryCurrency || agencyData?.wallets?.[0]?.currency || derivedCurrency;

  const agencyWallet = Array.isArray(agencyData?.wallets)
    ? (agencyData.wallets.find((w: any) => w.isDefault) ?? agencyData.wallets[0])
    : null;
  const balance   = toNum(agencyWallet?.balance ?? agencyData?.balance);
  const reserved  = toNum(agencyWallet?.reservedBalance ?? 0);
  const available = balance - reserved;
  const availPct  = balance > 0 ? Math.min((available / balance) * 100, 100) : 0;

  const headerAnim = useRef(new Animated.Value(0)).current;
  const myId = String(user?.id ?? "");

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      if (user?.agencyId) {
        const data = await api.getAgency(user.agencyId as string);
        setAgencyData(data);
      }

      const [txRes, wdRes] = await Promise.allSettled([
        api.getTransactions(),
        api.getWithdrawals(),
      ]);
      const allTx: any[] = txRes.status === "fulfilled" ? txRes.value : [];
      const allWd: any[] = wdRes.status === "fulfilled" ? wdRes.value : [];

      const processedWdTxIds = new Set(
        allWd
          .filter((w) => String(w.processedById ?? "") === myId && w.transactionId)
          .map((w) => String(w.transactionId))
      );

      const agentTxs = allTx.filter((tx) => {
        const type = String(tx.type ?? "").toUpperCase();
        if (type === "AGENCY_REFILL" || type === "REFILL") return true;
        if (type === "DEPOSIT" && String(tx.senderId ?? "") === myId) return true;
        if (processedWdTxIds.has(String(tx.id))) return true;
        if (String(tx.senderId ?? "") === myId) return true;
        return false;
      });

      setStats({
        total:     agentTxs.length,
        validated: agentTxs.filter((tx) => tx.status === "PAID" || tx.status === "VALIDATED").length,
        pending:   agentTxs.filter((tx) => tx.status === "PENDING" || tx.status === "PROCESSING").length,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [user?.agencyId, myId]);

  useFocusEffect(useCallback(() => {
    void loadData();
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
  }, [loadData]));

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={AGENT_BLUE} />

      {/* ══ HÉRO + ARC CONCAVE animés ensemble ══ */}
      <Animated.View style={{
        opacity: headerAnim,
        transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
      }}>
        {/* ── Héro compact v7 ── */}
        <View style={s.hero}>
          {/* Glows décoratifs */}
          <View style={s.glow1} />
          <View style={s.glow2} />

          {/* Ligne du haut : badge + nom + actions */}
          <View style={s.topBar}>
            <View style={{ flex: 1 }}>
              <View style={s.pill}>
                <View style={s.pillDot} />
                <Text style={[s.pillTxt, { fontFamily: C.font.sans }]}>ESPACE GUICHET</Text>
              </View>
              <Text style={[s.heroName, { fontFamily: C.font.serif }]}>
                Bonjour, {user?.firstName || "Agent"} 👋
              </Text>
              <View style={s.agencyRow}>
                <Ionicons name="storefront-outline" size={11} color={C.heroDim} />
                <Text style={[s.agencyTxt, { fontFamily: C.font.sans }]} numberOfLines={1}>
                  {agencyName}
                </Text>
              </View>
            </View>
            <View style={s.topActions}>
              <TouchableOpacity style={s.iconBtn} onPress={loadData}>
                <Ionicons name="refresh" size={15} color={C.white} />
              </TouchableOpacity>
              {/* ✅ Route notifications corrigée */}
              <TouchableOpacity
                style={s.iconBtn}
                onPress={() => router.push("/(tabs)/notifications")}
              >
                <Ionicons name="notifications-outline" size={15} color={C.white} />
                {stats.pending > 0 && <View style={s.notifBadge} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Carte solde — ultra-compacte v7 */}
          <View style={s.balCard}>
            <View style={s.balTop}>
              <View style={{ flex: 1 }}>
                <Text style={[s.balLbl, { fontFamily: C.font.sans }]}>
                  solde agence · {currency.toLowerCase()}
                </Text>
                <Text
                  style={[s.balAmt, { fontFamily: C.font.serif }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {fmt(balance, currency)}
                </Text>
                <Text style={[s.balCur, { fontFamily: C.font.sans }]}>{currency}</Text>
              </View>
              <View style={s.onlinePill}>
                <View style={s.onlineDot} />
                <Text style={[s.onlineTxt, { fontFamily: C.font.sans }]}>En ligne</Text>
              </View>
            </View>
            <View style={s.progBg}>
              <View style={[s.progFill, { width: `${availPct}%` as any }]} />
            </View>
            <View style={s.balFooter}>
              <Text style={[s.balFootLbl, { fontFamily: C.font.sans }]}>
                Disponible <Text style={s.balFootVal}>{fmt(available, currency)} {currency}</Text>
              </Text>
              <Text style={[s.balFootLbl, { fontFamily: C.font.sans }]}>
                Réservé <Text style={[s.balFootVal, { color: "#93C5FD" }]}>{fmt(reserved, currency)} {currency}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* ── Arc concave bleu → pageBg ── */}
        <HeroConcave />
      </Animated.View>

      {/* ══ BODY ══ */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.body, isDesktop && { maxWidth: 960, alignSelf: "center", width: "100%" }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={AGENT_BLUE} />
        }
      >
        {/* Stats réelles */}
        <View style={s.statsRow}>
          <StatChip label="Opérations" value={String(stats.total)}     accent={AGENT_BLUE} />
          <StatChip label="Validées"   value={String(stats.validated)} accent={C.green}    />
          <StatChip label="En attente" value={String(stats.pending)}   accent={C.amber}    />
        </View>

        {/* Opérations rapides */}
        <View style={s.secRow}>
          <View style={[s.secDot, { backgroundColor: AGENT_BLUE }]} />
          <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>OPÉRATIONS RAPIDES</Text>
        </View>

        <View style={s.opsRow}>
          <OpCard
            title="Dépôt Client"   subtitle="Recharger un compte"
            icon="arrow-down-circle-outline" accent={C.green} bg={C.greenBg}
            onPress={() => router.push("/agent/deposit")}
          />
          <OpCard
            title="Retrait Client" subtitle="Payer un code"
            icon="arrow-up-circle-outline"   accent={C.red}   bg={C.redBg}
            onPress={() => router.push("/agent/withdraw")}
          />
        </View>

        <View style={[s.opsRow, { marginBottom: 22 }]}>
          <OpCard
            title="Envoi Cash"   subtitle="Sans compte"
            icon="paper-plane-outline" accent={C.blue} bg={C.blueBg}
            onPress={() => router.push("/agent/send-cash")}
            badge="Nouveau"
          />
          <OpCard
            title="Clôture Jour" subtitle="Bilan & commissions"
            icon="calculator-outline" accent={C.purple} bg={C.purpleBg}
            onPress={() => router.push("/agent/commissions")}
          />
        </View>

        {/* Suivi & rapports */}
        <View style={[s.secRow, { marginTop: 2 }]}>
          <View style={[s.secDot, { backgroundColor: C.blue }]} />
          <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>SUIVI & RAPPORTS</Text>
        </View>

        <ReportRow
          title="Journal de Caisse"  sub="Toutes les opérations du jour"
          icon="list-outline"        accent={C.amber}  bg={C.amberBg}
          onPress={() => router.push("/agent/transactions")}
        />
        <ReportRow
          title="Mes Commissions"    sub="Gains, paliers et historique"
          icon="bar-chart-outline"   accent={C.purple} bg={C.purpleBg}
          onPress={() => router.push("/agent/commissions")}
        />
        <ReportRow
          title="Taux du Jour"       sub="Devises & taux de change"
          icon="trending-up-outline" accent={C.green}  bg={C.greenBg}
          onPress={() => router.push("/(tabs)/rates")}
          value="1 EUR"
        />

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  // ── Héro v7 — ~50 % plus court, sans borderRadius bas (arc concave) ──
  hero: {
    backgroundColor: AGENT_BLUE,
    paddingHorizontal: 18,
    paddingTop:    Platform.OS === "android" ? 32 : 6,   // ✅ v7 : réduit (44→32 / 14→6)
    paddingBottom: 4,                                     // ✅ v7 : réduit (10→4)
    overflow: "hidden",
  },

  // Glows décoratifs
  glow1: {
    position: "absolute", top: -30, right: -30,
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: C.heroGlow1,
  },
  glow2: {
    position: "absolute", bottom: 0, left: -20,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.heroGlow2,
  },

  // ── Top bar ──
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,           // ✅ v7 : réduit
  },

  // Badge "ESPACE GUICHET"
  pill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 20, alignSelf: "flex-start",
    marginBottom: 3,           // ✅ v7 : réduit
  },
  pillDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.green },
  pillTxt: { fontSize: 8, fontWeight: "700", color: C.white, letterSpacing: 1 },

  // Nom
  heroName: {
    fontSize: 19,              // ✅ v7 : réduit (~28→19)
    fontWeight: "700",
    color: C.white,
    marginBottom: 2,
  },

  // Agence
  agencyRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  agencyTxt: { fontSize: 10, color: C.heroDim },

  // Boutons actions
  topActions: { flexDirection: "row", gap: 7 },
  iconBtn: {
    width: 30, height: 30,     // ✅ v7 : réduit (34×34 → 30×30)
    borderRadius: 9,
    backgroundColor: C.heroGlass,
    borderWidth: 1, borderColor: C.heroGlassBdr,
    justifyContent: "center", alignItems: "center",
  },
  notifBadge: {
    position: "absolute", top: 5, right: 5,
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: C.red,
    borderWidth: 1.5, borderColor: AGENT_BLUE,
  },

  // ── Carte solde ──
  balCard: {
    backgroundColor: C.white,
    borderRadius: C.r.md,
    padding: 9,                // ✅ v7 : réduit (~14→9)
    marginTop: 5,              // ✅ v7 : réduit
  },
  balTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,           // ✅ v7 : réduit
  },
  balLbl:  { fontSize: 9, color: C.inkSoft, marginBottom: 1 },
  balAmt:  {
    fontSize: 24,              // ✅ v7 : réduit (~44→24)
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.5,
  },
  balCur:  {
    fontSize: 10,              // ✅ v7 : réduit (~14→10)
    fontWeight: "600",
    color: AGENT_BLUE,
    marginTop: 1,
  },

  // Pill "En ligne"
  onlinePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: C.greenBg,
    borderWidth: 1, borderColor: C.greenBorder,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 20,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  onlineTxt: { fontSize: 9, fontWeight: "500", color: C.greenDark },

  // Barre de progression
  progBg:   { height: 3, backgroundColor: C.blueBorder, borderRadius: 2, marginBottom: 4 }, // ✅ v7 : réduit (5→3)
  progFill: { height: 3, backgroundColor: AGENT_BLUE,   borderRadius: 2 },

  // Pied de carte (Disponible / Réservé)
  balFooter:  { flexDirection: "row", justifyContent: "space-between" },
  balFootLbl: { fontSize: 9, color: C.inkSoft },
  balFootVal: { fontWeight: "600", color: AGENT_BLUE },

  // ── Corps (sous le héro) ──
  body:     { paddingHorizontal: 16, paddingTop: 12 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  secRow:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  secDot:   { width: 6, height: 6, borderRadius: 3 },
  secLbl:   { fontSize: 10, fontWeight: "700", color: C.inkSoft, letterSpacing: 1 },
  opsRow:   { flexDirection: "row", gap: 12, marginBottom: 12 },
});