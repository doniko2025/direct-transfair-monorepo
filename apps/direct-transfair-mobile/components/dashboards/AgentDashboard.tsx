// apps/direct-transfair-mobile/components/dashboards/AgentDashboard.tsx
// =========================================================
// AGENT DASHBOARD v9.0 — Direct Transf'air
// ✅ v9.0 :
//    - Héro LinearGradient bleu SUPPRIMÉ → header blanc pur
//    - StatusBar : dark-content (texte sombre, fond blanc)
//    - Pill "ESPACE GUICHET" : fond bleu pâle + texte bleu accent (inversé)
//    - Greeting + agence : couleurs sombres (#0F172A / #6B7280)
//    - Boutons top-bar : fond gris clair (#F1F5F9) + icônes sombres
//    - Balance card : bande accent bleue 4px en haut (élément signature),
//      ombre grise neutre, fond blanc, balance amount agrandi (28→32px)
//    - Glows décoratifs supprimés (inutiles sur fond blanc)
//    - Body : fond #F7F8FA (légèrement off-white) → cartes blanches flottent
//    - StatChip : valeur agrandie (18→22px) + fond #F7F8FA
//    - Section labels : dot remplacé par ligne courte + police légèrement agrandie
//    - import LinearGradient retiré (n'est plus utilisé)
//    - AUCUNE modification logique métier / API / navigation / états
// ✅ v8.0 : Héro rectangulaire LinearGradient #2563EB→#1D4ED8
//    borderBottomRadius 28 + ombre bleue + glows décoratifs
// ✅ v7.0 : Héro réduit ~50%, arc concave, bleu professionnel
// =========================================================

import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  ScrollView, SafeAreaView, StatusBar, Animated, Platform,
  useWindowDimensions, Dimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Rect } from "react-native-svg"; // conservé (import inutilisé OK)
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const { width: SW } = Dimensions.get("window");

// ─── Bleu accent (micro-détails uniquement en v9) ─────────
const AGENT_BLUE      = "#2563EB";
const AGENT_BLUE_DARK = "#1D4ED8";

// ─── Design System v9 ─────────────────────────────────────
const C = {
  // ✅ v9.0 : accent bleu réduit aux micro-détails (band, progress, icons actifs)
  accent:       AGENT_BLUE,
  accentDark:   AGENT_BLUE_DARK,
  accentPale:   "#EFF6FF",
  accentBorder: "#DBEAFE",

  // Alias compat sous-composants (OpCard / ReportRow / StatChip non modifiés)
  violet:       AGENT_BLUE,
  violetDark:   AGENT_BLUE_DARK,
  violetLight:  "#EFF6FF",
  violetBorder: "#DBEAFE",

  // ✅ v9.0 : fond global blanc pur + off-white pour body scrollable
  pageBg:       "#FFFFFF",
  bodyBg:       "#F7F8FA",   // légèrement off-white → cartes blanches ressortent
  surface:      "#FFFFFF",
  white:        "#FFFFFF",   // alias compat
  cardBorder:   "#E8EDF5",

  ink:          "#0F172A",
  inkMid:       "#374151",
  inkSoft:      "#6B7280",

  green:        "#10B981", greenBg: "#ECFDF5", greenBorder: "#A7F3D0", greenDark: "#065F46",
  red:          "#EF4444", redBg:   "#FEF2F2", redBorder:   "#FECACA",
  blue:         "#3B82F6", blueBg:  "#EFF6FF", blueBorder:  "#BFDBFE",
  amber:        "#F59E0B", amberBg: "#FFFBEB", amberBorder: "#FDE68A",
  purple:       "#8B5CF6", purpleBg:"#F5F3FF", purpleBorder:"#DDD6FE",

  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif:  Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:   Platform.select({ ios: "Avenir Next", android: "sans-serif",        default: "sans-serif" }),
    medium: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:   Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// ─── Helpers (inchangés) ──────────────────────────────────
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

// ─── Op Card (inchangé visuellement) ──────────────────────
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
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
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
  card: {
    backgroundColor: C.white, borderRadius: C.r.lg, padding: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12, shadowRadius: 14, elevation: 7,
    overflow: "hidden", minHeight: 130,
  },
  corner:   { position: "absolute", top: -16, right: -16, width: 56, height: 56, borderRadius: 28, opacity: 0.45 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  badge:    { position: "absolute", top: 9, right: 9, paddingHorizontal: 6, paddingVertical: 2, borderRadius: C.r.xs, borderWidth: 1 },
  badgeTxt: { fontSize: 7, fontWeight: "600", letterSpacing: 0.3 },
  title:    { fontSize: 13, fontWeight: "600", color: C.ink, marginBottom: 3, lineHeight: 18 },
  sub:      { fontSize: 10, fontWeight: "400", color: C.inkSoft, marginBottom: 10, lineHeight: 14 },
  arrow:    { position: "absolute", bottom: 10, right: 10, width: 22, height: 22, borderRadius: 7, justifyContent: "center", alignItems: "center" },
});

// ─── Report Row (inchangé visuellement) ───────────────────
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
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={[rr.accentBar, { backgroundColor: accent }]} />
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
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.white, borderRadius: C.r.md,
    borderWidth: 1, borderColor: C.cardBorder, overflow: "hidden",
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09, shadowRadius: 12, elevation: 5,
  },
  accentBar:{ width: 4, alignSelf: "stretch" },
  iconBox:  { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center", margin: 13, marginRight: 0 },
  title:    { fontSize: 13, fontWeight: "600", color: C.ink, marginBottom: 2 },
  sub:      { fontSize: 10, fontWeight: "400", color: C.inkSoft },
  value:    { fontSize: 12, fontWeight: "600" },
  chevron:  { width: 26, height: 26, borderRadius: 8, justifyContent: "center", alignItems: "center", margin: 13 },
});

// ─── Stat Chip v9 — valeur agrandie, fond bodyBg ──────────
function StatChip({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={sc.chip}>
      <Text style={[sc.val, { color: accent, fontFamily: C.font.medium }]}>{value}</Text>
      <Text style={[sc.lbl, { fontFamily: C.font.sans }]}>{label}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  // ✅ v9.0 : fond bodyBg (off-white) au lieu de blanc pour contraste sur fond blanc
  chip: {
    flex: 1, backgroundColor: C.white, borderRadius: C.r.md, padding: 14,
    alignItems: "center", borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  val: { fontSize: 22, fontWeight: "700", marginBottom: 3 },  // ✅ v9.0 : 18→22px
  lbl: { fontSize: 9, fontWeight: "500", color: C.inkSoft, letterSpacing: 0.5, textTransform: "uppercase" },
});

// ─── Main ─────────────────────────────────────────────────
export default function AgentDashboard() {
  const { user } = useAuth();
  const router   = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // ── États (inchangés) ────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [agencyData, setAgencyData] = useState<any>(null);
  const [stats,      setStats]      = useState({ total: 0, validated: 0, pending: 0 });

  // ── Dérivations (inchangées) ─────────────────────────────
  const COUNTRY_CURRENCY_MAP: Record<string, string> = {
    GN:"GNF", SN:"XOF", ML:"XOF", CI:"XOF", BF:"XOF", BJ:"XOF",
    TG:"XOF", NE:"XOF", GW:"XOF", FR:"EUR", DE:"EUR", BE:"EUR",
    IT:"EUR", ES:"EUR", PT:"EUR", NL:"EUR", GB:"GBP", US:"USD",
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
  const myId       = String(user?.id ?? "");

  // ── Chargement données (inchangé) ────────────────────────
  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      if (user?.agencyId) {
        const data = await api.getAgency(user.agencyId as string);
        setAgencyData(data);
      }
      const [txRes, wdRes] = await Promise.allSettled([api.getTransactions(), api.getWithdrawals()]);
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
        if (processedWdTxIds.has(String(tx.id)))               return true;
        if (String(tx.senderId ?? "") === myId)                 return true;
        return false;
      });
      setStats({
        total:     agentTxs.length,
        validated: agentTxs.filter((tx) => tx.status === "PAID"    || tx.status === "VALIDATED").length,
        pending:   agentTxs.filter((tx) => tx.status === "PENDING" || tx.status === "PROCESSING").length,
      });
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  }, [user?.agencyId, myId]);

  useFocusEffect(useCallback(() => {
    void loadData();
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
  }, [loadData]));

  // ── Initiales agent ──────────────────────────────────────
  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map((n) => (n as string)[0].toUpperCase())
    .join("")
    .substring(0, 2) || "AG";

  return (
    // ✅ v9.0 : fond blanc pur — StatusBar dark-content
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.pageBg} />

      {/* ══════════ HEADER BLANC v9.0 ══════════
          Remplace le LinearGradient bleu de v8.
          Structure : topBar (greeting + actions) + balCard (accent band + solde)
      */}
      <Animated.View style={{
        opacity:   headerAnim,
        transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
      }}>
        <View style={s.hero}>

          {/* ── Ligne du haut : greeting + boutons ── */}
          <View style={s.topBar}>
            <View style={{ flex: 1 }}>
              {/* ✅ v9.0 : pill bleu pâle → texte bleu accent (inversé vs v8 blanc sur bleu) */}
              <View style={s.pill}>
                <View style={s.pillDot} />
                <Text style={[s.pillTxt, { fontFamily: C.font.sans }]}>ESPACE GUICHET</Text>
              </View>
              {/* ✅ v9.0 : texte sombre (plus de blanc sur bleu) */}
              <Text style={[s.heroName, { fontFamily: C.font.serif }]}>
                Bonjour, {user?.firstName || "Agent"} 👋
              </Text>
              <View style={s.agencyRow}>
                <Ionicons name="storefront-outline" size={11} color={C.inkSoft} />
                <Text style={[s.agencyTxt, { fontFamily: C.font.sans }]} numberOfLines={1}>
                  {agencyName}
                </Text>
              </View>
            </View>

            {/* ✅ v9.0 : avatar initiales + boutons fond gris clair */}
            <View style={s.topActions}>
              <View style={s.avatar}>
                <Text style={[s.avatarTxt, { fontFamily: C.font.medium }]}>{initials}</Text>
              </View>
              <TouchableOpacity style={s.iconBtn} onPress={loadData}>
                <Ionicons name="refresh" size={15} color={C.inkMid} />
              </TouchableOpacity>
              <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/(tabs)/notifications")}>
                <Ionicons name="notifications-outline" size={15} color={C.inkMid} />
                {stats.pending > 0 && <View style={s.notifBadge} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Carte solde (v9.0 : bande accent 4px en haut) ── */}
          <View style={s.balCard}>
            {/* ✅ v9.0 : élément signature — bande accent bleue 4px */}
            <View style={s.accentBand} />

            <View style={s.balInner}>
              <View style={s.balTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.balLbl, { fontFamily: C.font.sans }]}>
                    solde agence · {currency.toLowerCase()}
                  </Text>
                  {/* ✅ v9.0 : balance amount 26→32px */}
                  <Text style={[s.balAmt, { fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit>
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
                  Disponible{" "}
                  <Text style={s.balFootVal}>{fmt(available, currency)} {currency}</Text>
                </Text>
                <Text style={[s.balFootLbl, { fontFamily: C.font.sans }]}>
                  Réservé{" "}
                  <Text style={[s.balFootVal, { color: C.inkSoft }]}>{fmt(reserved, currency)} {currency}</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* ══════════ BODY ══════════ */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.body, isDesktop && { maxWidth: 960, alignSelf: "center", width: "100%" }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={AGENT_BLUE} />}
      >
        {/* Stats réelles */}
        <View style={s.statsRow}>
          <StatChip label="Opérations" value={String(stats.total)}     accent={AGENT_BLUE} />
          <StatChip label="Validées"   value={String(stats.validated)} accent={C.green}    />
          <StatChip label="En attente" value={String(stats.pending)}   accent={C.amber}    />
        </View>

        {/* Opérations rapides — section label v9.0 */}
        <View style={s.secRow}>
          <View style={s.secLine} />
          <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>OPÉRATIONS RAPIDES</Text>
        </View>

        <View style={s.opsRow}>
          <OpCard title="Dépôt Client"   subtitle="Recharger un compte" icon="arrow-down-circle-outline" accent={C.green}  bg={C.greenBg}  onPress={() => router.push("/agent/deposit")} />
          <OpCard title="Retrait Client" subtitle="Payer un code"       icon="arrow-up-circle-outline"   accent={C.red}    bg={C.redBg}    onPress={() => router.push("/agent/withdraw")} />
        </View>

        <View style={[s.opsRow, { marginBottom: 28 }]}>
          <OpCard title="Envoi Cash"   subtitle="Sans compte"         icon="paper-plane-outline" accent={C.blue}   bg={C.blueBg}   onPress={() => router.push("/agent/send-cash")} badge="Nouveau" />
          <OpCard title="Clôture Jour" subtitle="Bilan & commissions" icon="calculator-outline"  accent={C.purple} bg={C.purpleBg} onPress={() => router.push("/agent/commissions")} />
        </View>

        {/* Suivi & rapports */}
        <View style={[s.secRow, { marginTop: 2 }]}>
          <View style={[s.secLine, { backgroundColor: C.blue }]} />
          <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>SUIVI & RAPPORTS</Text>
        </View>

        <ReportRow title="Journal de Caisse"  sub="Toutes les opérations du jour" icon="list-outline"        accent={C.amber}  bg={C.amberBg}  onPress={() => router.push("/agent/transactions")} />
        <ReportRow title="Mes Commissions"    sub="Gains, paliers et historique"  icon="bar-chart-outline"   accent={C.purple} bg={C.purpleBg} onPress={() => router.push("/agent/commissions")} />
        <ReportRow title="Taux du Jour"       sub="Devises & taux de change"      icon="trending-up-outline" accent={C.green}  bg={C.greenBg}  onPress={() => router.push("/(tabs)/rates")} value="1 EUR" />

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles v9.0 ──────────────────────────────────────────
const s = StyleSheet.create({

  // ✅ v9.0 : fond blanc pur
  safe: { flex: 1, backgroundColor: C.pageBg },

  // ✅ v9.0 : header blanc pur — borderRadius + ombre douce (plus de bleu)
  hero: {
    backgroundColor: C.surface,
    paddingHorizontal: 18,
    paddingTop:    Platform.OS === "android" ? 36 : 10,
    paddingBottom: 22,
    borderBottomLeftRadius:  24,
    borderBottomRightRadius: 24,
    // ombre neutre grise (remplace l'ombre bleue profonde de v8)
    shadowColor:   "#94A3B8",
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius:  20,
    elevation:     10,
  },

  // ── Top bar ──
  topBar:    { flexDirection: "row", alignItems: "center", marginBottom: 16 },

  // ✅ v9.0 : pill bleu pâle + texte accent (inversé vs blanc sur bleu)
  pill:    {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: C.accentPale, borderWidth: 1, borderColor: C.accentBorder,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
    alignSelf: "flex-start", marginBottom: 6,
  },
  pillDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.accent },
  pillTxt: { fontSize: 8, fontWeight: "700", color: C.accent, letterSpacing: 1 },

  // ✅ v9.0 : texte sombre sur fond blanc
  heroName:  { fontSize: 22, fontWeight: "700", color: C.ink, marginBottom: 3 },
  agencyRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  agencyTxt: { fontSize: 10, color: C.inkSoft, fontWeight: "500" },

  // ✅ v9.0 : avatar + boutons gris clair (remplace glassmorphism bleu)
  topActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.accentPale, borderWidth: 1, borderColor: C.accentBorder,
    justifyContent: "center", alignItems: "center",
  },
  avatarTxt: { fontSize: 11, fontWeight: "700", color: C.accent },
  iconBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#F1F5F9",
    borderWidth: 1, borderColor: C.cardBorder,
    justifyContent: "center", alignItems: "center",
  },
  notifBadge: {
    position: "absolute", top: 6, right: 6,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: C.red, borderWidth: 1.5, borderColor: C.surface,
  },

  // ── Balance card v9.0 ──
  balCard: {
    backgroundColor: C.surface,
    borderRadius: C.r.md,
    overflow: "hidden",
    borderWidth: 1, borderColor: C.cardBorder,
    // ombre neutre portée
    shadowColor: "#94A3B8",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },

  // ✅ v9.0 : ÉLÉMENT SIGNATURE — bande accent bleue 4px en haut de la balance card
  accentBand: {
    height: 4,
    backgroundColor: C.accent,
    // pas de borderRadius — accentue l'effet "trait" net
  },

  balInner:   { padding: 16 },
  balTop:     { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  balLbl:     { fontSize: 9, color: C.inkSoft, marginBottom: 4, fontWeight: "500", letterSpacing: 0.5, textTransform: "uppercase" },
  // ✅ v9.0 : balance amount 26→32px pour plus d'impact
  balAmt:     { fontSize: 32, fontWeight: "700", color: C.ink, letterSpacing: -0.5 },
  balCur:     { fontSize: 11, fontWeight: "700", color: C.accent, marginTop: 2 },
  onlinePill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.greenBg, borderWidth: 1, borderColor: C.greenBorder, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  onlineDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  onlineTxt:  { fontSize: 9, fontWeight: "600", color: C.greenDark },
  progBg:     { height: 5, backgroundColor: C.accentPale, borderRadius: 3, marginBottom: 10, overflow: "hidden" },
  progFill:   { height: 5, backgroundColor: C.accent, borderRadius: 3 },
  balFooter:  { flexDirection: "row", justifyContent: "space-between" },
  balFootLbl: { fontSize: 9, color: C.inkSoft, fontWeight: "500" },
  balFootVal: { fontWeight: "700", color: C.accent },

  // ── Body ──
  // ✅ v9.0 : ScrollView fond off-white pour que les cartes blanches ressortent
  scroll: { flex: 1, backgroundColor: C.bodyBg },
  body:   { paddingHorizontal: 16, paddingTop: 20 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },

  // ✅ v9.0 : section label — ligne courte + texte (remplace dot + texte)
  secRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  secLine: { width: 16, height: 3, borderRadius: 2, backgroundColor: C.accent },
  secLbl:  { fontSize: 10, fontWeight: "700", color: C.inkSoft, letterSpacing: 1.2 },

  opsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
});