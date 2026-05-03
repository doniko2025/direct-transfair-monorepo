// apps/direct-transfair-mobile/app/agent/transactions.tsx
// apps/direct-transfair-mobile/app/agent/transactions.tsx
// =========================================================
// AGENT TRANSACTIONS v4.0 — Direct Transf'air
// Design: Forge & Ambre — thème AGENT
// ✅ Historique : Envois + Retraits clients
// ✅ Montant converti GNF si retrait, commissions
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity, SafeAreaView, StatusBar, Platform, Animated,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import type { Transaction } from "../../services/types";

// ─── Design Tokens ──────────────────────────────────────
const T = {
  g1: "#1A0E00",
  g2: "#211200",
  accent: "#F59E0B",
  accentGlow: "rgba(245,158,11,0.15)",
  ghost: "rgba(255,255,255,0.06)",
  ghostMid: "rgba(255,255,255,0.10)",
  inkBorder: "rgba(255,255,255,0.08)",
  inkLight: "#261800",
  white: "#FFFFFF",
  dim: "#A89070",
  green: "#22C55E",
  blue: "#60A5FA",
  red: "#EF4444",
  radius: { sm: 10, md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  PENDING:   { color: T.accent,  bg: "rgba(245,158,11,0.12)", icon: "time-outline" },
  VALIDATED: { color: T.blue,   bg: "rgba(96,165,250,0.12)",  icon: "checkmark-circle-outline" },
  PAID:      { color: T.green,  bg: "rgba(34,197,94,0.12)",   icon: "checkmark-done-circle-outline" },
  CANCELLED: { color: T.dim,    bg: "rgba(138,155,181,0.10)", icon: "close-circle-outline" },
  FAILED:    { color: T.red,    bg: "rgba(239,68,68,0.12)",   icon: "alert-circle-outline" },
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
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ─── TX Card ──────────────────────────────────────────────
function TxCard({ item, userId }: { item: Transaction; userId?: string }) {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;

  const tx = item as any;
  const withdrawal = tx.withdrawal as { processedById?: string } | undefined;
  const beneficiary = tx.beneficiary as { fullName?: string } | undefined;
  const sender = tx.sender as { firstName?: string; lastName?: string } | undefined;

  const myId = String(userId ?? "N/A");
  const isMyWithdrawal = withdrawal?.processedById ? String(withdrawal.processedById) === myId : false;
  const isSending = String(tx.senderId ?? "") === myId;

  // Montant affiché : si retrait, montant converti en devise cible
  let finalAmount = toNum(tx.amount);
  let finalCurrency = tx.currency ?? "XOF";
  if (isMyWithdrawal && toNum(tx.receivedAmount) > 0) {
    finalAmount = toNum(tx.receivedAmount);
    finalCurrency = tx.targetCurrency ?? "GNF";
  }

  const isWithdrawal = isMyWithdrawal;
  const icon = isWithdrawal ? "arrow-down-circle-outline" : "paper-plane-outline";
  const iconBg = isWithdrawal ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.10)";
  const iconColor = isWithdrawal ? T.green : T.accent;
  const label = isWithdrawal ? "Retrait Client" : "Envoi d'argent";
  const subLabel = isWithdrawal
    ? `${sender?.firstName ?? ""} ${sender?.lastName ?? ""}`.trim() || "Client"
    : beneficiary?.fullName || "Bénéficiaire";

  const statusCfg = STATUS_CONFIG[tx.status] ?? { color: T.dim, bg: T.ghost, icon: "help-circle-outline" };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={tcS.card}
        onPress={() => router.push({ pathname: "/(tabs)/transactions/[id]", params: { id: item.id } })}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={tcS.topRow}>
          <View style={[tcS.iconBox, { backgroundColor: iconBg }]}>
            <Ionicons name={icon as any} size={18} color={iconColor} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[tcS.label, { fontFamily: T.font.sans }]}>{label}</Text>
            <Text style={[tcS.subLabel, { fontFamily: T.font.sans }]} numberOfLines={1}>{subLabel}</Text>
          </View>
          <View style={tcS.right}>
            <Text style={[tcS.amount, { color: isWithdrawal ? T.green : T.white, fontFamily: T.font.display }]}>
              {isWithdrawal ? "+" : "−"} {fmt(finalAmount, finalCurrency)}
            </Text>
            <Text style={[tcS.currency, { color: iconColor, fontFamily: T.font.mono }]}>{finalCurrency}</Text>
          </View>
        </View>

        <View style={tcS.bottomRow}>
          <View style={tcS.dateRow}>
            <Ionicons name="time-outline" size={11} color={T.dim} />
            <Text style={[tcS.date, { fontFamily: T.font.sans }]}>{fmtDate(item.createdAt)}</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {isWithdrawal && (
              <View style={tcS.commTag}>
                <Ionicons name="checkmark-circle" size={10} color={T.green} />
                <Text style={[tcS.commTxt, { fontFamily: T.font.sans }]}>Commissionné</Text>
              </View>
            )}
            <View style={[tcS.statusPill, { backgroundColor: statusCfg.bg, borderColor: `${statusCfg.color}25` }]}>
              <Ionicons name={statusCfg.icon as any} size={10} color={statusCfg.color} />
              <Text style={[tcS.statusTxt, { color: statusCfg.color, fontFamily: T.font.sans }]}>{tx.status}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const tcS = StyleSheet.create({
  card: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: T.inkBorder,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  label: { color: T.white, fontSize: 13, fontWeight: "700", marginBottom: 2 },
  subLabel: { color: T.dim, fontSize: 11, fontWeight: "600" },
  right: { alignItems: "flex-end" },
  amount: { fontSize: 16, fontWeight: "800" },
  currency: { fontSize: 9, fontWeight: "900", marginTop: 1 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  date: { color: T.dim, fontSize: 10, fontWeight: "600" },
  commTag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(34,197,94,0.10)", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
  },
  commTxt: { color: T.green, fontSize: 9, fontWeight: "800" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
});

// ─── Main Screen ──────────────────────────────────────────
export default function AgentHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadTransactions = useCallback(async () => {
    try {
      if (!user?.id) { setTransactions([]); setLoading(false); setRefreshing(false); return; }
      const data = await api.getTransactions();
      setTransactions(data);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { fadeAnim.setValue(0); void loadTransactions(); }, [loadTransactions]));

  const onRefresh = () => { setRefreshing(true); void loadTransactions(); };

  // Filtrer uniquement les opérations de l'agent
  const myTxs = transactions.filter((tx) => {
    const t = tx as any;
    const myId = String(user?.id ?? "N/A");
    const isWithdrawal = t.withdrawal?.processedById ? String(t.withdrawal.processedById) === myId : false;
    const isSending = String(t.senderId ?? "") === myId;
    return isWithdrawal || isSending;
  });

  // Mini stats
  const withdrawalCount = myTxs.filter((tx) => {
    const t = tx as any;
    return t.withdrawal?.processedById === String(user?.id);
  }).length;

  const sendCount = myTxs.length - withdrawalCount;

  return (
    <LinearGradient colors={[T.g1, T.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={s.rolePill}>
              <View style={[s.roleDot, { backgroundColor: T.accent }]} />
              <Text style={[s.roleLabel, { color: T.accent, fontFamily: T.font.sans }]}>AGENT</Text>
            </View>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Historique</Text>
          </View>
          <TouchableOpacity style={s.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={18} color={T.accent} />
          </TouchableOpacity>
        </View>

        {/* Mini stats */}
        {!loading && myTxs.length > 0 && (
          <View style={s.statsRow}>
            <View style={[s.statBox, { borderColor: `${T.accent}20` }]}>
              <Text style={[s.statVal, { color: T.accent, fontFamily: T.font.display }]}>{myTxs.length}</Text>
              <Text style={[s.statLabel, { fontFamily: T.font.sans }]}>TOTAL</Text>
            </View>
            <View style={[s.statBox, { borderColor: "rgba(34,197,94,0.2)" }]}>
              <Text style={[s.statVal, { color: T.green, fontFamily: T.font.display }]}>{withdrawalCount}</Text>
              <Text style={[s.statLabel, { fontFamily: T.font.sans }]}>RETRAITS</Text>
            </View>
            <View style={[s.statBox, { borderColor: `${T.accent}20` }]}>
              <Text style={[s.statVal, { color: T.accent, fontFamily: T.font.display }]}>{sendCount}</Text>
              <Text style={[s.statLabel, { fontFamily: T.font.sans }]}>ENVOIS</Text>
            </View>
          </View>
        )}

        {loading && !refreshing ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator color={T.accent} size="large" />
          </View>
        ) : (
          <Animated.FlatList
            style={{ opacity: fadeAnim }}
            data={myTxs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
            renderItem={({ item }) => <TxCard item={item} userId={user?.id} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={[s.emptyIconBox, { borderColor: `${T.accent}20` }]}>
                  <Ionicons name="time-outline" size={34} color={T.dim} />
                </View>
                <Text style={[s.emptyTitle, { fontFamily: T.font.display }]}>Aucune opération récente</Text>
                <Text style={[s.emptySub, { fontFamily: T.font.sans }]}>
                  Les retraits validés et envois apparaîtront ici
                </Text>
              </View>
            }
            ListFooterComponent={<View style={{ height: 80 }} />}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 14, gap: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  roleDot: { width: 5, height: 5, borderRadius: 99 },
  roleLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  headerTitle: { color: T.white, fontSize: 22, fontWeight: "700" },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 14 },
  statBox: {
    flex: 1, backgroundColor: T.ghost, borderRadius: T.radius.md,
    padding: 12, alignItems: "center", borderWidth: 1,
  },
  statVal: { fontSize: 20, fontWeight: "800", marginBottom: 2 },
  statLabel: { fontSize: 8, fontWeight: "900", color: T.dim, letterSpacing: 0.8 },
  list: { paddingHorizontal: 20 },
  empty: { alignItems: "center", paddingVertical: 50, gap: 10 },
  emptyIconBox: {
    width: 68, height: 68, borderRadius: 20, backgroundColor: T.ghost,
    justifyContent: "center", alignItems: "center", borderWidth: 1, marginBottom: 4,
  },
  emptyTitle: { color: T.white, fontSize: 17, fontWeight: "700" },
  emptySub: { color: T.dim, fontSize: 12, fontWeight: "600", textAlign: "center", paddingHorizontal: 30 },
});