// apps/direct-transfair-mobile/app/(tabs)/admin/transactions-history.tsx
// =========================================================
// SUPER ADMIN — HISTORIQUE TRANSACTIONS v1.0
// ✅ Version parallèle (ne touche PAS transactions/index.tsx)
// ✅ Montant affiché positif pour les transactions reçues
// ✅ Badge "Reçu" au lieu de "Payé" pour les entrées
// ✅ Thème violet/bleu SuperAdmin — cohérent avec le dashboard
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

// ─── Design Tokens ────────────────────────────────────────
const T = {
  blue:     "#1956F0",
  blueDark: "#1240D6",
  blueLt:   "#EEF2FF",
  blueMd:   "#C7D5FF",

  heroA: "#5B5BD6",
  heroB: "#4545C2",
  heroC: "#3232A8",

  pageBg:   "#F0F4FF",
  surface:  "#FFFFFF",
  border:   "#E2E8F0",
  borderLt: "#F1F5F9",

  ink:      "#0F172A",
  inkMid:   "#374151",
  inkSub:   "#6B7280",
  inkMuted: "#9CA3AF",

  green:    "#16A34A",
  greenLt:  "#DCFCE7",
  greenBdr: "#A7F3D0",
  red:      "#DC2626",
  redLt:    "#FEE2E2",
  amber:    "#D97706",
  amberLt:  "#FEF3C7",
  purple:   "#7C3AED",
  purpleLt: "#EDE9FE",
  teal:     "#0F766E",
  tealLt:   "#CCFBF1",

  white: "#FFFFFF",

  radius: { sm: 8, md: 12, lg: 16, xl: 20 },

  font: {
    display:  Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:     Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    subtitle: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light",     default: "Trebuchet MS" }),
    mono:     Platform.select({ ios: "Trebuchet MS", android: "monospace",             default: "Trebuchet MS" }),
  },

  shadow: {
    soft: {
      shadowColor: "#1240D6",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
  },
};

// ─── Status config ────────────────────────────────────────
// ✅ "PAID" → label "Reçu" pour les transactions entrantes
const STATUS_CONFIG: Record<string, {
  label: string;
  labelIncoming: string;   // ✅ label spécifique si transaction reçue
  color: string;
  bg: string;
  bdr: string;
  icon: string;
}> = {
  PENDING:    { label: "En attente",  labelIncoming: "En attente",  color: T.amber,   bg: T.amberLt,  bdr: "#FCD34D",  icon: "time-outline" },
  VALIDATED:  { label: "Disponible",  labelIncoming: "Disponible",  color: T.blue,    bg: T.blueLt,   bdr: T.blueMd,   icon: "shield-checkmark-outline" },
  PAID:       { label: "Payé",        labelIncoming: "Reçu",        color: T.green,   bg: T.greenLt,  bdr: T.greenBdr, icon: "checkmark-done-circle-outline" },
  PROCESSING: { label: "Traitement",  labelIncoming: "Traitement",  color: T.purple,  bg: T.purpleLt, bdr: "#C4B5FD",  icon: "sync-outline" },
  CANCELLED:  { label: "Annulé",      labelIncoming: "Annulé",      color: T.inkSub,  bg: "#F1F5F9",  bdr: T.border,   icon: "close-circle-outline" },
  FAILED:     { label: "Échoué",      labelIncoming: "Échoué",      color: T.red,     bg: T.redLt,    bdr: "#FCA5A5",  icon: "alert-circle-outline" },
  REFUNDED:   { label: "Remboursé",   labelIncoming: "Remboursé",   color: T.teal,    bg: T.tealLt,   bdr: "#5EEAD4",  icon: "return-down-back-outline" },
  ON_HOLD:    { label: "Bloqué",      labelIncoming: "Bloqué",      color: T.red,     bg: T.redLt,    bdr: "#FCA5A5",  icon: "ban-outline" },
};

const FILTERS = ["ALL", "PENDING", "VALIDATED", "PAID", "CANCELLED", "FAILED"] as const;

// ─── Helpers ──────────────────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(n);
  } catch { return n.toFixed(d); }
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    if (now.getTime() - d.getTime() < 86400000) {
      return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch { return "—"; }
}

// ─── Détermine si une transaction est "entrante" ──────────
// Pour le SuperAdmin : une transaction est "reçue" si c'est
// un DEPOSIT, REFUND, LOYALTY_CREDIT ou AGENCY_REFILL
function isIncomingTx(tx: any): boolean {
  const type = String(tx.type ?? "").toUpperCase();
  return (
    type === "DEPOSIT" ||
    type === "REFUND" ||
    type === "LOYALTY_CREDIT" ||
    type === "AGENCY_REFILL"
  );
}

// ─── Tx Card ──────────────────────────────────────────────
function TxCard({ item }: { item: any }) {
  const scale    = useRef(new Animated.Value(1)).current;
  const incoming = isIncomingTx(item);
  const amount   = toNum(item.amount);
  const fees     = toNum(item.fees ?? 0);

  // ✅ Signe : positif pour entrées, négatif pour sorties
  const sign       = incoming ? "+" : "−";
  const amountColor = incoming ? T.green : T.red;

  const st = STATUS_CONFIG[item.status] ?? {
    label: item.status, labelIncoming: item.status,
    color: T.inkMuted, bg: "#F1F5F9", bdr: T.border, icon: "help-circle-outline",
  };

  // ✅ Badge : "Reçu" si transaction entrante + statut PAID
  const badgeLabel = incoming ? st.labelIncoming : st.label;

  const typeIcon = incoming ? "arrow-down-circle-outline" : "paper-plane-outline";
  const typeBg   = incoming ? T.greenLt : T.redLt;
  const typeColor = incoming ? T.green   : T.red;

  const senderName = item.sender
    ? `${item.sender.firstName ?? ""} ${item.sender.lastName ?? ""}`.trim()
    : "—";

  const clientName = item.client?.name ?? "";

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={tc.card}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
      >
        {/* Barre latérale colorée */}
        <View style={[tc.sideBar, { backgroundColor: amountColor }]} />

        <View style={tc.body}>
          {/* Ligne 1 : icône + infos + montant */}
          <View style={tc.topRow}>
            <View style={[tc.iconBox, { backgroundColor: typeBg }]}>
              <Ionicons name={typeIcon as any} size={17} color={typeColor} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[tc.ref, { fontFamily: T.font.mono }]} numberOfLines={1}>
                {item.reference ?? "—"}
              </Text>
              <Text style={[tc.date, { fontFamily: T.font.sans }]}>
                {fmtDate(item.createdAt)}
                {clientName ? `  ·  ${clientName}` : ""}
              </Text>
            </View>

            <View style={tc.amountBlock}>
              {/* ✅ Montant toujours positif pour les entrées */}
              <Text style={[tc.amount, { color: amountColor, fontFamily: T.font.display }]}>
                {sign} {fmt(amount, item.currency)}
              </Text>
              <Text style={[tc.currency, { fontFamily: T.font.mono }]}>{item.currency}</Text>
            </View>
          </View>

          {/* Ligne 2 : expéditeur + badge statut */}
          <View style={tc.bottomRow}>
            <View style={tc.senderRow}>
              <Ionicons name="person-outline" size={11} color={T.inkMuted} />
              <Text style={[tc.senderTxt, { fontFamily: T.font.sans }]} numberOfLines={1}>
                {senderName}
              </Text>
              {fees > 0 && (
                <>
                  <Text style={tc.sep}>·</Text>
                  <Text style={[tc.feesTxt, { fontFamily: T.font.mono }]}>
                    Frais {fmt(fees, item.currency)}
                  </Text>
                </>
              )}
            </View>

            {/* ✅ Badge avec le bon label selon direction */}
            <View style={[tc.badge, { backgroundColor: st.bg, borderColor: st.bdr }]}>
              <Ionicons name={st.icon as any} size={10} color={st.color} />
              <Text style={[tc.badgeTxt, { color: st.color, fontFamily: T.font.sans }]}>
                {badgeLabel}
              </Text>
            </View>
          </View>

          {/* Conversion multi-devises si applicable */}
          {item.targetCurrency && item.targetCurrency !== item.currency && (
            <View style={tc.convRow}>
              <Ionicons name="swap-horizontal-outline" size={11} color={T.inkMuted} />
              <Text style={[tc.convTxt, { fontFamily: T.font.mono }]}>
                {fmt(toNum(item.receivedAmount), item.targetCurrency)} {item.targetCurrency}
              </Text>
              <Text style={[tc.convRate, { fontFamily: T.font.sans }]}>
                taux {item.exchangeRate?.toFixed(4) ?? "—"}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const tc = StyleSheet.create({
  card: {
    flexDirection: "row", backgroundColor: T.surface,
    borderRadius: T.radius.lg, marginBottom: 10,
    borderWidth: 1, borderColor: T.border,
    overflow: "hidden", ...T.shadow.soft,
  },
  sideBar: { width: 4 },
  body:    { flex: 1, padding: 13, gap: 8 },
  topRow:  { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  ref:     { fontSize: 12, fontWeight: "800", color: T.ink, marginBottom: 2 },
  date:    { fontSize: 10, color: T.inkMuted, fontWeight: "600" },
  amountBlock: { alignItems: "flex-end", paddingTop: 2 },
  amount:  { fontSize: 15, fontWeight: "800" },
  currency:{ fontSize: 9, color: T.inkSub, fontWeight: "700", marginTop: 1 },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 0 },
  senderTxt: { fontSize: 10, color: T.inkSub, fontWeight: "600", flexShrink: 1 },
  sep:      { fontSize: 10, color: T.inkMuted },
  feesTxt:  { fontSize: 9, color: T.inkMuted, fontWeight: "700" },
  badge:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  badgeTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
  convRow:  { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.borderLt, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
  convTxt:  { fontSize: 10, fontWeight: "800", color: T.blue },
  convRate: { fontSize: 9, color: T.inkMuted, fontWeight: "600" },
});

// ─── Hero ─────────────────────────────────────────────────
const HERO_BR = 28;

function TxHero({
  anim, total, pending, onBack, onRefresh,
}: {
  anim: Animated.Value;
  total: number;
  pending: number;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const sbH = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
  return (
    <Animated.View style={[
      hS.outer,
      {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
      },
    ]}>
      <View style={[hS.gradient, { paddingTop: sbH + 10 }]}>
        <View style={hS.deco1} />
        <View style={hS.deco2} />

        <View style={hS.row}>
          <TouchableOpacity style={hS.backBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={18} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={hS.badge}>
              <View style={hS.badgeDot} />
              <Text style={[hS.badgeTxt, { fontFamily: T.font.sans }]}>SUPER ADMIN</Text>
            </View>
            <Text style={[hS.title, { fontFamily: T.font.display }]}>Historique</Text>
            <Text style={[hS.sub, { fontFamily: T.font.subtitle }]}>
              {total} transaction{total > 1 ? "s" : ""}
              {pending > 0 ? `  ·  ${pending} en attente` : ""}
            </Text>
          </View>
          <TouchableOpacity style={hS.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={17} color={T.white} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={hS.cornerL} />
      <View style={hS.cornerR} />
    </Animated.View>
  );
}

const hS = StyleSheet.create({
  outer: {
    zIndex: 10,
    shadowColor: "#2E2E9A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 16,
  },
  gradient: {
    backgroundColor: T.heroA,
    borderBottomLeftRadius: HERO_BR,
    borderBottomRightRadius: HERO_BR,
    overflow: "hidden",
    paddingBottom: 22,
  },
  deco1: {
    position: "absolute", width: 160, height: 160, borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.06)", top: -45, right: -30,
  },
  deco2: {
    position: "absolute", width: 70, height: 70, borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.04)", bottom: 10, left: 10,
  },
  row: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 20, gap: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.20)",
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: "flex-start", marginBottom: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  badgeDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: "#4ADE80" },
  badgeTxt: { color: "rgba(255,255,255,0.92)", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: T.white, fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  sub:   { color: "rgba(255,255,255,0.60)", fontSize: 10, marginTop: 1 },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.20)",
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  cornerL: {
    position: "absolute", bottom: 0, left: 0,
    width: HERO_BR, height: HERO_BR,
    backgroundColor: T.pageBg, borderTopRightRadius: HERO_BR,
  },
  cornerR: {
    position: "absolute", bottom: 0, right: 0,
    width: HERO_BR, height: HERO_BR,
    backgroundColor: T.pageBg, borderTopLeftRadius: HERO_BR,
  },
});

// ─── Section Header ───────────────────────────────────────
function SH({ dot, label }: { dot: string; label: string }) {
  return (
    <View style={shS.row}>
      <View style={[shS.dot, { backgroundColor: dot }]} />
      <Text style={[shS.label, { fontFamily: T.font.sans }]}>{label}</Text>
    </View>
  );
}
const shS = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  dot:   { width: 6, height: 6, borderRadius: 99 },
  label: { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.6 },
});

// ─── Main Screen ──────────────────────────────────────────
export default function SuperAdminTransactionsHistory() {
  const router   = useRouter();
  const { user } = useAuth();

  const [transactions,  setTransactions]  = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [filter,        setFilter]        = useState("ALL");
  const [q,             setQ]             = useState("");

  const heroAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    try {
      const res  = await api.adminGetTransactions();
      const list = Array.isArray(res) ? res : [];
      setTransactions(
        list.sort((a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { setTransactions([]); }
    finally {
      if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fadeAnim.setValue(0);
    heroAnim.setValue(0);
    void load("init");
    Animated.spring(heroAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
    return () => {};
  }, [load]));

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filter !== "ALL" && tx.status !== filter) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        return (
          (tx.reference ?? "").toLowerCase().includes(s) ||
          `${tx.sender?.firstName ?? ""} ${tx.sender?.lastName ?? ""}`.toLowerCase().includes(s) ||
          (tx.client?.name ?? "").toLowerCase().includes(s) ||
          (tx.currency ?? "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [transactions, filter, q]);

  const pendingCount = transactions.filter((t) => t.status === "PENDING").length;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={T.heroA} barStyle="light-content" />

      <TxHero
        anim={heroAnim}
        total={filtered.length}
        pending={pendingCount}
        onBack={() => router.back()}
        onRefresh={() => void load("refresh")}
      />

      {/* Search */}
      <View style={s.searchBox}>
        <Ionicons name="search" size={15} color={T.inkMuted} />
        <TextInput
          style={[s.searchInput, { fontFamily: T.font.sans }]}
          value={q}
          onChangeText={setQ}
          placeholder="Référence, nom, société, devise..."
          placeholderTextColor={T.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!!q && (
          <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn}>
            <Ionicons name="close" size={12} color={T.inkMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres */}
      <FlatList
        horizontal
        data={[...FILTERS]}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filtersList}
        style={s.filtersWrap}
        keyExtractor={(f) => f}
        renderItem={({ item: f }) => {
          const isActive = filter === f;
          const st = f !== "ALL" ? STATUS_CONFIG[f] : null;
          const count = f === "ALL"
            ? transactions.length
            : transactions.filter((t) => t.status === f).length;
          return (
            <TouchableOpacity
              style={[
                s.filterPill,
                isActive && {
                  backgroundColor: st?.bg ?? T.blueLt,
                  borderColor: st?.bdr ?? T.blueMd,
                },
              ]}
              onPress={() => setFilter(f)}
            >
              <Text style={[
                s.filterTxt,
                { fontFamily: T.font.sans },
                isActive && { color: st?.color ?? T.blue, fontWeight: "800" },
              ]}>
                {f === "ALL" ? "Toutes" : (st?.label ?? f)}
              </Text>
              <View style={[s.filterCount, {
                backgroundColor: isActive
                  ? (st?.color ?? T.blue) + "20"
                  : T.borderLt,
              }]}>
                <Text style={[s.filterCountTxt, {
                  color: isActive ? (st?.color ?? T.blue) : T.inkMuted,
                  fontFamily: T.font.mono,
                }]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={T.blue} size="large" />
        </View>
      ) : (
        <Animated.FlatList
          style={{ opacity: fadeAnim, flex: 1 }}
          data={filtered}
          keyExtractor={(item) => item.id?.toString()}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load("refresh")}
              tintColor={T.blue}
            />
          }
          ListHeaderComponent={
            <SH dot={T.blue} label={`RÉSULTATS · ${filtered.length}`} />
          }
          renderItem={({ item }) => <TxCard item={item} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: T.blueLt }]}>
                <Ionicons name="document-text-outline" size={28} color={T.blue} />
              </View>
              <Text style={[s.emptyTitle, { fontFamily: T.font.display }]}>
                {q ? "Aucun résultat" : "Aucune transaction"}
              </Text>
              <Text style={[s.emptySub, { fontFamily: T.font.subtitle }]}>
                {q ? "Modifiez votre recherche" : "Les transactions apparaîtront ici"}
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
  safe:   { flex: 1, backgroundColor: T.pageBg },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },

  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface, borderRadius: T.radius.md,
    marginHorizontal: 18, marginTop: 14, marginBottom: 0,
    paddingHorizontal: 13, height: 46,
    borderWidth: 1, borderColor: T.border, gap: 8,
    ...T.shadow.soft,
  },
  searchInput: { flex: 1, fontSize: 13, color: T.ink },
  clearBtn: {
    width: 22, height: 22, borderRadius: 7,
    backgroundColor: T.borderLt, justifyContent: "center", alignItems: "center",
  },

  filtersWrap:  { maxHeight: 52, backgroundColor: T.pageBg },
  filtersList:  { paddingHorizontal: 18, paddingVertical: 10, gap: 8, alignItems: "center" },
  filterPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: T.radius.md,
    backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border,
  },
  filterTxt:      { fontSize: 11, fontWeight: "700", color: T.inkSub },
  filterCount:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, minWidth: 18, alignItems: "center" },
  filterCountTxt: { fontSize: 10, fontWeight: "900" },

  list:       { paddingHorizontal: 18, paddingTop: 4 },
  empty:      { alignItems: "center", paddingVertical: 44, gap: 8 },
  emptyIcon:  { width: 64, height: 64, borderRadius: 18, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.blueMd },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: T.ink },
  emptySub:   { fontSize: 12, color: T.inkMuted, textAlign: "center" },
});