// apps/direct-transfair-mobile/app/(tabs)/admin/transactions.tsx
// =========================================================
// ADMIN TRANSACTIONS v5.0 — Direct Transf'air
// ✅ Thème CLAIR — zéro dark/sombre
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator,
  Alert, SafeAreaView, StatusBar, Platform, TextInput, Animated,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

const T = {
  pageBg:   "#F2F4F8",
  surface:  "#FFFFFF",
  border:   "#E4E9F0",
  ink:      "#0F172A",
  inkSub:   "#64748B",
  inkMuted: "#94A3B8",
  blue:     "#1956F0",
  blueLt:   "#EEF2FF",
  blueMd:   "#C7D5FF",
  green:    "#16A34A",
  greenLt:  "#DCFCE7",
  red:      "#DC2626",
  redLt:    "#FEE2E2",
  amber:    "#D97706",
  amberLt:  "#FEF3C7",
  purple:   "#7C3AED",
  purpleLt: "#EDE9FE",
  white:    "#FFFFFF",
  radius: { sm: 8, md: 12, lg: 16 },
  font: {
    display:  Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:     Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:     Platform.select({ ios: "Courier New", android: "monospace",          default: "monospace" }),
  },
};

const ROLE_ACCENT: Record<string, string> = {
  SUPER_ADMIN:   T.blue,
  COMPANY_ADMIN: T.green,
};

const STATUS_CONFIG = {
  PENDING:    { color: T.amber,  bgColor: T.amberLt,  label: "EN ATTENTE",  icon: "time-outline" },
  VALIDATED:  { color: T.green,  bgColor: T.greenLt,  label: "VALIDÉE",     icon: "checkmark-circle-outline" },
  PAID:       { color: "#0F766E",bgColor: "#CCFBF1",  label: "PAYÉE",       icon: "checkmark-done-circle-outline" },
  PROCESSING: { color: T.blue,   bgColor: T.blueLt,   label: "TRAITEMENT",  icon: "sync-outline" },
  CANCELLED:  { color: T.inkMuted,bgColor:"#F1F5F9",  label: "ANNULÉE",     icon: "close-circle-outline" },
  FAILED:     { color: T.red,    bgColor: T.redLt,    label: "ÉCHOUÉE",     icon: "alert-circle-outline" },
  REFUNDED:   { color: T.purple, bgColor: T.purpleLt, label: "REMBOURSÉE",  icon: "return-down-back-outline" },
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
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(",", "");
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? { color: T.inkMuted, bgColor: "#F1F5F9", label: status, icon: "help-circle-outline" };
  return (
    <View style={[sbS.pill, { backgroundColor: cfg.bgColor, borderColor: `${cfg.color}30` }]}>
      <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
      <Text style={[sbS.txt, { color: cfg.color, fontFamily: T.font.sans }]}>{cfg.label}</Text>
    </View>
  );
}
const sbS = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  txt:  { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
});

function TxCard({ item, accent, onValidate, onCancel, onValidateB2B, onRejectB2B }: {
  item: any; accent: string;
  onValidate: () => void; onCancel: () => void;
  onValidateB2B: () => void; onRejectB2B: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const isB2B     = item.type === "SERVICE_PAYMENT";
  const isPending = item.status === "PENDING";
  const amount    = toNum(item.amount);
  const fees      = toNum(item.fees);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={tcS.card}
        activeOpacity={0.9}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        {/* Barre top colorée selon statut */}
        <View style={[tcS.topStripe, { backgroundColor: STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG]?.color ?? T.inkMuted }]} />

        <View style={tcS.topRow}>
          <View style={[tcS.typeBox, { backgroundColor: isB2B ? T.purpleLt : T.blueLt }]}>
            <Ionicons name={isB2B ? "swap-horizontal" : "paper-plane-outline"} size={15} color={isB2B ? T.purple : T.blue} />
          </View>
          <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 10 }}>
            <Text style={[tcS.ref, { fontFamily: T.font.mono }]} numberOfLines={1}>{item.reference}</Text>
            <Text style={[tcS.date, { fontFamily: T.font.sans }]}>{fmtDate(item.createdAt)}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>

        <View style={tcS.divider} />

        <View style={tcS.amountRow}>
          <View>
            <Text style={[tcS.amtLabel, { fontFamily: T.font.sans }]}>MONTANT</Text>
            <Text style={[tcS.amount, { color: T.ink, fontFamily: T.font.display }]}>
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
                <Text style={[tcS.received, { fontFamily: T.font.mono }]}>
                  {fmt(toNum(item.receivedAmount), item.targetCurrency)} {item.targetCurrency}
                </Text>
              </>
            )}
          </View>
        </View>

        {item.sender && (
          <View style={tcS.senderRow}>
            <Ionicons name="person-outline" size={12} color={T.inkMuted} />
            <Text style={[tcS.senderTxt, { fontFamily: T.font.sans }]} numberOfLines={1}>
              {item.sender.firstName} {item.sender.lastName}
              {item.sender.agency ? ` · ${item.sender.agency.name}` : ""}
            </Text>
          </View>
        )}

        {isPending && (
          <View style={tcS.actionsRow}>
            <TouchableOpacity
              style={[tcS.actionBtn, { backgroundColor: T.redLt, borderColor: `${T.red}25` }]}
              onPress={isB2B ? onRejectB2B : onCancel}
            >
              <Ionicons name="close" size={14} color={T.red} />
              <Text style={[tcS.actionTxt, { color: T.red, fontFamily: T.font.sans }]}>Rejeter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[tcS.actionBtn, { backgroundColor: `${accent}12`, borderColor: `${accent}30` }]}
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
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    marginBottom: 12, borderWidth: 1, borderColor: T.border, overflow: "hidden",
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  topStripe: { height: 3 },
  topRow: { flexDirection: "row", alignItems: "center", padding: 14, paddingBottom: 12 },
  typeBox: { width: 36, height: 36, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  ref:  { color: T.ink, fontSize: 13, fontWeight: "800", marginBottom: 2 },
  date: { color: T.inkMuted, fontSize: 11, fontWeight: "600" },
  divider: { height: 1, backgroundColor: T.border, marginHorizontal: 14 },
  amountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 14, paddingBottom: 10 },
  amtLabel: { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 0.8, marginBottom: 4, textTransform: "uppercase" },
  amount:   { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  currency: { fontSize: 10, fontWeight: "800", marginTop: 2 },
  fees:     { color: T.inkSub, fontSize: 13, fontWeight: "700" },
  received: { color: T.green, fontSize: 13, fontWeight: "800" },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingBottom: 12 },
  senderTxt: { color: T.inkMuted, fontSize: 11, fontWeight: "600" },
  actionsRow: { flexDirection: "row", gap: 10, padding: 14, paddingTop: 0 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 11, borderRadius: T.radius.md, borderWidth: 1,
  },
  actionTxt: { fontSize: 12, fontWeight: "800" },
});

export default function AdminTransactionsScreen() {
  const router    = useRouter();
  const { user }  = useAuth();
  const accent    = ROLE_ACCENT[user?.role ?? "COMPANY_ADMIN"] ?? T.blue;

  const [transactions,  setTransactions]  = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [activeFilter,  setActiveFilter]  = useState<string>("ALL");
  const [q,             setQ]             = useState("");
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
    <SafeAreaView style={ts.safe}>
      <StatusBar backgroundColor={T.surface} barStyle="dark-content" />

      <View style={ts.header}>
        <TouchableOpacity style={ts.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[ts.headerTitle, { fontFamily: T.font.display }]}>Transactions</Text>
          <Text style={[ts.headerSub, { color: accent, fontFamily: T.font.sans }]}>
            {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
            {pendingCount > 0 ? ` · ${pendingCount} en attente` : ""}
          </Text>
        </View>
        <TouchableOpacity style={[ts.iconBtn, { backgroundColor: `${accent}12` }]} onPress={() => void loadTransactions()}>
          <Ionicons name="refresh" size={19} color={accent} />
        </TouchableOpacity>
      </View>

      <View style={ts.searchBox}>
        <Ionicons name="search" size={16} color={T.inkMuted} />
        <TextInput
          style={[ts.searchInput, { fontFamily: T.font.sans }]}
          value={q}
          onChangeText={setQ}
          placeholder="Référence, nom, devise..."
          placeholderTextColor={T.inkMuted}
        />
        {!!q && (
          <TouchableOpacity onPress={() => setQ("")} style={ts.clearBtn}>
            <Ionicons name="close" size={13} color={T.inkMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        horizontal
        data={[...STATUS_FILTERS]}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ts.filtersList}
        keyExtractor={(item) => item}
        style={ts.filtersWrap}
        renderItem={({ item }) => {
          const isActive = activeFilter === item;
          const cfg = item !== "ALL" ? STATUS_CONFIG[item as keyof typeof STATUS_CONFIG] : null;
          const count = item === "ALL" ? transactions.length : transactions.filter((t) => t.status === item).length;
          return (
            <TouchableOpacity
              style={[ts.filterPill, isActive && { backgroundColor: cfg ? cfg.bgColor : T.blueLt, borderColor: cfg ? `${cfg.color}30` : T.blueMd }]}
              onPress={() => setActiveFilter(item)}
            >
              <Text style={[ts.filterTxt, { fontFamily: T.font.sans, color: isActive ? (cfg?.color ?? T.blue) : T.inkSub }]}>
                {item === "ALL" ? "Toutes" : cfg?.label ?? item}
              </Text>
              <View style={[ts.filterCount, { backgroundColor: isActive ? `${(cfg?.color ?? T.blue)}15` : T.pageBg }]}>
                <Text style={[ts.filterCountTxt, { color: isActive ? (cfg?.color ?? T.blue) : T.inkMuted, fontFamily: T.font.mono }]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={accent} size="large" />
        </View>
      ) : (
        <Animated.FlatList
          style={{ opacity: fadeAnim }}
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={ts.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TxCard
              item={item} accent={accent}
              onValidate={() => handleUpdateStatus(item, "VALIDATED")}
              onCancel={() => handleUpdateStatus(item, "CANCELLED")}
              onValidateB2B={() => handleUpdateStatus(item, "VALIDATED")}
              onRejectB2B={() => handleUpdateStatus(item, "CANCELLED")}
            />
          )}
          ListEmptyComponent={
            <View style={ts.empty}>
              <Ionicons name="analytics-outline" size={36} color={T.inkMuted} />
              <Text style={[ts.emptyTxt, { fontFamily: T.font.sans }]}>Aucune transaction</Text>
              <Text style={[ts.emptySub, { fontFamily: T.font.sans }]}>Modifiez les filtres</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const ts = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.pageBg },
  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface,
    paddingHorizontal: 18, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn: { width: 38, height: 38, borderRadius: 11, backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.border, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: T.ink, fontSize: 20, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    margin: 14, marginBottom: 0,
    backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border,
    borderRadius: T.radius.md, paddingHorizontal: 14, height: 46, gap: 10,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 13, color: T.ink, fontWeight: "600" },
  clearBtn: { width: 24, height: 24, borderRadius: 7, backgroundColor: T.pageBg, justifyContent: "center", alignItems: "center" },
  filtersWrap: { marginTop: 12 },
  filtersList: { paddingHorizontal: 14, gap: 8 },
  filterPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: T.radius.md,
    backgroundColor: T.surface, borderWidth: 1.5, borderColor: T.border,
  },
  filterTxt: { fontSize: 11, fontWeight: "800" },
  filterCount: { minWidth: 18, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, alignItems: "center" },
  filterCountTxt: { fontSize: 10, fontWeight: "900" },
  list: { padding: 14 },
  empty: { alignItems: "center", paddingVertical: 50, gap: 8 },
  emptyTxt: { color: T.ink, fontSize: 17, fontWeight: "700" },
  emptySub: { color: T.inkMuted, fontSize: 13, fontWeight: "600" },
});