// components/dashboards/ClientDashboard.tsx
// components/dashboards/ClientDashboard.tsx
import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  ScrollView, SafeAreaView, StatusBar, Platform, Animated,
  useWindowDimensions, ActivityIndicator, Dimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── Fonts ─────────────────────────────────────────────────────────────────
const F = {
  display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
  body: Platform.select({ ios: "System", android: "sans-serif", default: "sans-serif" }),
};

// ─── Palette ───────────────────────────────────────────────────────────────
const C = {
  g1: "#022C22", g2: "#064E3B", g3: "#065F46", g4: "#059669",
  g5: "#10B981", g6: "#34D399", gSoft: "#ECFDF5", gBorder: "#A7F3D0",
  white: "#FFFFFF",
  bg: "#F0FDF9",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  text: "#0F172A",
  textSub: "#374151",
  textMuted: "#64748B",
  textFaint: "#9CA3AF",
  blue: "#2563EB", blueSoft: "#EFF6FF",
  amber: "#D97706", amberSoft: "#FFFBEB", amberBorder: "#FEF3C7",
  purple: "#7C3AED", purpleSoft: "#F5F3FF",
  red: "#DC2626", redSoft: "#FEF2F2",
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}

function fmt(n: number) { return n.toLocaleString("fr-FR"); }

function fmtDate(d: string) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ─── Transaction Item ───────────────────────────────────────────────────────
function TxItem({ tx, currentUserId }: { tx: any; currentUserId?: string }) {
  const isOut = tx.senderId === currentUserId;
  const amount = toNum(tx.amount);
  const color = isOut ? C.red : C.g4;
  const bgColor = isOut ? C.redSoft : C.gSoft;
  const name = isOut
    ? tx.beneficiary?.fullName ?? tx.recipient?.firstName ?? "Bénéficiaire"
    : tx.sender?.firstName ?? "Expéditeur";
  const initial = (name[0] ?? "?").toUpperCase();

  const statusColors: Record<string, string> = {
    PAID: C.g4, VALIDATED: C.g4, PENDING: C.amber,
    CANCELLED: C.textFaint, FAILED: C.red,
  };
  const statusLabels: Record<string, string> = {
    PAID: "Payé", VALIDATED: "Validé", PENDING: "En cours",
    CANCELLED: "Annulé", FAILED: "Échoué",
  };
  const statusColor = statusColors[tx.status] ?? C.textFaint;
  const statusLabel = statusLabels[tx.status] ?? tx.status;

  return (
    <TouchableOpacity style={tS.row} activeOpacity={0.75}>
      {/* Avatar */}
      <View style={[tS.avatar, { backgroundColor: bgColor }]}>
        <Text style={[tS.avatarTxt, { color, fontFamily: F.display }]}>{initial}</Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[tS.name, { fontFamily: F.body }]} numberOfLines={1}>{name}</Text>
        <View style={tS.metaRow}>
          <Text style={[tS.date, { fontFamily: F.body }]}>{fmtDate(tx.createdAt)}</Text>
          <View style={[tS.statusPill, { backgroundColor: `${statusColor}15` }]}>
            <View style={[tS.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[tS.statusTxt, { color: statusColor, fontFamily: F.body }]}>{statusLabel}</Text>
          </View>
        </View>
      </View>

      {/* Amount */}
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[tS.amount, { color, fontFamily: F.display }]}>
          {isOut ? "−" : "+"} {fmt(amount)}
        </Text>
        <Text style={[tS.currency, { fontFamily: F.body }]}>{tx.currency}</Text>
      </View>
    </TouchableOpacity>
  );
}

const tS = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
  },
  avatarTxt: { fontSize: 17, fontWeight: "900" },
  name: { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  date: { fontSize: 11, color: C.textMuted, fontWeight: "600" },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99,
  },
  statusDot: { width: 5, height: 5, borderRadius: 99 },
  statusTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  amount: { fontSize: 15, letterSpacing: -0.3 },
  currency: { fontSize: 10, color: C.textFaint, fontWeight: "700", marginTop: 2 },
});

// ─── Quick Action Button ─────────────────────────────────────────────────────
function ActionBtn({
  icon, label, color, bg, onPress,
}: { icon: string; label: string; color: string; bg: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={aS.btn}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={[aS.iconBox, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={22} color={color} />
        </View>
        <Text style={[aS.label, { fontFamily: F.body }]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const aS = StyleSheet.create({
  btn: { alignItems: "center", gap: 7 },
  iconBox: {
    width: 56, height: 56, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  label: { fontSize: 11, fontWeight: "700", color: C.textSub, textAlign: "center" },
});

// ─── Stat Chip ───────────────────────────────────────────────────────────────
function StatChip({ icon, value, label, color }: {
  icon: string; value: string; label: string; color: string;
}) {
  return (
    <View style={scS.chip}>
      <Ionicons name={icon as any} size={15} color={color} />
      <Text style={[scS.val, { color, fontFamily: F.body }]}>{value}</Text>
      <Text style={[scS.lbl, { fontFamily: F.body }]}>{label}</Text>
    </View>
  );
}

const scS = StyleSheet.create({
  chip: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 12 },
  val: { fontSize: 14, fontWeight: "900" },
  lbl: { fontSize: 10, color: C.textMuted, fontWeight: "700", letterSpacing: 0.4 },
});

// ─── Main ────────────────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [refreshing, setRefreshing] = useState(false);
  const [recentTxs, setRecentTxs] = useState<any[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);
  const [showBalance, setShowBalance] = useState(true);

  // Animated values
  const heroAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  const firstName = user?.firstName ?? "Client";
  const balance = toNum(user?.balance);
  const currency = (user as any)?.currency ?? "XOF";

  // Stats dérivées des transactions
  const sentCount = recentTxs.filter((t) => t.senderId === user?.id).length;
  const totalSent = recentTxs
    .filter((t) => t.senderId === user?.id && t.status === "PAID")
    .reduce((acc, t) => acc + toNum(t.amount), 0);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshUser();
      const txs = await api.getTransactions();
      const safe = Array.isArray(txs) ? txs : [];
      const sorted = safe.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setRecentTxs(sorted.slice(0, 8));
    } catch (e) {
      console.error("Erreur txs:", e);
    } finally {
      setRefreshing(false);
      setLoadingTxs(false);
    }
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      // Entrance animation
      Animated.stagger(60, [
        Animated.spring(heroAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 3 }),
        Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 3 }),
      ]).start();
    }, [loadData])
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.g2} />

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.hDeco1} /><View style={s.hDeco2} />

        <View style={s.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={[s.greeting, { fontFamily: F.body }]}>Bon retour 👋</Text>
            <Text style={[s.hName, { fontFamily: F.display }]} numberOfLines={1}>
              {firstName}
            </Text>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity
              style={s.headerBtn}
              onPress={() => router.push("/(tabs)/notifications")}
            >
              <Ionicons name="notifications-outline" size={19} color={C.white} />
              <View style={s.notifDot} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.avatarBtn}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <Text style={[s.avatarTxt, { fontFamily: F.display }]}>
                {(firstName[0] ?? "C").toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance */}
        <Animated.View
          style={[
            s.balanceSection,
            {
              opacity: heroAnim,
              transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
        >
          <View style={s.balanceLabelRow}>
            <Text style={[s.balanceLbl, { fontFamily: F.body }]}>SOLDE DISPONIBLE</Text>
            <TouchableOpacity
              style={s.eyeBtn}
              onPress={() => setShowBalance(!showBalance)}
            >
              <Ionicons
                name={showBalance ? "eye-outline" : "eye-off-outline"}
                size={16}
                color="rgba(255,255,255,0.7)"
              />
            </TouchableOpacity>
          </View>

          <View style={s.balanceRow}>
            <Text style={[s.balanceAmt, { fontFamily: F.display }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {showBalance ? fmt(balance) : "••••••••"}
            </Text>
            <Text style={[s.balanceCur, { fontFamily: F.body }]}>{currency}</Text>
          </View>

          <View style={s.balanceDivider} />

          <View style={s.balanceBtns}>
            <TouchableOpacity style={s.balanceBtnWhite} onPress={() => router.push("/topup")}>
              <Ionicons name="add-circle-outline" size={16} color={C.g3} />
              <Text style={[s.balanceBtnWhiteTxt, { fontFamily: F.body }]}>Recharger</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.balanceBtnGhost}
              onPress={() => router.push("/(tabs)/transactions")}
            >
              <Ionicons name="list-outline" size={16} color="rgba(255,255,255,0.85)" />
              <Text style={[s.balanceBtnGhostTxt, { fontFamily: F.body }]}>Historique</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, isDesktop && s.scrollDesktop]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={C.g4} />
        }
      >
        <Animated.View
          style={{
            opacity: contentAnim,
            transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          }}
        >
          {/* ── Stats strip ── */}
          <View style={s.statsStrip}>
            <StatChip
              icon="paper-plane-outline"
              value={String(sentCount)}
              label="Envois"
              color={C.g4}
            />
            <View style={s.statsDiv} />
            <StatChip
              icon="cash-outline"
              value={totalSent > 0 ? `${fmt(Math.round(totalSent / 1000))}K` : "—"}
              label="Total envoyé"
              color={C.blue}
            />
            <View style={s.statsDiv} />
            <StatChip
              icon="checkmark-circle-outline"
              value={recentTxs.filter((t) => t.status === "PAID").length > 0
                ? `${recentTxs.filter((t) => t.status === "PAID").length}`
                : "—"}
              label="Réussis"
              color={C.g5}
            />
          </View>

          {/* ── Actions rapides ── */}
          <View style={s.actionsCard}>
            <ActionBtn
              icon="paper-plane-outline"
              label="Envoyer"
              color={C.g4}
              bg={C.gSoft}
              onPress={() => router.push("/(tabs)/send")}
            />
            <View style={s.actionsSep} />
            <ActionBtn
              icon="people-outline"
              label="Contacts"
              color={C.blue}
              bg={C.blueSoft}
              onPress={() => router.push("/(tabs)/beneficiaries")}
            />
            <View style={s.actionsSep} />
            <ActionBtn
              icon="qr-code-outline"
              label="QR Code"
              color={C.amber}
              bg={C.amberSoft}
              onPress={() => router.push("/(tabs)/qr")}
            />
            <View style={s.actionsSep} />
            <ActionBtn
              icon="card-outline"
              label="Recharger"
              color={C.purple}
              bg={C.purpleSoft}
              onPress={() => router.push("/topup")}
            />
          </View>

          {/* ── Promo Banner ── */}
          <TouchableOpacity
            style={s.promo}
            activeOpacity={0.9}
            onPress={() => router.push("/(tabs)/send")}
          >
            <View style={s.promoIconBox}>
              <Text style={{ fontSize: 22 }}>🎁</Text>
            </View>
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <Text style={[s.promoTitle, { fontFamily: F.body }]}>
                Transferts gratuits ce week-end
              </Text>
              <Text style={[s.promoSub, { fontFamily: F.body }]}>
                0 frais vers toutes les destinations
              </Text>
            </View>
            <View style={s.promoArrow}>
              <Ionicons name="arrow-forward" size={14} color={C.amber} />
            </View>
          </TouchableOpacity>

          {/* ── Transactions récentes ── */}
          <View style={s.txCard}>
            <View style={s.txCardHeader}>
              <View style={s.txCardTitleRow}>
                <View style={s.txCardDot} />
                <Text style={[s.txCardTitle, { fontFamily: F.body }]}>
                  Transactions récentes
                </Text>
              </View>
              <TouchableOpacity
                style={s.seeAllBtn}
                onPress={() => router.push("/(tabs)/transactions")}
              >
                <Text style={[s.seeAllTxt, { fontFamily: F.body }]}>Voir tout</Text>
                <Ionicons name="chevron-forward" size={13} color={C.g4} />
              </TouchableOpacity>
            </View>

            {loadingTxs && !refreshing ? (
              <ActivityIndicator color={C.g4} style={{ marginVertical: 28 }} />
            ) : recentTxs.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIconBox}>
                  <Ionicons name="swap-horizontal-outline" size={28} color={C.textFaint} />
                </View>
                <Text style={[s.emptyTitle, { fontFamily: F.body }]}>
                  Aucune transaction
                </Text>
                <Text style={[s.emptySub, { fontFamily: F.body }]}>
                  Vos envois apparaîtront ici
                </Text>
                <TouchableOpacity
                  style={s.emptyBtn}
                  onPress={() => router.push("/(tabs)/send")}
                >
                  <Text style={[s.emptyBtnTxt, { fontFamily: F.body }]}>
                    Faire un transfert →
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {recentTxs.map((tx) => (
                  <TxItem key={tx.id} tx={tx} currentUserId={user?.id} />
                ))}
                <TouchableOpacity
                  style={s.viewMoreBtn}
                  onPress={() => router.push("/(tabs)/transactions")}
                >
                  <Text style={[s.viewMoreTxt, { fontFamily: F.body }]}>
                    Voir toutes les transactions
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={C.g4} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ── Security badge ── */}
          <View style={s.secBadge}>
            <Ionicons name="shield-checkmark-outline" size={13} color={C.g5} />
            <Text style={[s.secTxt, { fontFamily: F.body }]}>
              Compte sécurisé · Direct Transf'air
            </Text>
          </View>

          <View style={{ height: 110 }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    backgroundColor: C.g3,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 12,
    paddingBottom: 28,
    overflow: "hidden",
  },
  hDeco1: {
    position: "absolute", width: 220, height: 220, borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.05)", top: -60, right: -50,
  },
  hDeco2: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.04)", bottom: -20, left: 30,
  },
  headerTop: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between", marginBottom: 20,
  },
  greeting: {
    color: "rgba(255,255,255,0.7)", fontSize: 13,
    fontWeight: "600", marginBottom: 3,
  },
  hName: {
    color: C.white, fontSize: 28, letterSpacing: -0.4, lineHeight: 32,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
  },
  notifDot: {
    position: "absolute", top: 9, right: 9, width: 8, height: 8,
    borderRadius: 99, backgroundColor: C.red, borderWidth: 1.5, borderColor: C.g3,
  },
  avatarBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: C.white, justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 4, elevation: 3,
  },
  avatarTxt: { color: C.g3, fontSize: 17, fontWeight: "900" },

  // Balance
  balanceSection: {},
  balanceLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  balanceLbl: {
    color: "rgba(255,255,255,0.65)", fontSize: 10,
    fontWeight: "800", letterSpacing: 1.2,
  },
  eyeBtn: { padding: 4 },
  balanceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 2 },
  balanceAmt: {
    color: C.white, fontSize: 40, letterSpacing: -1.2, flexShrink: 1,
  },
  balanceCur: {
    color: "rgba(255,255,255,0.65)", fontSize: 16, fontWeight: "700",
  },
  balanceDivider: {
    height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: 16,
  },
  balanceBtns: { flexDirection: "row", gap: 12 },
  balanceBtnWhite: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, backgroundColor: C.white, borderRadius: 13, paddingVertical: 12,
  },
  balanceBtnWhiteTxt: { color: C.g3, fontWeight: "800", fontSize: 13 },
  balanceBtnGhost: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 13, paddingVertical: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  balanceBtnGhostTxt: { color: "rgba(255,255,255,0.9)", fontWeight: "800", fontSize: 13 },

  // Scroll
  scroll: { paddingHorizontal: 16, paddingTop: 18 },
  scrollDesktop: { maxWidth: 800, alignSelf: "center", width: "100%" },

  // Stats strip
  statsStrip: {
    flexDirection: "row", backgroundColor: C.surface, borderRadius: 18,
    borderWidth: 1, borderColor: C.border, marginBottom: 16, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  statsDiv: { width: 1, backgroundColor: C.border, marginVertical: 10 },

  // Actions
  actionsCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.surface, borderRadius: 22, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  actionsSep: { width: 1, height: 44, backgroundColor: C.border },

  // Promo
  promo: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.amberSoft, borderRadius: 18,
    borderWidth: 1, borderColor: C.amberBorder,
    padding: 16, marginBottom: 16,
  },
  promoIconBox: {
    width: 46, height: 46, borderRadius: 14, backgroundColor: "#FEF3C7",
    justifyContent: "center", alignItems: "center",
  },
  promoTitle: { fontSize: 13, fontWeight: "800", color: C.amber, marginBottom: 3 },
  promoSub: { fontSize: 11, color: "#B45309", fontWeight: "600" },
  promoArrow: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: "#FEF3C7",
    justifyContent: "center", alignItems: "center",
  },

  // Transactions card
  txCard: {
    backgroundColor: C.surface, borderRadius: 22,
    borderWidth: 1, borderColor: C.border, padding: 18,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    marginBottom: 14,
  },
  txCardHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 12,
  },
  txCardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  txCardDot: {
    width: 8, height: 8, borderRadius: 99, backgroundColor: C.g4,
  },
  txCardTitle: { fontSize: 14, fontWeight: "800", color: C.text },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  seeAllTxt: { fontSize: 12, fontWeight: "700", color: C.g4 },

  // Empty state
  empty: { alignItems: "center", paddingVertical: 28, gap: 6 },
  emptyIconBox: {
    width: 60, height: 60, borderRadius: 18, backgroundColor: C.borderLight,
    justifyContent: "center", alignItems: "center", marginBottom: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: "800", color: C.text },
  emptySub: { fontSize: 12, color: C.textMuted, fontWeight: "600" },
  emptyBtn: {
    marginTop: 12, backgroundColor: C.gSoft, borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 10,
    borderWidth: 1, borderColor: C.gBorder,
  },
  emptyBtnTxt: { fontSize: 13, color: C.g4, fontWeight: "800" },

  // View more
  viewMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingTop: 16, marginTop: 4,
    borderTopWidth: 1, borderTopColor: C.borderLight,
  },
  viewMoreTxt: { fontSize: 13, color: C.g4, fontWeight: "700" },

  // Security
  secBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 6,
  },
  secTxt: { fontSize: 11, color: C.textMuted, fontWeight: "600" },
});