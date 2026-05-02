// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/index.tsx
// apps/direct-transfair-mobile/app/(tabs)/beneficiaries/index.tsx
// =========================================================
// TRANSACTIONS HISTORY v4.0 — Direct Transf'air
// Design: Thème dynamique par rôle
// ✅ Historique Client / Supervision Admin
// ✅ Filtres statut, validation B2B rapide
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity, Platform, Alert, Animated, StatusBar,
  SafeAreaView, TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

// ─── Role Themes ─────────────────────────────────────────
const ROLE_THEMES = {
  SUPER_ADMIN:   { g1: "#0A0A0F", g2: "#12121A", accent: "#D4A853", label: "Supervision Transactions" },
  COMPANY_ADMIN: { g1: "#030B1A", g2: "#071224", accent: "#34D399", label: "Supervision Transactions" },
  AGENT:         { g1: "#1A0E00", g2: "#211200", accent: "#F59E0B", label: "Mes Transactions" },
  USER:          { g1: "#0B1F14", g2: "#0F2A1C", accent: "#10B981", label: "Historique" },
} as const;

// ─── Tokens ─────────────────────────────────────────────
const T = {
  ghost: "rgba(255,255,255,0.06)",
  ghostMid: "rgba(255,255,255,0.10)",
  inkBorder: "rgba(255,255,255,0.08)",
  white: "#FFFFFF",
  dim: "#8A9BB5",
  radius: { sm: 10, md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

const STATUS_CONFIG = {
  PENDING:    { label: "En attente", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", icon: "time-outline" },
  VALIDATED:  { label: "Disponible", color: "#60A5FA", bg: "rgba(96,165,250,0.12)", icon: "checkmark-circle-outline" },
  PAID:       { label: "Payé",       color: "#22C55E", bg: "rgba(34,197,94,0.12)",  icon: "checkmark-done-circle-outline" },
  PROCESSING: { label: "Traitement", color: "#A78BFA", bg: "rgba(167,139,250,0.12)", icon: "sync-outline" },
  CANCELLED:  { label: "Annulé",     color: "#8A9BB5", bg: "rgba(138,155,181,0.10)", icon: "close-circle-outline" },
  FAILED:     { label: "Échoué",     color: "#EF4444", bg: "rgba(239,68,68,0.12)",  icon: "alert-circle-outline" },
} as const;

const TX_FILTERS = ["ALL", "PENDING", "VALIDATED", "PAID", "CANCELLED"] as const;

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

function fmtDate(d: string): string {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 86400000) return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ─── Status Badge ─────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? { label: status, color: T.dim, bg: T.ghost, icon: "help-circle-outline" };
  return (
    <View style={[sbS.pill, { backgroundColor: cfg.bg, borderColor: `${cfg.color}25` }]}>
      <Ionicons name={cfg.icon as any} size={10} color={cfg.color} />
      <Text style={[sbS.txt, { color: cfg.color, fontFamily: T.font.sans }]}>{cfg.label}</Text>
    </View>
  );
}
const sbS = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, borderWidth: 1 },
  txt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
});

// ─── TX Card ──────────────────────────────────────────────
function TxCard({
  item, accent, userId, onValidateB2B, validating,
}: {
  item: any; accent: string; userId?: string;
  onValidateB2B: (id: string) => void; validating: string | null;
}) {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;

  const isB2B = item.type === "SERVICE_PAYMENT";
  const isMyWithdrawal = item.withdrawal?.processedById === userId;
  const amount = toNum(item.amount);

  let icon = isB2B ? "swap-horizontal" : isMyWithdrawal ? "arrow-down-circle-outline" : "paper-plane-outline";
  let iconBg = isB2B ? "rgba(167,139,250,0.12)" : isMyWithdrawal ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)";
  let iconColor = isB2B ? "#A78BFA" : isMyWithdrawal ? "#22C55E" : accent;
  let amountColor = isMyWithdrawal ? "#22C55E" : T.white;
  let sign = isMyWithdrawal ? "+" : isB2B ? "" : "−";
  let txLabel = isB2B ? "Paiement Service" : isMyWithdrawal ? "Retrait Client" : "Envoi d'argent";

  const canValidate = isB2B && item.status === "PENDING";

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={tcS.card}
        onPress={() => router.push(`/(tabs)/transactions/${item.id}`)}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        {/* Top row */}
        <View style={tcS.topRow}>
          <View style={[tcS.iconBox, { backgroundColor: iconBg }]}>
            <Ionicons name={icon as any} size={16} color={iconColor} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[tcS.label, { fontFamily: T.font.sans }]} numberOfLines={1}>{txLabel}</Text>
            <Text style={[tcS.ref, { fontFamily: T.font.mono }]} numberOfLines={1}>{item.reference}</Text>
          </View>
          <View style={tcS.right}>
            <Text style={[tcS.amount, { color: amountColor, fontFamily: T.font.display }]}>
              {sign} {fmt(amount, item.currency)}
            </Text>
            <Text style={[tcS.currency, { color: iconColor, fontFamily: T.font.mono }]}>{item.currency}</Text>
          </View>
        </View>

        {/* Bottom row */}
        <View style={tcS.bottomRow}>
          <View style={tcS.dateRow}>
            <Ionicons name="time-outline" size={11} color={T.dim} />
            <Text style={[tcS.date, { fontFamily: T.font.sans }]}>{fmtDate(item.createdAt)}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>

        {/* Sender hint (admin view) */}
        {item.sender?.firstName && (
          <View style={tcS.senderRow}>
            <Ionicons name="person-outline" size={11} color={T.dim} />
            <Text style={[tcS.senderTxt, { fontFamily: T.font.sans }]} numberOfLines={1}>
              {item.sender.firstName} {item.sender.lastName}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Validation rapide B2B */}
      {canValidate && (
        <TouchableOpacity
          style={[tcS.validateBtn, { backgroundColor: `${accent}20`, borderColor: `${accent}30` }]}
          onPress={() => onValidateB2B(item.id)}
          disabled={validating === item.id}
          activeOpacity={0.85}
        >
          {validating === item.id ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={15} color={accent} />
              <Text style={[tcS.validateTxt, { color: accent, fontFamily: T.font.sans }]}>
                Valider le Paiement B2B
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}
const tcS = StyleSheet.create({
  card: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 16, marginBottom: 0,
    borderWidth: 1, borderColor: T.inkBorder,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  iconBox: { width: 36, height: 36, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  label: { color: T.white, fontSize: 13, fontWeight: "700", marginBottom: 2 },
  ref: { color: T.dim, fontSize: 10, fontWeight: "600" },
  right: { alignItems: "flex-end" },
  amount: { fontSize: 17, fontWeight: "800" },
  currency: { fontSize: 9, fontWeight: "900", marginTop: 1 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  date: { color: T.dim, fontSize: 10, fontWeight: "600" },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: T.inkBorder },
  senderTxt: { color: T.dim, fontSize: 10, fontWeight: "600" },
  validateBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, marginTop: -1,
    borderTopWidth: 0, borderBottomLeftRadius: T.radius.lg, borderBottomRightRadius: T.radius.lg,
    borderWidth: 1, borderTopWidth: 0,
  },
  validateTxt: { fontSize: 12, fontWeight: "800" },
});

// ─── Wrapper (Card + Validate bouton) ────────────────────
function TxWrapper({ item, accent, userId, onValidateB2B, validating }: any) {
  const isB2B = item.type === "SERVICE_PAYMENT";
  const canValidate = isB2B && item.status === "PENDING";
  return (
    <View style={[twS.wrap, canValidate && twS.wrapWithValidate]}>
      <TxCard item={item} accent={accent} userId={userId} onValidateB2B={onValidateB2B} validating={validating} />
    </View>
  );
}
const twS = StyleSheet.create({
  wrap: { marginBottom: 10, borderRadius: T.radius.lg, overflow: "hidden" },
  wrapWithValidate: {},
});

// ─── Main Screen ──────────────────────────────────────────
export default function TransactionsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const role = (user?.role ?? "USER") as keyof typeof ROLE_THEMES;
  const theme = ROLE_THEMES[role] ?? ROLE_THEMES.USER;
  const isAdmin = role === "SUPER_ADMIN" || role === "COMPANY_ADMIN";

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [q, setQ] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const res = isAdmin ? await api.adminGetTransactions() : await api.getTransactions();
      const list = Array.isArray(res) ? res : [];
      const sorted = list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(sorted);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { setTransactions([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { fadeAnim.setValue(0); void load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); void load(); };

  const handleValidateB2B = async (id: string) => {
    setValidating(id);
    try {
      await api.validateBankTransfer(id);
      Alert.alert("✅ Validé", "Paiement validé, solde de la société débité.");
      void load();
    } catch (e: any) {
      const err = e?.response?.data?.message || "Erreur validation";
      Alert.alert("Erreur", err);
    } finally {
      setValidating(null);
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

  const totalVolume = transactions.reduce((sum, t) => {
    if (t.currency === "XOF") return sum + toNum(t.amount);
    return sum;
  }, 0);

  return (
    <LinearGradient colors={[theme.g1, theme.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>{theme.label}</Text>
            <Text style={[s.headerSub, { color: theme.accent, fontFamily: T.font.sans }]}>
              {filtered.length} transaction{filtered.length > 1 ? "s" : ""}
              {pendingCount > 0 && ` · ${pendingCount} en attente`}
            </Text>
          </View>
          <TouchableOpacity style={s.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={20} color={theme.accent} />
          </TouchableOpacity>
        </View>

        {/* ── Mini stats (admin) ── */}
        {isAdmin && !loading && transactions.length > 0 && (
          <View style={s.statsRow}>
            <View style={[s.statBox, { borderColor: `${theme.accent}20` }]}>
              <Text style={[s.statVal, { color: theme.accent, fontFamily: T.font.display }]}>
                {fmt(totalVolume)}
              </Text>
              <Text style={[s.statLabel, { fontFamily: T.font.sans }]}>VOL. XOF</Text>
            </View>
            <View style={[s.statBox, { borderColor: "rgba(245,158,11,0.2)" }]}>
              <Text style={[s.statVal, { color: "#F59E0B", fontFamily: T.font.display }]}>{pendingCount}</Text>
              <Text style={[s.statLabel, { fontFamily: T.font.sans }]}>EN ATTENTE</Text>
            </View>
            <View style={[s.statBox, { borderColor: "rgba(34,197,94,0.2)" }]}>
              <Text style={[s.statVal, { color: "#22C55E", fontFamily: T.font.display }]}>
                {transactions.filter((t) => t.status === "PAID").length}
              </Text>
              <Text style={[s.statLabel, { fontFamily: T.font.sans }]}>PAYÉES</Text>
            </View>
          </View>
        )}

        {/* ── Search ── */}
        <View style={s.searchBox}>
          <Ionicons name="search" size={16} color={T.dim} />
          <TextInput
            style={[s.searchInput, { fontFamily: T.font.sans }]}
            value={q} onChangeText={setQ}
            placeholder={isAdmin ? "Référence, nom, devise…" : "Rechercher…"}
            placeholderTextColor={T.dim + "55"}
          />
          {!!q && (
            <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn}>
              <Ionicons name="close" size={13} color={T.dim} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Filters ── */}
        <FlatList
          horizontal
          data={[...TX_FILTERS]}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtersList}
          keyExtractor={(item) => item}
          renderItem={({ item: f }) => {
            const isActive = activeFilter === f;
            const cfg = f !== "ALL" ? STATUS_CONFIG[f as keyof typeof STATUS_CONFIG] : null;
            const count = f === "ALL" ? transactions.length : transactions.filter((t) => t.status === f).length;
            return (
              <TouchableOpacity
                style={[
                  s.filterPill,
                  isActive && {
                    backgroundColor: cfg ? `${cfg.color}15` : `${theme.accent}15`,
                    borderColor: cfg ? `${cfg.color}35` : `${theme.accent}35`,
                  },
                ]}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[s.filterTxt, { fontFamily: T.font.sans }, isActive && { color: cfg?.color ?? theme.accent }]}>
                  {f === "ALL" ? "Toutes" : cfg?.label ?? f}
                </Text>
                <View style={[s.filterCount, { backgroundColor: isActive ? (cfg?.color ?? theme.accent) + "25" : T.ghost }]}>
                  <Text style={[s.filterCountTxt, { color: isActive ? (cfg?.color ?? theme.accent) : T.dim, fontFamily: T.font.mono }]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          style={{ maxHeight: 46, marginBottom: 14 }}
        />

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
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
            }
            renderItem={({ item }) => (
              <TxWrapper
                item={item}
                accent={theme.accent}
                userId={user?.id}
                onValidateB2B={handleValidateB2B}
                validating={validating}
              />
            )}
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={[s.emptyIconBox, { borderColor: `${theme.accent}20` }]}>
                  <Ionicons name="document-text-outline" size={34} color={T.dim} />
                </View>
                <Text style={[s.emptyTitle, { fontFamily: T.font.display }]}>
                  {q ? "Aucun résultat" : "Aucune transaction"}
                </Text>
                <Text style={[s.emptySub, { fontFamily: T.font.sans }]}>
                  {q ? "Modifiez la recherche ou les filtres" : "Vos transactions apparaîtront ici"}
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
  headerTitle: { color: T.white, fontSize: 22, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },
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
  statVal: { fontSize: 16, fontWeight: "800", marginBottom: 2 },
  statLabel: { fontSize: 8, fontWeight: "900", color: T.dim, letterSpacing: 0.8 },

  searchBox: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, paddingHorizontal: 13, height: 44, gap: 9,
  },
  searchInput: { flex: 1, fontSize: 13, color: T.white, fontWeight: "600" },
  clearBtn: { width: 24, height: 24, borderRadius: 7, backgroundColor: T.ghostMid, justifyContent: "center", alignItems: "center" },

  filtersList: { paddingHorizontal: 20, gap: 8, alignItems: "center" },
  filterPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: T.ghost, borderRadius: T.radius.md, borderWidth: 1, borderColor: T.inkBorder,
  },
  filterTxt: { fontSize: 11, fontWeight: "800", color: T.dim, letterSpacing: 0.3 },
  filterCount: { minWidth: 17, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6, alignItems: "center" },
  filterCountTxt: { fontSize: 9, fontWeight: "900" },

  list: { paddingHorizontal: 20 },

  empty: { alignItems: "center", paddingVertical: 50, gap: 10 },
  emptyIconBox: {
    width: 68, height: 68, borderRadius: 20, backgroundColor: T.ghost,
    justifyContent: "center", alignItems: "center", borderWidth: 1, marginBottom: 4,
  },
  emptyTitle: { color: T.white, fontSize: 17, fontWeight: "700" },
  emptySub: { color: T.dim, fontSize: 12, fontWeight: "600", textAlign: "center", paddingHorizontal: 30 },
});