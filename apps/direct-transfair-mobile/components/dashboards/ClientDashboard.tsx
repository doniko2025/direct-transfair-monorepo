// components/dashboards/ClientDashboard.tsx
// apps/direct-transfair-mobile/components/dashboards/ClientDashboard.tsx
// =========================================================
// CLIENT DASHBOARD — Direct Transf'air v4.0
// Design: Émeraude Profond — vert forêt + blanc perle + or fin
// ✅ Devise locale uniquement (user.primaryCurrency)
// ✅ Wallet personnel affiché
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  ScrollView, SafeAreaView, StatusBar, Platform, Animated,
  useWindowDimensions, ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

// ─── Design Tokens ──────────────────────────────────────
const T = {
  forest:    "#0B1F14",
  forestMid: "#0F2A1C",
  forestL:   "#163523",
  forestB:   "#1E4A30",
  emerald:   "#059669",
  emeraldL:  "#10B981",
  emeraldLL: "#34D399",
  gold:      "#D97706",
  goldSoft:  "#F59E0B",
  ivory:     "#FAFAF5",
  ivoryDim:  "#C8D8C8",
  white:     "#FFFFFF",
  ghost:     "rgba(255,255,255,0.06)",
  ghostMid:  "rgba(255,255,255,0.10)",
  red:       "#EF4444",
  blue:      "#60A5FA",
  amber:     "#F59E0B",
  purple:    "#A78BFA",

  radius: { sm: 10, md: 16, lg: 22, xl: 28 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Helpers ────────────────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  } catch { return n.toFixed(d); }
}

function fmtDate(d: string): string {
  const date = new Date(d);
  const today = new Date();
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yest.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ─── TX Status Config ────────────────────────────────────
const TX_STATUS: Record<string, { color: string; label: string }> = {
  PAID:      { color: T.emeraldL,  label: "Payé" },
  VALIDATED: { color: T.emeraldL,  label: "Validé" },
  PENDING:   { color: T.amber,     label: "En cours" },
  PROCESSING:{ color: T.blue,      label: "Traitement" },
  CANCELLED: { color: "#94A3B8",   label: "Annulé" },
  FAILED:    { color: T.red,       label: "Échoué" },
  REFUNDED:  { color: T.purple,    label: "Remboursé" },
};

// ─── Transaction Row ─────────────────────────────────────
function TxRow({ tx, userId }: { tx: any; userId?: string }) {
  const isOut = tx.senderId === userId;
  const amount = toNum(tx.amount);
  const color = isOut ? T.red : T.emeraldL;
  const name = isOut
    ? (tx.beneficiary?.fullName ?? tx.recipient?.firstName ?? "Bénéficiaire")
    : (tx.sender?.firstName ?? "Expéditeur");
  const st = TX_STATUS[tx.status] ?? { color: "#94A3B8", label: tx.status };

  return (
    <TouchableOpacity style={txS.row} activeOpacity={0.7}>
      <View style={[txS.avatar, { backgroundColor: `${color}15` }]}>
        <Text style={[txS.avatarTxt, { color, fontFamily: T.font.display }]}>
          {(name[0] ?? "?").toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[txS.name, { fontFamily: T.font.sans }]} numberOfLines={1}>{name}</Text>
        <View style={txS.meta}>
          <Text style={[txS.date, { fontFamily: T.font.sans }]}>{fmtDate(tx.createdAt)}</Text>
          <View style={[txS.pill, { backgroundColor: `${st.color}15` }]}>
            <View style={[txS.pillDot, { backgroundColor: st.color }]} />
            <Text style={[txS.pillTxt, { color: st.color, fontFamily: T.font.sans }]}>{st.label}</Text>
          </View>
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[txS.amount, { color, fontFamily: T.font.display }]}>
          {isOut ? "−" : "+"}{fmt(amount, tx.currency)}
        </Text>
        <Text style={[txS.currency, { fontFamily: T.font.mono }]}>{tx.currency}</Text>
      </View>
    </TouchableOpacity>
  );
}

const txS = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
  },
  avatar: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
  },
  avatarTxt: { fontSize: 18, fontWeight: "900" },
  name: { fontSize: 14, fontWeight: "700", color: T.white, marginBottom: 4 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  date: { fontSize: 11, color: T.ivoryDim, fontWeight: "600" },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99,
  },
  pillDot: { width: 4, height: 4, borderRadius: 99 },
  pillTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  amount: { fontSize: 15, letterSpacing: -0.3 },
  currency: { fontSize: 10, color: T.ivoryDim, fontWeight: "700", marginTop: 2 },
});

// ─── Action Button ───────────────────────────────────────
function ActionBtn({ icon, label, color, bg, onPress }: {
  icon: string; label: string; color: string; bg: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={abS.btn} onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.87, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={[abS.iconBox, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={22} color={color} />
        </View>
        <Text style={[abS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const abS = StyleSheet.create({
  btn: { alignItems: "center", gap: 8 },
  iconBox: {
    width: 56, height: 56, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 3,
  },
  label: { fontSize: 11, fontWeight: "800", color: T.ivoryDim, textAlign: "center" },
});

// ─── Stat Chip ───────────────────────────────────────────
function StatChip({ icon, value, label, color }: any) {
  return (
    <View style={scS.chip}>
      <View style={[scS.iconMini, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={[scS.val, { color, fontFamily: T.font.mono }]}>{value}</Text>
      <Text style={[scS.lbl, { fontFamily: T.font.sans }]}>{label}</Text>
    </View>
  );
}

const scS = StyleSheet.create({
  chip: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 14 },
  iconMini: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  val: { fontSize: 15, fontWeight: "900" },
  lbl: { fontSize: 10, color: T.ivoryDim, fontWeight: "700", letterSpacing: 0.4 },
});

// ─── Main ────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [refreshing, setRefreshing] = useState(false);
  const [txs, setTxs] = useState<any[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);
  const [showBalance, setShowBalance] = useState(true);

  const heroAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  const firstName = user?.firstName ?? "Client";

  // ✅ Devise locale uniquement (primaryCurrency du user)
  const primaryCurrency = (user as any)?.primaryCurrency ?? "XOF";

  // Wallet dans la devise principale
  const wallets = (user as any)?.wallets ?? [];
  const mainWallet = wallets.find((w: any) => w.currency === primaryCurrency)
    ?? wallets.find((w: any) => w.isDefault)
    ?? wallets[0];
  const balance = toNum(mainWallet?.balance ?? (user as any)?.balance);
  const reservedBalance = toNum(mainWallet?.reservedBalance ?? 0);
  const availableBalance = balance - reservedBalance;

  const sentCount = txs.filter((t) => t.senderId === user?.id).length;
  const totalSent = txs
    .filter((t) => t.senderId === user?.id && t.status === "PAID")
    .reduce((acc, t) => acc + toNum(t.amount), 0);
  const successCount = txs.filter((t) => t.status === "PAID").length;

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshUser();
      const raw = await api.getTransactions();
      const safe = Array.isArray(raw) ? raw : [];
      setTxs(safe.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8));
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); setLoadingTxs(false); }
  }, [refreshUser]);

  useFocusEffect(useCallback(() => {
    void loadData();
    Animated.stagger(80, [
      Animated.spring(heroAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }),
      Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }),
    ]).start();
  }, [loadData]));

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={T.forest} />

      {/* ── Header ── */}
      <LinearGradient
        colors={[T.forest, T.forestMid]}
        style={s.header}
      >
        {/* Décors */}
        <View style={s.deco1} /><View style={s.deco2} />

        <View style={s.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={[s.greeting, { fontFamily: T.font.sans }]}>Bon retour 👋</Text>
            <Text style={[s.hName, { fontFamily: T.font.display }]} numberOfLines={1}>{firstName}</Text>
          </View>
          <View style={s.hRight}>
            <TouchableOpacity style={s.hBtn} onPress={() => router.push("/(tabs)/notifications")}>
              <Ionicons name="notifications-outline" size={18} color={T.white} />
              <View style={s.notifDot} />
            </TouchableOpacity>
            <TouchableOpacity style={s.avatarBtn} onPress={() => router.push("/(tabs)/profile")}>
              <LinearGradient colors={[T.emerald, T.emeraldL]} style={s.avatarGrad}>
                <Text style={[s.avatarTxt, { fontFamily: T.font.display }]}>
                  {(firstName[0] ?? "C").toUpperCase()}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance hero */}
        <Animated.View
          style={[
            s.balanceSection,
            {
              opacity: heroAnim,
              transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
            },
          ]}
        >
          <View style={s.balLabelRow}>
            <Text style={[s.balLabel, { fontFamily: T.font.sans }]}>
              SOLDE DISPONIBLE · {primaryCurrency}
            </Text>
            <TouchableOpacity onPress={() => setShowBalance(!showBalance)} style={s.eyeBtn}>
              <Ionicons
                name={showBalance ? "eye-outline" : "eye-off-outline"}
                size={15} color="rgba(255,255,255,0.5)"
              />
            </TouchableOpacity>
          </View>

          <View style={s.balRow}>
            <Text style={[s.balAmount, { fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
              {showBalance ? fmt(availableBalance, primaryCurrency) : "••••••"}
            </Text>
            <Text style={[s.balCur, { fontFamily: T.font.sans }]}>{primaryCurrency}</Text>
          </View>

          {reservedBalance > 0 && (
            <Text style={[s.balReserved, { fontFamily: T.font.sans }]}>
              {fmt(reservedBalance, primaryCurrency)} {primaryCurrency} réservé
            </Text>
          )}

          <View style={s.balDivider} />

          <View style={s.balBtns}>
            <TouchableOpacity style={s.balBtnSolid} onPress={() => router.push("/topup")} activeOpacity={0.85}>
              <Ionicons name="add-circle-outline" size={15} color={T.forest} />
              <Text style={[s.balBtnSolidTxt, { fontFamily: T.font.sans }]}>Recharger</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.balBtnGhost} onPress={() => router.push("/(tabs)/transactions")} activeOpacity={0.85}>
              <Ionicons name="list-outline" size={15} color="rgba(255,255,255,0.85)" />
              <Text style={[s.balBtnGhostTxt, { fontFamily: T.font.sans }]}>Historique</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, isDesktop && s.scrollDesktop]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={T.emeraldL} />}
      >
        <Animated.View
          style={{
            opacity: contentAnim,
            transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) }],
          }}
        >
          {/* Stats Strip */}
          <View style={s.statsStrip}>
            <StatChip icon="paper-plane-outline" value={String(sentCount)} label="Envois" color={T.emeraldL} />
            <View style={s.statsDivider} />
            <StatChip
              icon="cash-outline"
              value={totalSent > 0 ? `${fmt(Math.round(totalSent / 1000), primaryCurrency)}K` : "—"}
              label="Vol. envoyé"
              color={T.blue}
            />
            <View style={s.statsDivider} />
            <StatChip icon="checkmark-circle-outline" value={successCount > 0 ? String(successCount) : "—"} label="Réussis" color={T.goldSoft} />
          </View>

          {/* Actions rapides */}
          <View style={s.actionsCard}>
            <ActionBtn icon="paper-plane-outline" label="Envoyer" color={T.emeraldL} bg={`${T.emeraldL}15`} onPress={() => router.push("/(tabs)/send")} />
            <View style={s.actionsSep} />
            <ActionBtn icon="people-outline" label="Contacts" color={T.blue} bg={`${T.blue}15`} onPress={() => router.push("/(tabs)/beneficiaries")} />
            <View style={s.actionsSep} />
            <ActionBtn icon="qr-code-outline" label="QR Code" color={T.gold} bg={`${T.gold}15`} onPress={() => router.push("/(tabs)/qr")} />
            <View style={s.actionsSep} />
            <ActionBtn icon="card-outline" label="Recharger" color={T.purple} bg={`${T.purple}15`} onPress={() => router.push("/topup")} />
          </View>

          {/* Promo Banner */}
          <TouchableOpacity style={s.promo} activeOpacity={0.88} onPress={() => router.push("/(tabs)/send")}>
            <LinearGradient
              colors={["#064E3B", "#065F46"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.promoGrad}
            >
              <View style={s.promoIconBox}>
                <Text style={{ fontSize: 22 }}>🎁</Text>
              </View>
              <View style={{ flex: 1, paddingHorizontal: 12 }}>
                <Text style={[s.promoTitle, { fontFamily: T.font.sans }]}>
                  Transferts gratuits ce week-end
                </Text>
                <Text style={[s.promoSub, { fontFamily: T.font.sans }]}>
                  0 frais vers toutes les destinations
                </Text>
              </View>
              <View style={s.promoArrow}>
                <Ionicons name="arrow-forward" size={14} color={T.emeraldL} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Transactions récentes */}
          <View style={s.txCard}>
            <View style={s.txCardHeader}>
              <View style={s.txCardTitleRow}>
                <View style={s.txCardDot} />
                <Text style={[s.txCardTitle, { fontFamily: T.font.sans }]}>Transactions récentes</Text>
              </View>
              <TouchableOpacity style={s.seeAllBtn} onPress={() => router.push("/(tabs)/transactions")}>
                <Text style={[s.seeAllTxt, { fontFamily: T.font.sans }]}>Voir tout</Text>
                <Ionicons name="chevron-forward" size={13} color={T.emeraldL} />
              </TouchableOpacity>
            </View>

            {loadingTxs && !refreshing ? (
              <ActivityIndicator color={T.emeraldL} style={{ marginVertical: 28 }} />
            ) : txs.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIconBox}>
                  <Ionicons name="swap-horizontal-outline" size={28} color={T.ivoryDim} />
                </View>
                <Text style={[s.emptyTitle, { fontFamily: T.font.sans }]}>Aucune transaction</Text>
                <Text style={[s.emptySub, { fontFamily: T.font.sans }]}>Vos envois apparaîtront ici</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => router.push("/(tabs)/send")}>
                  <Text style={[s.emptyBtnTxt, { fontFamily: T.font.sans }]}>Faire un transfert →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {txs.map((tx) => <TxRow key={tx.id} tx={tx} userId={user?.id} />)}
                <TouchableOpacity style={s.viewMoreBtn} onPress={() => router.push("/(tabs)/transactions")}>
                  <Text style={[s.viewMoreTxt, { fontFamily: T.font.sans }]}>Voir toutes les transactions</Text>
                  <Ionicons name="arrow-forward" size={13} color={T.emeraldL} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Sécurité badge */}
          <View style={s.secBadge}>
            <Ionicons name="shield-checkmark-outline" size={12} color={T.emeraldL} />
            <Text style={[s.secTxt, { fontFamily: T.font.sans }]}>Compte sécurisé · Direct Transf'air™</Text>
          </View>

          <View style={{ height: 110 }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.forestMid },

  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 12,
    paddingBottom: 28,
    overflow: "hidden",
  },
  deco1: {
    position: "absolute", width: 240, height: 240, borderRadius: 120,
    backgroundColor: "rgba(16,185,129,0.06)", top: -80, right: -60,
  },
  deco2: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(16,185,129,0.04)", bottom: -20, left: 20,
  },
  headerTop: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24,
  },
  greeting: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600", marginBottom: 3 },
  hName: { color: T.white, fontSize: 28, letterSpacing: -0.3, lineHeight: 32 },
  hRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  hBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.forestB,
    justifyContent: "center", alignItems: "center",
  },
  notifDot: {
    position: "absolute", top: 9, right: 9, width: 7, height: 7,
    borderRadius: 99, backgroundColor: T.red, borderWidth: 1.5, borderColor: T.forest,
  },
  avatarBtn: {},
  avatarGrad: {
    width: 40, height: 40, borderRadius: 13,
    justifyContent: "center", alignItems: "center",
  },
  avatarTxt: { color: T.white, fontSize: 18, fontWeight: "900" },

  balanceSection: {},
  balLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  balLabel: { color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  eyeBtn: { padding: 4 },
  balRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 4 },
  balAmount: { color: T.white, fontSize: 40, letterSpacing: -1, flexShrink: 1 },
  balCur: { color: T.emeraldLL, fontSize: 15, fontWeight: "800" },
  balReserved: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "600", marginBottom: 4 },
  balDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.10)", marginVertical: 18 },
  balBtns: { flexDirection: "row", gap: 12 },
  balBtnSolid: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, backgroundColor: T.white, borderRadius: 13, paddingVertical: 13,
  },
  balBtnSolidTxt: { color: T.forest, fontWeight: "900", fontSize: 13 },
  balBtnGhost: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, backgroundColor: T.ghost, borderRadius: 13, paddingVertical: 13,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  balBtnGhostTxt: { color: "rgba(255,255,255,0.9)", fontWeight: "900", fontSize: 13 },

  scroll: { paddingHorizontal: 16, paddingTop: 18 },
  scrollDesktop: { maxWidth: 800, alignSelf: "center", width: "100%" },

  statsStrip: {
    flexDirection: "row", backgroundColor: T.forestL, borderRadius: 18,
    borderWidth: 1, borderColor: T.forestB, marginBottom: 16, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  statsDivider: { width: 1, backgroundColor: T.forestB, marginVertical: 8 },

  actionsCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.forestL, borderRadius: 22, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: T.forestB,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
  },
  actionsSep: { width: 1, height: 44, backgroundColor: T.forestB },

  promo: { borderRadius: 18, overflow: "hidden", marginBottom: 16 },
  promoGrad: {
    flexDirection: "row", alignItems: "center", padding: 16,
    borderWidth: 1, borderColor: T.forestB,
  },
  promoIconBox: {
    width: 44, height: 44, borderRadius: 13, backgroundColor: T.ghost,
    justifyContent: "center", alignItems: "center",
  },
  promoTitle: { fontSize: 13, fontWeight: "800", color: T.white, marginBottom: 3 },
  promoSub: { fontSize: 11, color: T.ivoryDim, fontWeight: "600" },
  promoArrow: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: T.ghost,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.forestB,
  },

  txCard: {
    backgroundColor: T.forestL, borderRadius: 22, padding: 18,
    borderWidth: 1, borderColor: T.forestB, marginBottom: 14,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
  },
  txCardHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12,
  },
  txCardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  txCardDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: T.emeraldL },
  txCardTitle: { fontSize: 14, fontWeight: "800", color: T.white },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  seeAllTxt: { fontSize: 12, fontWeight: "700", color: T.emeraldL },

  empty: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyIconBox: {
    width: 60, height: 60, borderRadius: 18, backgroundColor: T.ghost,
    justifyContent: "center", alignItems: "center", marginBottom: 4,
    borderWidth: 1, borderColor: T.forestB,
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: T.white },
  emptySub: { fontSize: 12, color: T.ivoryDim, fontWeight: "600" },
  emptyBtn: {
    marginTop: 10, backgroundColor: `${T.emeraldL}15`, borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 10,
    borderWidth: 1, borderColor: `${T.emeraldL}30`,
  },
  emptyBtnTxt: { fontSize: 13, color: T.emeraldL, fontWeight: "800" },

  viewMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingTop: 16, marginTop: 4,
    borderTopWidth: 1, borderTopColor: T.forestB,
  },
  viewMoreTxt: { fontSize: 13, color: T.emeraldL, fontWeight: "700" },

  secBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 8,
  },
  secTxt: { fontSize: 11, color: T.ivoryDim, fontWeight: "600" },
});