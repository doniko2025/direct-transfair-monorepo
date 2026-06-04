// apps/direct-transfair-mobile/app/agent/transactions.tsx
// =========================================================
// AGENT TRANSACTIONS v5.3 — Direct Transf'air
// ✅ v5.2 : retraits validés récupérés via /withdrawals
// ✅ FIX v5.3 : resolveAgentDirection — fallback "Transaction" → "Envoi d'argent"
//    AVANT : tout ce qui n'est pas REFILL/DEPOSIT/_agentPayout tombait dans
//            le fallback générique qui retournait label: "Transaction"
//    APRÈS  : le fallback distingue senderId === agentId → "Envoi d'argent"
//             vs recipientId === agentId → "Transfert reçu"
// ✅ FIX v5.3 : displayAmount — montant entrant avec conversion
//    AVANT : l'agent voyait le montant en devise expéditeur (EUR)
//    APRÈS  : si hasConversion && isIncoming → receivedAmount / targetCurrency
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity, SafeAreaView, StatusBar,
  Platform, Animated, TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import type { Transaction } from "../../services/types";

const C = {
  violet:      "#6C47FF", violetLight: "#F5F3FF", violetBorder: "#EDE9FE",
  heroGlass:   "rgba(255,255,255,0.14)", heroGlassBdr: "rgba(255,255,255,0.22)",
  heroDim:     "rgba(255,255,255,0.60)", heroGlow: "rgba(255,255,255,0.08)",
  pageBg:      "#F4F2FF", white: "#FFFFFF", cardBorder: "#EDE9FE",
  ink:         "#12082E", inkMid: "#4B3F72", inkSoft: "#8B80A8",
  green:       "#10B981", greenBg: "#ECFDF5", greenBorder: "#A7F3D0", greenDark: "#065F46",
  red:         "#EF4444", redBg: "#FEF2F2", redBorder: "#FECACA",
  blue:        "#3B82F6", blueBg: "#EFF6FF", blueBorder: "#BFDBFE",
  amber:       "#F59E0B", amberBg: "#FFFBEB", amberBorder: "#FDE68A",
  teal:        "#0F766E", tealBg:  "#CCFBF1", tealBorder: "#5EEAD4",
  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia",     android: "serif",           default: "serif"      }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium",default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",        default: "monospace"  }),
  },
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
  if (now.getTime() - d.getTime() < 86400000)
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// =========================================================
// LOGIQUE DIRECTION AGENT v5.3
// =========================================================
function resolveAgentDirection(tx: any, agentId: string): {
  isIncoming: boolean;
  label: string; sublabel: string;
  icon: string; iconBg: string; iconColor: string;
  badgeLabel: string; badgeColor: string; badgeBg: string; badgeBorder: string;
  amountSign: string; amountColor: string;
} {
  const type   = String(tx.type ?? "").toUpperCase();
  const status = String(tx.status ?? "").toUpperCase();
  const isRefill   = type === "AGENCY_REFILL" || type === "REFILL";
  const isDeposit  = type === "DEPOSIT";
  const isMyPayout = tx._agentPayout === true;

  if (isRefill) {
    return {
      isIncoming: true,
      label:   "Recharge caisse",
      sublabel: tx.sender
        ? `${tx.sender.firstName ?? ""} ${tx.sender.lastName ?? ""}`.trim()
        : "Admin",
      icon: "arrow-down-circle-outline", iconBg: C.tealBg, iconColor: C.teal,
      badgeLabel:  status === "PAID" ? "Reçu ✓"   : "En attente",
      badgeColor:  status === "PAID" ? C.teal   : C.amber,
      badgeBg:     status === "PAID" ? C.tealBg : C.amberBg,
      badgeBorder: status === "PAID" ? C.tealBorder : C.amberBorder,
      amountSign: "+", amountColor: C.teal,
    };
  }

  if (isDeposit) {
    return {
      isIncoming: false,
      label:   "Dépôt client",
      sublabel: tx.beneficiary?.fullName ?? tx.beneficiary?.phone ?? "Client",
      icon: "arrow-up-circle-outline", iconBg: C.amberBg, iconColor: C.amber,
      badgeLabel:  status === "PAID" ? "Déposé ✓" : "En attente",
      badgeColor:  status === "PAID" ? C.amber   : C.violet,
      badgeBg:     status === "PAID" ? C.amberBg : C.violetLight,
      badgeBorder: status === "PAID" ? C.amberBorder : C.violetBorder,
      amountSign: "−", amountColor: C.amber,
    };
  }

  if (isMyPayout) {
    return {
      isIncoming: false,
      label:    "Retrait client payé",
      sublabel: tx.beneficiary?.fullName
        ?? (tx.sender ? `${tx.sender?.firstName ?? ""} ${tx.sender?.lastName ?? ""}`.trim() : "Client"),
      icon: "cash-outline", iconBg: C.greenBg, iconColor: C.green,
      badgeLabel:  "Payé ✓",
      badgeColor:  C.green, badgeBg: C.greenBg, badgeBorder: C.greenBorder,
      amountSign: "−", amountColor: C.green,
    };
  }

  // ✅ FIX v5.3 — fallback générique
  // AVANT : toujours isIncoming=false, label="Transaction", amountColor=violet
  // APRÈS : on distingue selon senderId vs recipientId
  const isOutgoing = String(tx.senderId ?? "") === agentId;
  return {
    isIncoming: !isOutgoing,
    label:    isOutgoing ? "Envoi d'argent" : "Transfert reçu",
    sublabel: isOutgoing
      ? (tx.beneficiary?.fullName ?? tx.beneficiary?.phone ?? "Bénéficiaire")
      : (tx.sender?.firstName
          ? `${tx.sender.firstName} ${tx.sender.lastName ?? ""}`.trim()
          : "Expéditeur"),
    icon:    isOutgoing ? "paper-plane-outline"      : "arrow-down-circle-outline",
    iconBg:  isOutgoing ? C.redBg                    : C.greenBg,
    iconColor:isOutgoing ? C.red                     : C.green,
    badgeLabel:  status === "PAID" ? (isOutgoing ? "Payé ✓" : "Reçu ✓") : status,
    badgeColor:  isOutgoing ? C.green   : C.teal,
    badgeBg:     isOutgoing ? C.greenBg : C.tealBg,
    badgeBorder: isOutgoing ? C.greenBorder : C.tealBorder,
    amountSign:  isOutgoing ? "−" : "+",
    amountColor: isOutgoing ? C.red : C.green,
  };
}

// ─── Stat Card ───────────────────────────────────────────
function StatCard({ icon, label, value, accent, bg }: {
  icon: string; label: string; value: string; accent: string; bg: string;
}) {
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
  card:   { flex: 1, backgroundColor: C.white, borderRadius: C.r.md, padding: 12, alignItems: "center", borderWidth: 1, shadowColor: C.violet, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  iconBox:{ width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  value:  { fontSize: 18, fontWeight: "900", marginBottom: 2 },
  label:  { fontSize: 9, fontWeight: "800", color: C.inkSoft, letterSpacing: 0.8, textTransform: "uppercase", textAlign: "center" },
});

// ─── Tx Card ─────────────────────────────────────────────
function TxCard({ item, userId }: { item: Transaction; userId?: string }) {
  const router = useRouter();
  const scale  = useRef(new Animated.Value(1)).current;
  const tx     = item as any;

  const dir = resolveAgentDirection(tx, userId ?? "");

  const isMyPayout = tx._agentPayout === true;

  // ✅ FIX v5.3 — displayAmount pour les entrants avec conversion
  let displayAmount   = toNum(tx.amount);
  let displayCurrency = tx.currency ?? "XOF";

  if (isMyPayout && toNum(tx.receivedAmount) > 0) {
    // Retrait validé : montant en devise du bénéficiaire
    displayAmount   = toNum(tx.receivedAmount);
    displayCurrency = tx.targetCurrency ?? "GNF";
  } else if (
    dir.isIncoming &&
    tx.targetCurrency &&
    tx.targetCurrency !== tx.currency &&
    toNum(tx.receivedAmount) > 0
  ) {
    // Transfert entrant avec conversion : montant reçu en devise cible
    displayAmount   = toNum(tx.receivedAmount);
    displayCurrency = tx.targetCurrency;
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={tc.card}
        onPress={() => router.push({ pathname: "/(tabs)/transactions/[id]", params: { id: item.id } })}
        activeOpacity={1}
        onPressIn={() =>  Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={[tc.sideBar, { backgroundColor: dir.amountColor }]} />
        <View style={tc.content}>
          <View style={tc.topRow}>
            <View style={[tc.iconBox, { backgroundColor: dir.iconBg }]}>
              <Ionicons name={dir.icon as any} size={17} color={dir.iconColor} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[tc.label,    { fontFamily: C.font.sans }]}>{dir.label}</Text>
              <Text style={[tc.subLabel, { fontFamily: C.font.sans }]} numberOfLines={1}>{dir.sublabel}</Text>
            </View>
            <View style={tc.right}>
              <Text style={[tc.amount, { color: dir.amountColor, fontFamily: C.font.serif }]}>
                {dir.amountSign} {fmt(displayAmount, displayCurrency)}
              </Text>
              <Text style={[tc.currency, { color: dir.amountColor, fontFamily: C.font.mono }]}>
                {displayCurrency}
              </Text>
            </View>
          </View>
          <View style={tc.bottomRow}>
            <View style={tc.dateRow}>
              <Ionicons name="time-outline" size={11} color={C.inkSoft} />
              <Text style={[tc.date, { fontFamily: C.font.sans }]}>{fmtDate(item.createdAt)}</Text>
              {tx.reference && (
                <Text style={[tc.ref, { fontFamily: C.font.mono }]}>· {tx.reference.slice(0, 8)}</Text>
              )}
            </View>
            <View style={[tc.statusPill, { backgroundColor: dir.badgeBg, borderColor: dir.badgeBorder }]}>
              <Text style={[tc.statusTxt, { color: dir.badgeColor, fontFamily: C.font.sans }]}>
                {dir.badgeLabel}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const tc = StyleSheet.create({
  card:      { flexDirection: "row", backgroundColor: C.white, borderRadius: C.r.lg, marginBottom: 10, borderWidth: 1, borderColor: C.cardBorder, shadowColor: C.violet, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, overflow: "hidden" },
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
  dateRow:   { flexDirection: "row", alignItems: "center", gap: 5, flex: 1 },
  date:      { color: C.inkSoft, fontSize: 10, fontWeight: "600" },
  ref:       { color: C.inkSoft, fontSize: 9, fontWeight: "700" },
  statusPill:{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusTxt: { fontSize: 9, fontWeight: "900" },
});

// ─── Main ─────────────────────────────────────────────────
export default function AgentHistoryScreen() {
  const router   = useRouter();
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [q,            setQ]            = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadTransactions = useCallback(async () => {
    try {
      if (!user?.id) { setTransactions([]); setLoading(false); setRefreshing(false); return; }

      const myId = String(user.id);

      const [txList, wdList] = await Promise.allSettled([
        api.getTransactions(),
        api.getWithdrawals(),
      ]);

      const allTx: any[] = txList.status === "fulfilled" ? txList.value : [];
      const allWd: any[] = wdList.status === "fulfilled" ? wdList.value : [];

      const processedWithdrawals = allWd.filter(
        (w) => String(w.processedById ?? "") === myId && w.transactionId
      );
      const payoutTxIds = new Set(processedWithdrawals.map((w) => String(w.transactionId)));

      const myTxs: any[] = [];
      const seenIds = new Set<string>();

      for (const tx of allTx) {
        const type = String(tx.type ?? "").toUpperCase();
        const txId = String(tx.id);

        if (type === "AGENCY_REFILL" || type === "REFILL") {
          if (!seenIds.has(txId)) { seenIds.add(txId); myTxs.push(tx); }
          continue;
        }
        if (type === "DEPOSIT" && String(tx.senderId ?? "") === myId) {
          if (!seenIds.has(txId)) { seenIds.add(txId); myTxs.push(tx); }
          continue;
        }
        if (payoutTxIds.has(txId)) {
          if (!seenIds.has(txId)) {
            seenIds.add(txId);
            myTxs.push({ ...tx, _agentPayout: true });
          }
          continue;
        }
        if (String(tx.senderId ?? "") === myId) {
          if (!seenIds.has(txId)) { seenIds.add(txId); myTxs.push(tx); }
        }
      }

      for (const w of processedWithdrawals) {
        const txId = String(w.transactionId);
        if (!seenIds.has(txId)) {
          seenIds.add(txId);
          myTxs.push({
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

      myTxs.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setTransactions(myTxs);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    fadeAnim.setValue(0);
    void loadTransactions();
  }, [loadTransactions]));

  const onRefresh = () => { setRefreshing(true); void loadTransactions(); };

  const filtered = transactions.filter((tx) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    const t = tx as any;
    return (
      (t.reference ?? "").toLowerCase().includes(s) ||
      (t.beneficiary?.fullName ?? "").toLowerCase().includes(s) ||
      (t.beneficiary?.phone ?? "").toLowerCase().includes(s) ||
      `${t.sender?.firstName ?? ""} ${t.sender?.lastName ?? ""}`.toLowerCase().includes(s)
    );
  });

  const refillCount  = transactions.filter((tx) => { const t = String((tx as any).type ?? "").toUpperCase(); return t === "AGENCY_REFILL" || t === "REFILL"; }).length;
  const payoutCount  = transactions.filter((tx) => (tx as any)._agentPayout === true).length;
  const depositCount = transactions.filter((tx) => String((tx as any).type ?? "").toUpperCase() === "DEPOSIT").length;

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
            <Text style={[s.heroSub, { fontFamily: C.font.sans }]}>
              {filtered.length} opération{filtered.length > 1 ? "s" : ""}
            </Text>
          </View>
          <TouchableOpacity style={s.backBtn} onPress={onRefresh}>
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
      </View>

      {/* Mini stats */}
      {!loading && transactions.length > 0 && (
        <View style={s.statsRow}>
          <StatCard icon="arrow-down-circle-outline" label="Recharges" value={String(refillCount)}  accent={C.teal}  bg={C.tealBg}  />
          <StatCard icon="cash-outline"              label="Retraits"  value={String(payoutCount)}  accent={C.green} bg={C.greenBg} />
          <StatCard icon="arrow-up-circle-outline"   label="Dépôts"    value={String(depositCount)} accent={C.amber} bg={C.amberBg} />
        </View>
      )}

      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={C.violet} size="large" />
        </View>
      ) : (
        <Animated.FlatList
          style={{ opacity: fadeAnim }}
          data={filtered}
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
              <Text style={[s.emptySub, { fontFamily: C.font.sans }]}>
                {q ? "Modifiez votre recherche" : "Recharges, dépôts et retraits apparaîtront ici"}
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
  safe:   { flex: 1, backgroundColor: C.pageBg },
  hero:   { backgroundColor: C.violet, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 48 : 16, paddingBottom: 20, overflow: "hidden" },
  glow:   { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: C.heroGlow, top: -60, right: -40 },
  heroRow:{ flexDirection: "row", alignItems: "center", gap: 14 },
  backBtn:{ width: 38, height: 38, borderRadius: C.r.sm, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center" },
  pill:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, borderRadius: C.r.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 4 },
  pillDot:{ width: 4, height: 4, borderRadius: C.r.pill, backgroundColor: "#A5F3FC" },
  pillTxt:{ color: "#E8E0FF", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  heroTitle: { color: C.white, fontSize: 22, fontWeight: "700" },
  heroSub:   { color: C.heroDim, fontSize: 11, fontWeight: "600", marginTop: 2 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: C.r.md, paddingHorizontal: 14, marginTop: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 14, color: C.white, fontWeight: "600" },
  statsRow:  { flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.violetBorder },
  list:  { paddingHorizontal: 18, paddingTop: 16 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyIconBox: { width: 70, height: 70, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.violetBorder, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle:   { color: C.ink, fontSize: 17, fontWeight: "700" },
  emptySub:     { color: C.inkSoft, fontSize: 12, fontWeight: "600" },
});