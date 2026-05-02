// apps/direct-transfair-mobile/app/(tabs)/admin/transactions.tsx
// apps/direct-transfair-mobile/app/(tabs)/admin/transactions.tsx
// =========================================================
// ADMIN TRANSACTIONS v4.0 — Direct Transf'air
// Design: Thème dynamique par rôle, dark premium
// ✅ Validation / Annulation / B2B
// ✅ Filtres par statut, recherche, multi-devises
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator,
  Alert, SafeAreaView, StatusBar, Platform, TextInput, Animated,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

// ─── Tokens ─────────────────────────────────────────────
const ROLE_THEMES = {
  SUPER_ADMIN:   { g1: "#0A0A0F", g2: "#12121A", accent: "#D4A853", label: "SUPER ADMIN" },
  COMPANY_ADMIN: { g1: "#030B1A", g2: "#071224", accent: "#34D399", label: "ADMIN SOCIÉTÉ" },
} as const;

const T = {
  ghost: "rgba(255,255,255,0.06)",
  ghostMid: "rgba(255,255,255,0.10)",
  white: "#FFFFFF",
  dim: "#8A9BB5",
  inkBorder: "rgba(255,255,255,0.08)",
  red: "#EF4444",
  green: "#22C55E",
  amber: "#F59E0B",
  blue: "#60A5FA",
  purple: "#A78BFA",
  radius: { sm: 10, md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

const STATUS_CONFIG = {
  PENDING:    { color: T.amber,   bg: "rgba(245,158,11,0.12)",  label: "EN ATTENTE",  icon: "time-outline" },
  VALIDATED:  { color: T.green,   bg: "rgba(34,197,94,0.12)",   label: "VALIDÉE",     icon: "checkmark-circle-outline" },
  PAID:       { color: "#34D399", bg: "rgba(52,211,153,0.12)",  label: "PAYÉE",       icon: "checkmark-done-circle-outline" },
  PROCESSING: { color: T.blue,    bg: "rgba(96,165,250,0.12)",  label: "TRAITEMENT",  icon: "sync-outline" },
  CANCELLED:  { color: T.dim,     bg: "rgba(138,155,181,0.10)", label: "ANNULÉE",     icon: "close-circle-outline" },
  FAILED:     { color: T.red,     bg: "rgba(239,68,68,0.12)",   label: "ÉCHOUÉE",     icon: "alert-circle-outline" },
  REFUNDED:   { color: T.purple,  bg: "rgba(167,139,250,0.12)", label: "REMBOURSÉE",  icon: "return-down-back-outline" },
} as const;

const STATUS_FILTERS = ["ALL", "PENDING", "VALIDATED", "PAID", "CANCELLED"] as const;

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

function fmtDate(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(",", "");
}

// ─── Status Badge ─────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? { color: T.dim, bg: T.ghost, label: status, icon: "help-circle-outline" };
  return (
    <View style={[sbS.pill, { backgroundColor: cfg.bg, borderColor: `${cfg.color}25` }]}>
      <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
      <Text style={[sbS.txt, { color: cfg.color, fontFamily: T.font.sans }]}>{cfg.label}</Text>
    </View>
  );
}
const sbS = StyleSheet.create({
  pill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
  txt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
});

// ─── TX Card ──────────────────────────────────────────────
function TxCard({ item, accent, onValidate, onCancel, onValidateB2B, onRejectB2B }: {
  item: any; accent: string;
  onValidate: () => void; onCancel: () => void;
  onValidateB2B: () => void; onRejectB2B: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const isB2B = item.type === "SERVICE_PAYMENT";
  const isPending = item.status === "PENDING";
  const amount = toNum(item.amount);
  const fees = toNum(item.fees);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={tcS.card}
        activeOpacity={0.9}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        {/* Top row */}
        <View style={tcS.topRow}>
          <View style={[tcS.typeBox, { backgroundColor: isB2B ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.06)" }]}>
            <Ionicons name={isB2B ? "swap-horizontal" : "paper-plane-outline"} size={16} color={isB2B ? T.purple : accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 10 }}>
            <Text style={[tcS.ref, { fontFamily: T.font.mono }]} numberOfLines={1}>{item.reference}</Text>
            <Text style={[tcS.date, { fontFamily: T.font.sans }]}>{fmtDate(item.createdAt)}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>

        <View style={tcS.divider} />

        {/* Montants */}
        <View style={tcS.amountRow}>
          <View>
            <Text style={[tcS.amtLabel, { fontFamily: T.font.sans }]}>MONTANT</Text>
            <Text style={[tcS.amount, { color: T.white, fontFamily: T.font.display }]}>
              {fmt(amount, item.currency)}
            </Text>
            <Text style={[tcS.currency, { color: accent, fontFamily: T.font.mono }]}>{item.currency}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[tcS.amtLabel, { fontFamily: T.font.sans }]}>FRAIS</Text>
            <Text style={[tcS.fees, { fontFamily: T.font.mono }]}>{fmt(fees, item.currency)}</Text>
            {item.targetCurrency && item.targetCurrency !== item.currency && (
              <>
                <Text style={[tcS.amtLabel, { fontFamily: T.font.sans, marginTop: 6 }]}>REÇU</Text>
                <Text style={[tcS.received, { color: T.green, fontFamily: T.font.mono }]}>
                  {fmt(toNum(item.receivedAmount), item.targetCurrency)} {item.targetCurrency}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Sender info */}
        {item.sender && (
          <View style={tcS.senderRow}>
            <Ionicons name="person-outline" size={12} color={T.dim} />
            <Text style={[tcS.senderTxt, { fontFamily: T.font.sans }]} numberOfLines={1}>
              {item.sender.firstName} {item.sender.lastName}
              {item.sender.agency ? ` · ${item.sender.agency.name}` : ""}
            </Text>
          </View>
        )}

        {/* Actions si PENDING */}
        {isPending && (
          <View style={tcS.actionsRow}>
            <TouchableOpacity
              style={[tcS.actionBtn, { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.25)" }]}
              onPress={isB2B ? onRejectB2B : onCancel}
            >
              <Ionicons name="close" size={14} color={T.red} />
              <Text style={[tcS.actionTxt, { color: T.red, fontFamily: T.font.sans }]}>Rejeter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[tcS.actionBtn, { backgroundColor: `${accent}15`, borderColor: `${accent}30` }]}
              onPress={isB2B ? onValidateB2B : onValidate}
            >
              <Ionicons name="checkmark" size={14} color={accent} />
              <Text style={[tcS.actionTxt, { color: accent, fontFamily: T.font.sans }]}>Valider</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
const tcS = StyleSheet.create({
  card: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: T.inkBorder,
  },
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  typeBox: { width: 36, height: 36, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  ref: { color: T.white, fontSize: 13, fontWeight: "800", marginBottom: 2 },
  date: { color: T.dim, fontSize: 11, fontWeight: "600" },
  divider: { height: 1, backgroundColor: T.inkBorder, marginBottom: 12 },
  amountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  amtLabel: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 0.8, marginBottom: 4 },
  amount: { fontSize: 22, letterSpacing: -0.3 },
  currency: { fontSize: 10, fontWeight: "800", marginTop: 2 },
  fees: { color: T.dim, fontSize: 13, fontWeight: "700" },
  received: { fontSize: 13, fontWeight: "800" },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  senderTxt: { color: T.dim, fontSize: 11, fontWeight: "600" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 11, borderRadius: T.radius.md, borderWidth: 1,
  },
  actionTxt: { fontSize: 12, fontWeight: "800" },
});

// ─── Main Screen ──────────────────────────────────────────
export default function AdminTransactionsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const role = (user?.role ?? "COMPANY_ADMIN") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.COMPANY_ADMIN;

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.adminGetTransactions();
      setTransactions(Array.isArray(data) ? data : []);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void loadTransactions(); }, [loadTransactions]));

  const handleUpdateStatus = async (tx: any, newStatus: string) => {
    try {
      const isB2B = tx.type === "SERVICE_PAYMENT";
      if (isB2B) {
        if (newStatus === "VALIDATED") await api.validateBankTransfer(tx.id);
        else if (newStatus === "CANCELLED") await api.rejectBankTransfer(tx.id);
        else await api.adminUpdateTransactionStatus(tx.id, newStatus);
      } else {
        await api.adminUpdateTransactionStatus(tx.id, newStatus);
      }
      if (Platform.OS === "web") alert("✅ Statut mis à jour");
      else Alert.alert("✅ Succès", "Statut mis à jour");
      void loadTransactions();
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Impossible de mettre à jour";
      if (Platform.OS === "web") alert(msg);
      else Alert.alert("Erreur", msg);
    }
  };

  const filtered = transactions.filter((tx) => {
    if (activeFilter !== "ALL" && tx.status !== activeFilter) return false;
    if (q.trim()) {
      const search = q.toLowerCase();
      return (tx.reference ?? "").toLowerCase().includes(search)
        || `${tx.sender?.firstName ?? ""} ${tx.sender?.lastName ?? ""}`.toLowerCase().includes(search)
        || (tx.currency ?? "").toLowerCase().includes(search);
    }
    return true;
  });

  const pendingCount = transactions.filter((t) => t.status === "PENDING").length;

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Transactions</Text>
            <Text style={[s.headerSub, { color: theme.accent, fontFamily: T.font.sans }]}>
              {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
              {pendingCount > 0 ? ` · ${pendingCount} en attente` : ""}
            </Text>
          </View>
          <TouchableOpacity style={s.refreshBtn} onPress={() => void loadTransactions()}>
            <Ionicons name="refresh" size={20} color={theme.accent} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchBox}>
          <Ionicons name="search" size={18} color={T.dim} />
          <TextInput
            style={[s.searchInput, { fontFamily: T.font.sans }]}
            value={q}
            onChangeText={setQ}
            placeholder="Référence, nom, devise..."
            placeholderTextColor={T.dim + "60"}
          />
          {!!q && (
            <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn}>
              <Ionicons name="close" size={14} color={T.dim} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <View style={s.filtersWrap}>
          <FlatList
            horizontal
            data={[...STATUS_FILTERS]}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filtersList}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const isActive = activeFilter === item;
              const cfg = item !== "ALL" ? STATUS_CONFIG[item as keyof typeof STATUS_CONFIG] : null;
              const count = item === "ALL" ? transactions.length : transactions.filter((t) => t.status === item).length;
              return (
                <TouchableOpacity
                  style={[
                    s.filterPill,
                    isActive && { backgroundColor: cfg ? `${cfg.color}20` : `${theme.accent}20`, borderColor: cfg ? `${cfg.color}40` : `${theme.accent}40` },
                  ]}
                  onPress={() => setActiveFilter(item)}
                >
                  <Text style={[s.filterTxt, { fontFamily: T.font.sans }, isActive && { color: cfg?.color ?? theme.accent }]}>
                    {item === "ALL" ? "Toutes" : cfg?.label ?? item}
                  </Text>
                  <View style={[s.filterCount, { backgroundColor: isActive ? (cfg?.color ?? theme.accent) + "30" : T.ghost }]}>
                    <Text style={[s.filterCountTxt, { color: isActive ? (cfg?.color ?? theme.accent) : T.dim, fontFamily: T.font.mono }]}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator color={theme.accent} size="large" />
          </View>
        ) : (
          <Animated.FlatList
            style={{ opacity: fadeAnim }}
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TxCard
                item={item}
                accent={theme.accent}
                onValidate={() => handleUpdateStatus(item, "VALIDATED")}
                onCancel={() => handleUpdateStatus(item, "CANCELLED")}
                onValidateB2B={() => handleUpdateStatus(item, "VALIDATED")}
                onRejectB2B={() => handleUpdateStatus(item, "CANCELLED")}
              />
            )}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="analytics-outline" size={36} color={T.dim} />
                <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucune transaction</Text>
                <Text style={[s.emptySub, { fontFamily: T.font.sans }]}>Modifiez les filtres</Text>
              </View>
            }
            ListFooterComponent={<View style={{ height: 100 }} />}
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
  headerTitle: { color: T.white, fontSize: 24, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, paddingHorizontal: 14, height: 46, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: T.white, fontWeight: "600" },
  clearBtn: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: T.ghostMid, justifyContent: "center", alignItems: "center",
  },
  filtersWrap: { marginBottom: 14 },
  filtersList: { paddingHorizontal: 20, gap: 8 },
  filterPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: T.radius.md,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
  },
  filterTxt: { fontSize: 11, fontWeight: "800", color: T.dim, letterSpacing: 0.3 },
  filterCount: {
    minWidth: 18, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6,
    alignItems: "center",
  },
  filterCountTxt: { fontSize: 10, fontWeight: "900" },
  list: { paddingHorizontal: 20 },
  empty: { alignItems: "center", paddingVertical: 50, gap: 8 },
  emptyTxt: { color: T.white, fontSize: 17, fontWeight: "700" },
  emptySub: { color: T.dim, fontSize: 13, fontWeight: "600" },
});