// apps/direct-transfair-mobile/app/agent/transactions.tsx
// =========================================================
// AGENT TRANSACTIONS v5.0 — Direct Transf'air
// Design: Thème clair · Violet #6C47FF · Ultra-moderne
// ✅ Historique : Envois + Retraits clients
// ✅ Montant converti devise cible, commissions
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity, SafeAreaView, StatusBar, Platform, Animated,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import type { Transaction } from "../../services/types";

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

  ink:          "#12082E",
  inkMid:       "#4B3F72",
  inkSoft:      "#8B80A8",

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

  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  PENDING:   { color: C.amber,  bg: C.amberBg,  border: C.amberBorder,  icon: "time-outline",                   label: "En attente" },
  VALIDATED: { color: C.blue,   bg: C.blueBg,   border: C.blueBorder,   icon: "checkmark-circle-outline",       label: "Validé" },
  PAID:      { color: C.green,  bg: C.greenBg,  border: C.greenBorder,  icon: "checkmark-done-circle-outline",  label: "Payé" },
  CANCELLED: { color: C.inkSoft,bg: "#F3F4F6",  border: "#E5E7EB",      icon: "close-circle-outline",           label: "Annulé" },
  FAILED:    { color: C.red,    bg: C.redBg,    border: C.redBorder,    icon: "alert-circle-outline",           label: "Échoué" },
};

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}
function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}
function fmtDate(iso: string): string {
  const d = new Date(iso), now = new Date();
  if (now.getTime() - d.getTime() < 86400000) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ─── Stat Card ──────────────────────────────────────────
function StatCard({ icon, label, value, accent, bg }: { icon: string; label: string; value: string; accent: string; bg: string }) {
  return (
    <View style={[sc.card, { borderColor: `${accent}30` }]}>
      <View style={[sc.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={16} color={accent} />
      </View>
      <Text style={[sc.value, { color: accent, fontFamily: C.font.mono }]}>{value}</Text>
      <Text style={[sc.label, { fontFamily: C.font.sans }]}>{label}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card:    { flex: 1, backgroundColor: C.white, borderRadius: C.r.md, padding: 12, alignItems: "center", borderWidth: 1, shadowColor: C.violet, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  iconBox: { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  value:   { fontSize: 18, fontWeight: "900", marginBottom: 2 },
  label:   { fontSize: 9, fontWeight: "800", color: C.inkSoft, letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center" },
});

// ─── Tx Card ────────────────────────────────────────────
function TxCard({ item, userId }: { item: Transaction; userId?: string }) {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;
  const tx = item as any;
  const withdrawal  = tx.withdrawal  as { processedById?: string } | undefined;
  const beneficiary = tx.beneficiary as { fullName?: string } | undefined;
  const sender      = tx.sender      as { firstName?: string; lastName?: string } | undefined;

  const myId           = String(userId ?? "N/A");
  const isMyWithdrawal = withdrawal?.processedById ? String(withdrawal.processedById) === myId : false;

  let finalAmount   = toNum(tx.amount);
  let finalCurrency = tx.currency ?? "XOF";
  if (isMyWithdrawal && toNum(tx.receivedAmount) > 0) {
    finalAmount   = toNum(tx.receivedAmount);
    finalCurrency = tx.targetCurrency ?? "GNF";
  }

  const isWithdrawal = isMyWithdrawal;
  const accent       = isWithdrawal ? C.green  : C.violet;
  const bg           = isWithdrawal ? C.greenBg : C.violetLight;
  const icon         = isWithdrawal ? "arrow-down-circle-outline" : "paper-plane-outline";
  const label        = isWithdrawal ? "Retrait Client" : "Envoi d'argent";
  const subLabel     = isWithdrawal
    ? `${sender?.firstName ?? ""} ${sender?.lastName ?? ""}`.trim() || "Client"
    : beneficiary?.fullName || "Bénéficiaire";

  const statusCfg = STATUS_CONFIG[tx.status] ?? { color: C.inkSoft, bg: "#F3F4F6", border: "#E5E7EB", icon: "help-circle-outline", label: tx.status };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={tc.card}
        onPress={() => router.push({ pathname: "/(tabs)/transactions/[id]", params: { id: item.id } })}
        activeOpacity={1}
        onPressIn={()  => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30 }).start()}
      >
        {/* Barre latérale colorée */}
        <View style={[tc.sideBar, { backgroundColor: accent }]} />

        <View style={tc.content}>
          <View style={tc.topRow}>
            <View style={[tc.iconBox, { backgroundColor: bg }]}>
              <Ionicons name={icon as any} size={17} color={accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[tc.label, { fontFamily: C.font.sans }]}>{label}</Text>
              <Text style={[tc.subLabel, { fontFamily: C.font.sans }]} numberOfLines={1}>{subLabel}</Text>
            </View>
            <View style={tc.right}>
              <Text style={[tc.amount, { color: accent, fontFamily: C.font.serif }]}>
                {isWithdrawal ? "+" : "−"} {fmt(finalAmount, finalCurrency)}
              </Text>
              <Text style={[tc.currency, { color: accent, fontFamily: C.font.mono }]}>{finalCurrency}</Text>
            </View>
          </View>

          <View style={tc.bottomRow}>
            <View style={tc.dateRow}>
              <Ionicons name="time-outline" size={11} color={C.inkSoft} />
              <Text style={[tc.date, { fontFamily: C.font.sans }]}>{fmtDate(item.createdAt)}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {isWithdrawal && (
                <View style={tc.commTag}>
                  <Ionicons name="checkmark-circle" size={10} color={C.green} />
                  <Text style={[tc.commTxt, { fontFamily: C.font.sans }]}>Comm.</Text>
                </View>
              )}
              <View style={[tc.statusPill, { backgroundColor: statusCfg.bg, borderColor: statusCfg.border }]}>
                <Ionicons name={statusCfg.icon as any} size={10} color={statusCfg.color} />
                <Text style={[tc.statusTxt, { color: statusCfg.color, fontFamily: C.font.sans }]}>{statusCfg.label}</Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const tc = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: C.white, borderRadius: C.r.lg,
    marginBottom: 10, borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.violet, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    overflow: "hidden",
  },
  sideBar:   { width: 4 },
  content:   { flex: 1, padding: 14 },
  topRow:    { flexDirection: "row", alignItems: "flex-start", gap: 11, marginBottom: 10 },
  iconBox:   { width: 36, height: 36, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  label:     { color: C.ink, fontSize: 13, fontWeight: "700", marginBottom: 2 },
  subLabel:  { color: C.inkSoft, fontSize: 10, fontWeight: "600" },
  right:     { alignItems: "flex-end" },
  amount:    { fontSize: 15, fontWeight: "800" },
  currency:  { fontSize: 9, fontWeight: "900", marginTop: 1 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateRow:   { flexDirection: "row", alignItems: "center", gap: 4 },
  date:      { color: C.inkSoft, fontSize: 10, fontWeight: "600" },
  commTag:   { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.greenBg, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: C.greenBorder },
  commTxt:   { color: C.greenDark, fontSize: 9, fontWeight: "800" },
  statusPill:{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusTxt: { fontSize: 9, fontWeight: "900" },
});

// ─── Main ───────────────────────────────────────────────
export default function AgentHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadTransactions = useCallback(async () => {
    try {
      if (!user?.id) { setTransactions([]); setLoading(false); setRefreshing(false); return; }
      const data = await api.getTransactions();
      setTransactions(data);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { setTransactions([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { fadeAnim.setValue(0); void loadTransactions(); }, [loadTransactions]));
  const onRefresh = () => { setRefreshing(true); void loadTransactions(); };

  const myTxs = transactions.filter((tx) => {
    const t = tx as any, myId = String(user?.id ?? "N/A");
    return (t.withdrawal?.processedById ? String(t.withdrawal.processedById) === myId : false) || String(t.senderId ?? "") === myId;
  });

  const withdrawalCount = myTxs.filter((tx) => (tx as any).withdrawal?.processedById === String(user?.id)).length;
  const sendCount       = myTxs.length - withdrawalCount;

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
            <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Historique</Text>
          </View>
          <TouchableOpacity style={s.backBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={18} color={C.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Mini stats */}
      {!loading && myTxs.length > 0 && (
        <View style={s.statsRow}>
          <StatCard icon="list-outline"         label="Total"    value={String(myTxs.length)}     accent={C.violet} bg={C.violetLight} />
          <StatCard icon="arrow-down-circle-outline" label="Retraits" value={String(withdrawalCount)} accent={C.green}  bg={C.greenBg} />
          <StatCard icon="paper-plane-outline"  label="Envois"   value={String(sendCount)}         accent={C.blue}   bg={C.blueBg} />
        </View>
      )}

      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={C.violet} size="large" />
        </View>
      ) : (
        <Animated.FlatList
          style={{ opacity: fadeAnim }}
          data={myTxs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.violet} />}
          renderItem={({ item }) => <TxCard item={item} userId={user?.id} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIconBox}>
                <Ionicons name="time-outline" size={34} color={C.inkSoft} />
              </View>
              <Text style={[s.emptyTitle, { fontFamily: C.font.serif }]}>Aucune opération</Text>
              <Text style={[s.emptySub,   { fontFamily: C.font.sans  }]}>Les retraits validés et envois apparaîtront ici</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 80 }} />}
        />
      )}
    </SafeAreaView>
  );
}

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

  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingTop: 16, marginBottom: 4 },

  list:  { paddingHorizontal: 18, paddingTop: 14 },
  empty: { alignItems: "center", paddingVertical: 50, gap: 10 },
  emptyIconBox: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.cardBorder,
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  emptyTitle: { color: C.ink, fontSize: 17, fontWeight: "700" },
  emptySub:   { color: C.inkSoft, fontSize: 12, fontWeight: "600", textAlign: "center", paddingHorizontal: 30 },
});