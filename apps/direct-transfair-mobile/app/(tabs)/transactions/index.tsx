// apps/direct-transfair-mobile/app/(tabs)/transactions/index.tsx
// =========================================================
// TRANSACTIONS HISTORY v5.0 — Direct Transf'air
// Design: Thème clair · Vert #059669 · Style YMO/Wise
// =========================================================

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity, Platform, Animated,
  StatusBar, SafeAreaView, TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

// ─── Design System ──────────────────────────────────────
const C = {
  green:        "#059669",
  greenDark:    "#047857",
  greenLight:   "#F0FDF4",
  greenBorder:  "#A7F3D0",
  greenPale:    "#ECFDF5",

  heroGlass:    "rgba(255,255,255,0.14)",
  heroGlassBdr: "rgba(255,255,255,0.22)",
  heroDim:      "rgba(255,255,255,0.65)",
  heroGlow:     "rgba(255,255,255,0.08)",

  pageBg:       "#F0FDF8",
  white:        "#FFFFFF",
  cardBorder:   "#D1FAE5",

  ink:          "#0D2B1F",
  inkMid:       "#1F5C3A",
  inkSoft:      "#6B9E85",

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

  slate:        "#64748B",
  slateBg:      "#F8FAFC",
  slateBorder:  "#E2E8F0",

  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  PENDING:    { label: "En attente", color: C.amber,  bg: C.amberBg,  border: C.amberBorder,  icon: "time-outline" },
  VALIDATED:  { label: "Disponible", color: C.blue,   bg: C.blueBg,   border: C.blueBorder,   icon: "shield-checkmark-outline" },
  PAID:       { label: "Payé",       color: C.green,  bg: C.greenPale,border: C.greenBorder,  icon: "checkmark-done-circle-outline" },
  PROCESSING: { label: "Traitement", color: C.purple, bg: C.purpleBg, border: C.purpleBorder, icon: "sync-outline" },
  CANCELLED:  { label: "Annulé",     color: C.slate,  bg: C.slateBg,  border: C.slateBorder,  icon: "close-circle-outline" },
  FAILED:     { label: "Échoué",     color: C.red,    bg: C.redBg,    border: C.redBorder,    icon: "alert-circle-outline" },
};

const FILTERS = ["ALL", "PENDING", "VALIDATED", "PAID", "CANCELLED"] as const;

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

// ─── Tx Card ────────────────────────────────────────────
function TxCard({ item, userId }: { item: any; userId?: string }) {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;

  const isRefill  = item.type === "REFILL" || item.type === "AGENCY_REFILL";
  const isDeposit = item.type === "DEPOSIT";
  const isIncoming = item.beneficiaryId === userId || isDeposit || isRefill;
  const isOut     = !isIncoming;

  const accent = isIncoming ? C.green : C.red;
  const sign   = isIncoming ? "+" : "−";
  const icon   = isIncoming ? "arrow-down-circle-outline" : "paper-plane-outline";
  const bg     = isIncoming ? C.greenPale : C.redBg;
  const label  = isRefill ? "Alimentation caisse" : isDeposit ? "Dépôt agence" : isIncoming ? "Transfert reçu" : "Envoi d'argent";
  const detail = isIncoming
    ? (item.senderFirstName ? `${item.senderFirstName} ${item.senderLastName ?? ""}`.trim() : "")
    : (item.beneficiary?.fullName || item.beneficiary?.phone || "");

  const st = STATUS_MAP[item.status] ?? { label: item.status, color: C.slate, bg: C.slateBg, border: C.slateBorder, icon: "help-circle-outline" };

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 10 }}>
      <TouchableOpacity
        style={tc.card}
        onPress={() => router.push(`/(tabs)/transactions/${item.id}`)}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        {/* Barre latérale */}
        <View style={[tc.sideBar, { backgroundColor: accent }]} />

        <View style={tc.content}>
          <View style={tc.top}>
            <View style={[tc.iconBox, { backgroundColor: bg }]}>
              <Ionicons name={icon as any} size={18} color={accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[tc.label, { fontFamily: C.font.sans }]}>{label}</Text>
              {detail ? <Text style={[tc.detail, { fontFamily: C.font.sans }]} numberOfLines={1}>{detail}</Text> : null}
              <Text style={[tc.ref, { fontFamily: C.font.mono }]} numberOfLines={1}>
                {fmtDate(item.createdAt)} · {item.reference?.slice(0, 10) ?? "—"}
              </Text>
            </View>
            <View style={tc.right}>
              <Text style={[tc.amount, { color: accent, fontFamily: C.font.serif }]}>
                {sign} {fmt(toNum(item.amount), item.currency)}
              </Text>
              <Text style={[tc.currency, { fontFamily: C.font.mono }]}>{item.currency}</Text>
            </View>
          </View>

          <View style={tc.bottom}>
            <View style={[tc.statusPill, { backgroundColor: st.bg, borderColor: st.border }]}>
              <Ionicons name={st.icon as any} size={10} color={st.color} />
              <Text style={[tc.statusTxt, { color: st.color, fontFamily: C.font.sans }]}>{st.label}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const tc = StyleSheet.create({
  card:      { flexDirection: "row", backgroundColor: C.white, borderRadius: C.r.lg, overflow: "hidden", borderWidth: 1, borderColor: C.cardBorder, shadowColor: C.green, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  sideBar:   { width: 4 },
  content:   { flex: 1, padding: 14 },
  top:       { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  iconBox:   { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  label:     { fontSize: 13, fontWeight: "700", color: C.ink, marginBottom: 2 },
  detail:    { fontSize: 12, fontWeight: "600", color: C.inkMid, marginBottom: 2 },
  ref:       { fontSize: 10, color: C.inkSoft, fontWeight: "600" },
  right:     { alignItems: "flex-end" },
  amount:    { fontSize: 15, fontWeight: "800" },
  currency:  { fontSize: 9, color: C.inkSoft, fontWeight: "700", marginTop: 1 },
  bottom:    { flexDirection: "row", justifyContent: "flex-end" },
  statusPill:{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusTxt: { fontSize: 9, fontWeight: "900" },
});

// ─── Main ───────────────────────────────────────────────
export default function TransactionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "COMPANY_ADMIN";

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [filter,       setFilter]       = useState("ALL");
  const [q,            setQ]            = useState("");

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const res  = isAdmin ? await api.adminGetTransactions() : await api.getTransactions();
      const list = Array.isArray(res) ? res : [];
      setTransactions(list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { setTransactions([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [isAdmin]);

  useFocusEffect(useCallback(() => {
    fadeAnim.setValue(0);
    void load();
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
  }, [load]));

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filter !== "ALL" && tx.status !== filter) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        return (tx.reference ?? "").toLowerCase().includes(s)
          || (tx.beneficiary?.fullName ?? "").toLowerCase().includes(s)
          || (tx.beneficiary?.phone ?? "").toLowerCase().includes(s)
          || `${tx.senderFirstName ?? ""} ${tx.senderLastName ?? ""}`.toLowerCase().includes(s);
      }
      return true;
    });
  }, [transactions, filter, q]);

  const pendingCount = transactions.filter((t) => t.status === "PENDING").length;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.green} />

      {/* ── Hero ── */}
      <Animated.View style={[s.hero, {
        opacity: headerAnim,
        transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
      }]}>
        <View style={s.glow} />
        <View style={s.heroRow}>
          <View style={{ flex: 1 }}>
            <View style={s.heroPill}>
              <View style={s.heroPillDot} />
              <Text style={[s.heroPillTxt, { fontFamily: C.font.sans }]}>
                {isAdmin ? "SUPERVISION" : "CLIENT"}
              </Text>
            </View>
            <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Historique</Text>
            <Text style={[s.heroSub, { fontFamily: C.font.sans }]}>
              {filtered.length} transaction{filtered.length > 1 ? "s" : ""}
              {pendingCount > 0 ? ` · ${pendingCount} en attente` : ""}
            </Text>
          </View>
          <TouchableOpacity style={s.refreshBtn} onPress={() => { setRefreshing(true); void load(); }}>
            <Ionicons name="refresh" size={18} color={C.white} />
          </TouchableOpacity>
        </View>

        {/* Search dans le hero */}
        <View style={s.searchBox}>
          <Ionicons name="search" size={15} color={C.heroDim} />
          <TextInput
            style={[s.searchInput, { fontFamily: C.font.sans }]}
            value={q}
            onChangeText={setQ}
            placeholder="Référence, nom, téléphone…"
            placeholderTextColor="rgba(255,255,255,0.45)"
            underlineColorAndroid="transparent"
          />
          {!!q && (
            <TouchableOpacity onPress={() => setQ("")} hitSlop={8}>
              <Ionicons name="close-circle" size={15} color={C.heroDim} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* ── Filtres ── */}
      <FlatList
        horizontal
        data={[...FILTERS]}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filters}
        style={{ maxHeight: 52, backgroundColor: C.pageBg }}
        keyExtractor={(f) => f}
        renderItem={({ item: f }) => {
          const active = filter === f;
          const st     = f !== "ALL" ? STATUS_MAP[f] : null;
          const count  = f === "ALL" ? transactions.length : transactions.filter((t) => t.status === f).length;
          return (
            <TouchableOpacity
              style={[s.filterPill, active && { backgroundColor: st ? st.bg : C.greenPale, borderColor: st ? st.border : C.greenBorder }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[s.filterTxt, { fontFamily: C.font.sans }, active && { color: st?.color ?? C.green, fontWeight: "800" }]}>
                {f === "ALL" ? "Toutes" : st?.label ?? f}
              </Text>
              <View style={[s.filterCount, { backgroundColor: active ? (st?.color ?? C.green) + "20" : C.greenLight }]}>
                <Text style={[s.filterCountTxt, { color: active ? (st?.color ?? C.green) : C.inkSoft, fontFamily: C.font.mono }]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={C.green} size="large" />
        </View>
      ) : (
        <Animated.FlatList
          style={{ opacity: fadeAnim, flex: 1 }}
          data={filtered}
          keyExtractor={(item) => item.id?.toString()}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={C.green} />}
          renderItem={({ item }) => <TxCard item={item} userId={user?.id} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIconBox}>
                <Ionicons name="document-text-outline" size={34} color={C.inkSoft} />
              </View>
              <Text style={[s.emptyTitle, { fontFamily: C.font.serif }]}>
                {q ? "Aucun résultat" : "Aucune transaction"}
              </Text>
              <Text style={[s.emptySub, { fontFamily: C.font.sans }]}>
                {q ? "Modifiez votre recherche" : "Vos transactions apparaîtront ici"}
              </Text>
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

  hero: {
    backgroundColor: C.green,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 48 : 16,
    paddingBottom: 20, overflow: "hidden",
  },
  glow:      { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: C.heroGlow, top: -60, right: -40 },
  heroRow:   { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  heroPill:  { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, borderRadius: C.r.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 6 },
  heroPillDot: { width: 4, height: 4, borderRadius: C.r.pill, backgroundColor: "#A5F3FC" },
  heroPillTxt: { color: "#E8FFE8", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  heroTitle: { color: C.white, fontSize: 24, fontWeight: "700", marginBottom: 2 },
  heroSub:   { color: C.heroDim, fontSize: 11, fontWeight: "600" },
  refreshBtn:{ width: 38, height: 38, borderRadius: C.r.sm, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center", marginTop: 4 },

  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
    borderRadius: C.r.md, paddingHorizontal: 14, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.white, fontWeight: "600" },

  filters:     { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: "center" },
  filterPill:  { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: C.r.pill, backgroundColor: C.white, borderWidth: 1, borderColor: C.cardBorder },
  filterTxt:   { fontSize: 12, fontWeight: "700", color: C.inkSoft },
  filterCount: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: C.r.pill },
  filterCountTxt: { fontSize: 10, fontWeight: "900" },

  list:  { paddingHorizontal: 16, paddingTop: 12 },
  empty: { alignItems: "center", paddingVertical: 50, gap: 8 },
  emptyIconBox: { width: 68, height: 68, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.cardBorder, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle:   { color: C.ink, fontSize: 17, fontWeight: "700" },
  emptySub:     { color: C.inkSoft, fontSize: 12, fontWeight: "600", textAlign: "center" },
});