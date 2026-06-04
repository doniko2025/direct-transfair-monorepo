// apps/direct-transfair-mobile/app/(tabs)/transactions/index.tsx
// =========================================================
// TRANSACTIONS HISTORY v6.2 — Direct Transf'air
// ✅ v6.1 : AGENT : retraits validés récupérés via /withdrawals
// ✅ FIX v6.2 : displayAmount / displayCurrency pour les entrants
//    AVANT : le DESTINATAIRE voyait "15 EUR" (devise expéditeur)
//    APRÈS  : le DESTINATAIRE voit "+9 839 XOF" (montant reçu réel)
//    Règle  : si isIncoming ET conversion (targetCurrency ≠ currency)
//             ET receivedAmount > 0 → afficher receivedAmount / targetCurrency
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

// ─── Design System ───────────────────────────────────────
const C = {
  green:       "#059669", greenDark: "#047857", greenLight: "#F0FDF4",
  greenBorder: "#A7F3D0", greenPale:  "#ECFDF5",
  heroGlass:   "rgba(255,255,255,0.14)", heroGlassBdr: "rgba(255,255,255,0.22)",
  heroDim:     "rgba(255,255,255,0.65)", heroGlow: "rgba(255,255,255,0.08)",
  pageBg:      "#F0FDF8", white: "#FFFFFF", cardBorder: "#D1FAE5",
  ink:         "#0D2B1F", inkMid: "#1F5C3A", inkSoft: "#6B9E85",
  red:         "#EF4444", redBg: "#FEF2F2", redBorder: "#FECACA",
  blue:        "#3B82F6", blueBg: "#EFF6FF", blueBorder: "#BFDBFE",
  amber:       "#F59E0B", amberBg: "#FFFBEB", amberBorder: "#FDE68A",
  purple:      "#8B5CF6", purpleBg: "#F5F3FF", purpleBorder: "#DDD6FE",
  slate:       "#64748B", slateBg: "#F8FAFC", slateBorder: "#E2E8F0",
  violet:      "#7C3AED", violetBg: "#EDE9FE", violetBorder: "#C4B5FD",
  orange:      "#EA580C", orangeBg: "#FFF7ED", orangeBorder: "#FDBA74",
  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia",     android: "serif",           default: "serif"      }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium",default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",        default: "monospace"  }),
  },
};

// ─── Config statuts ──────────────────────────────────────
const STATUS_MAP: Record<string, {
  label: string; labelIncoming: string;
  color: string; bg: string; border: string; icon: string;
}> = {
  PENDING:    { label: "En attente", labelIncoming: "En attente", color: C.amber,  bg: C.amberBg,  border: C.amberBorder,  icon: "time-outline" },
  VALIDATED:  { label: "Disponible", labelIncoming: "Disponible", color: C.blue,   bg: C.blueBg,   border: C.blueBorder,   icon: "shield-checkmark-outline" },
  PAID:       { label: "Payé",       labelIncoming: "Reçu",       color: C.green,  bg: C.greenPale,border: C.greenBorder,  icon: "checkmark-done-circle-outline" },
  PROCESSING: { label: "Traitement", labelIncoming: "Traitement", color: C.purple, bg: C.purpleBg, border: C.purpleBorder, icon: "sync-outline" },
  CANCELLED:  { label: "Annulé",     labelIncoming: "Annulé",     color: C.slate,  bg: C.slateBg,  border: C.slateBorder,  icon: "close-circle-outline" },
  FAILED:     { label: "Échoué",     labelIncoming: "Échoué",     color: C.red,    bg: C.redBg,    border: C.redBorder,    icon: "alert-circle-outline" },
  REFUNDED:   { label: "Remboursé",  labelIncoming: "Remboursé",  color: C.violet, bg: C.violetBg, border: C.violetBorder, icon: "return-down-back-outline" },
};

const FILTERS = ["ALL", "PENDING", "VALIDATED", "PAID", "CANCELLED"] as const;

// ─── Helpers ─────────────────────────────────────────────
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
  if (now.getTime() - d.getTime() < 86400000)
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// =========================================================
// LOGIQUE DIRECTION — tous rôles
// =========================================================
function resolveDirection(tx: any, userId?: string, role?: string): {
  isIncoming: boolean;
  label: string; icon: string; iconBg: string; iconColor: string;
} {
  const type      = String(tx.type ?? "").toUpperCase();
  const isB2B     = type === "SERVICE_PAYMENT";
  const isRefill  = type === "AGENCY_REFILL" || type === "REFILL";
  const isDeposit = type === "DEPOSIT" || type === "TOP_UP";
  const isRefund  = type === "REFUND" || tx.status === "REFUNDED";

  switch (role) {
    case "SUPER_ADMIN": {
      const incoming = isB2B || (isRefund && tx.recipientId === userId);
      return incoming
        ? { isIncoming: true,  label: "Encaissement société",   icon: "arrow-down-circle-outline",   iconBg: C.greenPale, iconColor: C.green  }
        : { isIncoming: false, label: "Remboursement admin",     icon: "return-down-forward-outline", iconBg: C.violetBg,  iconColor: C.violet };
    }

    case "COMPANY_ADMIN": {
      const incoming = isDeposit || isRefund || tx.recipientId === userId;
      if (isRefill)
        return { isIncoming: false, label: "Recharge agence",   icon: "arrow-up-circle-outline",     iconBg: C.amberBg,   iconColor: C.amber  };
      return incoming
        ? { isIncoming: true,  label: isDeposit ? "Dépôt reçu" : isRefund ? "Remboursement reçu" : "Transfert reçu",
            icon: "arrow-down-circle-outline", iconBg: C.greenPale, iconColor: C.green  }
        : { isIncoming: false, label: "Envoi d'argent",
            icon: "paper-plane-outline",       iconBg: C.redBg,     iconColor: C.red    };
    }

    case "AGENT": {
      if (tx._agentPayout)
        return { isIncoming: false, label: "Retrait client payé",   icon: "cash-outline",                iconBg: C.greenPale, iconColor: C.green  };
      if (isRefill)
        return { isIncoming: true,  label: "Recharge caisse reçue", icon: "arrow-down-circle-outline",   iconBg: C.greenPale, iconColor: C.green  };
      if (isDeposit)
        return { isIncoming: false, label: "Dépôt vers client",     icon: "arrow-up-circle-outline",     iconBg: C.amberBg,   iconColor: C.amber  };
      return tx.senderId === userId
        ? { isIncoming: false, label: "Envoi d'argent",    icon: "paper-plane-outline",      iconBg: C.redBg,     iconColor: C.red    }
        : { isIncoming: true,  label: "Transfert reçu",    icon: "arrow-down-circle-outline",iconBg: C.greenPale, iconColor: C.green  };
    }

    default: {
      const incoming = isDeposit || tx.recipientId === userId || (tx.senderId !== userId && !tx.beneficiaryId);
      return incoming
        ? { isIncoming: true,  label: isDeposit ? "Dépôt en agence" : "Transfert reçu",
            icon: "arrow-down-circle-outline", iconBg: C.greenPale, iconColor: C.green  }
        : { isIncoming: false, label: "Envoi d'argent",
            icon: "paper-plane-outline",       iconBg: C.redBg,     iconColor: C.red    };
    }
  }
}

// ─── Tx Card ─────────────────────────────────────────────
function TxCard({ item, userId, userRole }: {
  item: any; userId?: string; userRole?: string;
}) {
  const router = useRouter();
  const scale  = useRef(new Animated.Value(1)).current;

  const dir = resolveDirection(item, userId, userRole);

  const rawSt = STATUS_MAP[item.status] ?? {
    label: item.status, labelIncoming: item.status,
    color: C.slate, bg: C.slateBg, border: C.slateBorder, icon: "help-circle-outline",
  };
  const badgeLabel = dir.isIncoming ? rawSt.labelIncoming : rawSt.label;

  // ✅ FIX v6.2 — Montant affiché pour les transactions entrantes
  // Si l'utilisateur est le DESTINATAIRE d'une conversion (EUR→XOF par ex.),
  // afficher receivedAmount (9 839 XOF) plutôt que amount (15 EUR).
  const hasConversion =
    item.targetCurrency &&
    item.targetCurrency !== item.currency &&
    toNum(item.receivedAmount) > 0;
  const displayAmount   = dir.isIncoming && hasConversion
    ? toNum(item.receivedAmount)
    : toNum(item.amount);
  const displayCurrency: string = dir.isIncoming && hasConversion
    ? (item.targetCurrency as string)
    : (item.currency as string);

  const counterpart = dir.isIncoming
    ? (item.sender?.firstName
        ? `${item.sender.firstName} ${item.sender.lastName ?? ""}`.trim()
        : item.senderFirstName
          ? `${item.senderFirstName} ${item.senderLastName ?? ""}`.trim()
          : "")
    : (item.beneficiary?.fullName ?? item.beneficiary?.phone ?? "");

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 10 }}>
      <TouchableOpacity
        style={tc.card}
        onPress={() => router.push(`/(tabs)/transactions/${item.id}`)}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={[tc.sideBar, { backgroundColor: dir.isIncoming ? C.green : C.red }]} />
        <View style={tc.content}>
          <View style={tc.top}>
            <View style={[tc.iconBox, { backgroundColor: dir.iconBg }]}>
              <Ionicons name={dir.icon as any} size={18} color={dir.iconColor} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[tc.label, { fontFamily: C.font.sans }]}>{dir.label}</Text>
              {!!counterpart && (
                <Text style={[tc.detail, { fontFamily: C.font.sans }]} numberOfLines={1}>
                  {counterpart}
                </Text>
              )}
              <Text style={[tc.ref, { fontFamily: C.font.mono }]} numberOfLines={1}>
                {fmtDate(item.createdAt)} · {item.reference?.slice(0, 10) ?? "—"}
              </Text>
            </View>
            <View style={tc.right}>
              <Text style={[tc.amount, {
                color: dir.isIncoming ? C.green : C.red,
                fontFamily: C.font.serif,
              }]}>
                {dir.isIncoming ? "+" : "−"} {fmt(displayAmount, displayCurrency)}
              </Text>
              <Text style={[tc.currency, { fontFamily: C.font.mono }]}>{displayCurrency}</Text>
            </View>
          </View>
          <View style={tc.bottom}>
            {/* Pill conversion : affiché uniquement quand on est l'EXPÉDITEUR (sortant)
                et qu'il y a une conversion, pour info. Pour l'entrant, displayAmount
                affiche déjà le bon montant donc le pill serait redondant. */}
            {!dir.isIncoming && item.targetCurrency && item.targetCurrency !== item.currency && (
              <View style={tc.convPill}>
                <Ionicons name="swap-horizontal-outline" size={10} color={C.blue} />
                <Text style={[tc.convTxt, { fontFamily: C.font.mono }]}>
                  {fmt(toNum(item.receivedAmount), item.targetCurrency)} {item.targetCurrency}
                </Text>
              </View>
            )}
            <View style={[tc.statusPill, { backgroundColor: rawSt.bg, borderColor: rawSt.border }]}>
              <Ionicons name={rawSt.icon as any} size={10} color={rawSt.color} />
              <Text style={[tc.statusTxt, { color: rawSt.color, fontFamily: C.font.sans }]}>
                {badgeLabel}
              </Text>
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
  bottom:    { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  convPill:  { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.blueBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: C.blueBorder },
  convTxt:   { fontSize: 9, fontWeight: "800", color: C.blue },
  statusPill:{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusTxt: { fontSize: 9, fontWeight: "900" },
});

// ─── Main ─────────────────────────────────────────────────
export default function TransactionsScreen() {
  const router   = useRouter();
  const { user } = useAuth();
  const isAdmin  = user?.role === "SUPER_ADMIN" || user?.role === "COMPANY_ADMIN";
  const isAgent  = user?.role === "AGENT";

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [filter,       setFilter]       = useState("ALL");
  const [q,            setQ]            = useState("");

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      let list: any[] = [];

      if (isAdmin) {
        const res = await api.adminGetTransactions();
        list = Array.isArray(res) ? res : [];

      } else if (isAgent) {
        const myId = String(user?.id ?? "");
        const [txRes, wdRes] = await Promise.allSettled([
          api.getTransactions(),
          api.getWithdrawals(),
        ]);

        const allTx: any[] = txRes.status === "fulfilled" ? txRes.value : [];
        const allWd: any[] = wdRes.status === "fulfilled" ? wdRes.value : [];

        const processedWithdrawals = allWd.filter(
          (w) => String(w.processedById ?? "") === myId && w.transactionId
        );
        const payoutTxIds = new Set(processedWithdrawals.map((w) => String(w.transactionId)));

        const seenIds = new Set<string>();

        for (const tx of allTx) {
          const type = String(tx.type ?? "").toUpperCase();
          const txId = String(tx.id);

          if (type === "AGENCY_REFILL" || type === "REFILL") {
            if (!seenIds.has(txId)) { seenIds.add(txId); list.push(tx); }
            continue;
          }
          if (type === "DEPOSIT" && String(tx.senderId ?? "") === myId) {
            if (!seenIds.has(txId)) { seenIds.add(txId); list.push(tx); }
            continue;
          }
          if (payoutTxIds.has(txId)) {
            if (!seenIds.has(txId)) { seenIds.add(txId); list.push({ ...tx, _agentPayout: true }); }
            continue;
          }
          if (String(tx.senderId ?? "") === myId) {
            if (!seenIds.has(txId)) { seenIds.add(txId); list.push(tx); }
          }
        }

        for (const w of processedWithdrawals) {
          const txId = String(w.transactionId);
          if (!seenIds.has(txId)) {
            seenIds.add(txId);
            list.push({
              id:           txId,
              reference:    w.code ?? txId.slice(0, 8),
              amount:       toNum(w.amount),
              fees:         0,
              total:        toNum(w.amount),
              currency:     w.currency ?? "XOF",
              status:       w.status ?? "PAID",
              type:         "WITHDRAWAL",
              createdAt:    w.paidAt ?? w.createdAt,
              _agentPayout: true,
            });
          }
        }

      } else {
        const res = await api.getTransactions();
        list = Array.isArray(res) ? res : [];
      }

      setTransactions(
        list.sort((a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, isAgent, user?.id]);

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
        return (
          (tx.reference ?? "").toLowerCase().includes(s) ||
          (tx.beneficiary?.fullName ?? "").toLowerCase().includes(s) ||
          (tx.beneficiary?.phone ?? "").toLowerCase().includes(s) ||
          `${tx.sender?.firstName ?? ""} ${tx.sender?.lastName ?? ""}`.toLowerCase().includes(s) ||
          `${tx.senderFirstName ?? ""} ${tx.senderLastName ?? ""}`.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [transactions, filter, q]);

  const pendingCount = transactions.filter((t) => t.status === "PENDING").length;

  const roleLabel: Record<string, string> = {
    SUPER_ADMIN:   "SUPER ADMIN",
    COMPANY_ADMIN: "ADMIN",
    AGENT:         "AGENT",
    USER:          "CLIENT",
  };

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
                {roleLabel[user?.role ?? "USER"] ?? "CLIENT"}
              </Text>
            </View>
            <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Historique</Text>
            <Text style={[s.heroSub, { fontFamily: C.font.sans }]}>
              {filtered.length} transaction{filtered.length > 1 ? "s" : ""}
              {pendingCount > 0 ? ` · ${pendingCount} en attente` : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={s.refreshBtn}
            onPress={() => { setRefreshing(true); void load(); }}
          >
            <Ionicons name="refresh" size={18} color={C.white} />
          </TouchableOpacity>
        </View>

        <View style={s.searchBox}>
          <Ionicons name="search" size={15} color={C.heroDim} />
          <TextInput
            style={[s.searchInput, { fontFamily: C.font.sans }]}
            value={q} onChangeText={setQ}
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
          const count  = f === "ALL"
            ? transactions.length
            : transactions.filter((t) => t.status === f).length;
          return (
            <TouchableOpacity
              style={[
                s.filterPill,
                active && { backgroundColor: st?.bg ?? C.greenPale, borderColor: `${st?.color ?? C.green}30` },
              ]}
              onPress={() => setFilter(f)}
              activeOpacity={0.8}
            >
              {active && st && (
                <Ionicons name={st.icon as any} size={10} color={st.color} />
              )}
              <Text style={[
                s.filterTxt,
                { color: active ? (st?.color ?? C.green) : C.inkSoft, fontFamily: C.font.sans },
              ]}>
                {f === "ALL" ? "Toutes" : st?.label ?? f}
              </Text>
              {count > 0 && (
                <View style={[
                  s.filterCount,
                  { backgroundColor: active ? `${st?.color ?? C.green}15` : C.white },
                ]}>
                  <Text style={[
                    s.filterCountTxt,
                    { color: active ? (st?.color ?? C.green) : C.inkSoft, fontFamily: C.font.mono },
                  ]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={C.green} size="large" />
        </View>
      ) : (
        <Animated.FlatList
          style={{ opacity: fadeAnim }}
          data={filtered}
          keyExtractor={(item) => item.id ?? String(Math.random())}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void load(); }}
              tintColor={C.green}
            />
          }
          renderItem={({ item }) => (
            <TxCard item={item} userId={user?.id} userRole={user?.role} />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIconBox}>
                <Ionicons name="receipt-outline" size={34} color={C.inkSoft} />
              </View>
              <Text style={[s.emptyTitle, { fontFamily: C.font.serif }]}>
                {q ? "Aucun résultat" : "Aucune transaction"}
              </Text>
              <Text style={[s.emptySub, { fontFamily: C.font.sans }]}>
                {q ? "Modifiez votre recherche" : "Vos transactions apparaîtront ici"}
              </Text>
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
    backgroundColor: C.green,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 48 : 16,
    paddingBottom: 20, overflow: "hidden",
  },
  glow:       { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: C.heroGlow, top: -60, right: -40 },
  heroRow:    { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  heroPill:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", borderRadius: C.r.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 4 },
  heroPillDot:{ width: 5, height: 5, borderRadius: C.r.pill, backgroundColor: "#A5F3FC" },
  heroPillTxt:{ color: "rgba(255,255,255,0.90)", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  heroTitle:  { color: C.white, fontSize: 24, fontWeight: "700", marginBottom: 2 },
  heroSub:    { color: C.heroDim, fontSize: 11, fontWeight: "600" },
  refreshBtn: { width: 38, height: 38, borderRadius: C.r.sm, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center", marginTop: 4 },

  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
    borderRadius: C.r.md, paddingHorizontal: 14, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.white, fontWeight: "600" },

  filters:        { paddingHorizontal: 16, gap: 8, paddingVertical: 10, alignItems: "center" },
  filterPill:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: C.r.pill, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.cardBorder },
  filterTxt:      { fontSize: 11, fontWeight: "800" },
  filterCount:    { minWidth: 18, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, alignItems: "center" },
  filterCountTxt: { fontSize: 10, fontWeight: "900" },

  list:         { paddingHorizontal: 16, paddingTop: 14 },
  empty:        { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyIconBox: { width: 70, height: 70, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.cardBorder, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle:   { color: C.ink, fontSize: 18, fontWeight: "700" },
  emptySub:     { color: C.inkSoft, fontSize: 13, fontWeight: "600", textAlign: "center" },
});