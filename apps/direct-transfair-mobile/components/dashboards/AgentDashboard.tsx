// components/dashboards/AgentDashboard.tsx
// apps/direct-transfair-mobile/components/dashboards/AgentDashboard.tsx
// =========================================================
// AGENT DASHBOARD — Direct Transf'air v4.0
// Design: Forge & Ambre — terre brûlée + ambre chaud
// ✅ Devise locale uniquement (agence.primaryCurrency)
// ✅ Wallet agence en temps réel
// =========================================================

import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  ScrollView, SafeAreaView, StatusBar, Animated, Platform, useWindowDimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

// ─── Design Tokens ──────────────────────────────────────
const T = {
  forge:     "#1A0E00",
  forgeMid:  "#211200",
  forgeLight:"#2D1800",
  forgeBorder:"#3D2200",
  amber:     "#D97706",
  amberL:    "#F59E0B",
  amberGlow: "rgba(217,119,6,0.15)",
  amberPale: "#FFF7ED",
  copper:    "#C2510C",
  rust:      "#92400E",
  cream:     "#FEF3C7",
  creamDim:  "#B79A60",
  white:     "#FFFFFF",
  ghost:     "rgba(255,255,255,0.05)",
  ghostMid:  "rgba(255,255,255,0.09)",
  ghostHi:   "rgba(255,255,255,0.16)",
  green:     "#22C55E",
  red:       "#EF4444",
  blue:      "#60A5FA",
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

function fmt(n: number, currency: string): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  } catch { return n.toFixed(d); }
}

// ─── Operation Card ──────────────────────────────────────
function OpCard({ title, subtitle, icon, color, bgColor, onPress, badge }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, minWidth: "45%", transform: [{ scale }] }}>
      <TouchableOpacity
        style={opS.card} onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={[opS.iconBox, { backgroundColor: bgColor }]}>
          <Ionicons name={icon} size={26} color={color} />
        </View>
        {badge && (
          <View style={[opS.badge, { backgroundColor: `${color}20`, borderColor: `${color}30` }]}>
            <Text style={[opS.badgeTxt, { color, fontFamily: T.font.sans }]}>{badge}</Text>
          </View>
        )}
        <Text style={[opS.title, { fontFamily: T.font.sans }]}>{title}</Text>
        <Text style={[opS.sub, { fontFamily: T.font.sans }]} numberOfLines={1}>{subtitle}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const opS = StyleSheet.create({
  card: {
    backgroundColor: T.forgeLight, borderRadius: T.radius.lg,
    padding: 18, borderWidth: 1, borderColor: T.forgeBorder,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    overflow: "hidden",
  },
  iconBox: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: "center", alignItems: "center", marginBottom: 14,
  },
  badge: {
    position: "absolute", top: 12, right: 12,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1,
  },
  badgeTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  title: { fontSize: 14, fontWeight: "800", color: T.white, marginBottom: 4 },
  sub: { fontSize: 11, color: T.creamDim, fontWeight: "600" },
});

// ─── Report Row ──────────────────────────────────────────
function ReportRow({ title, subtitle, icon, color, bgColor, onPress, value }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 12 }}>
      <TouchableOpacity
        style={rrS.row} onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={[rrS.iconBox, { backgroundColor: bgColor }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[rrS.title, { fontFamily: T.font.sans }]}>{title}</Text>
          <Text style={[rrS.sub, { fontFamily: T.font.sans }]}>{subtitle}</Text>
        </View>
        {value && (
          <Text style={[rrS.value, { color, fontFamily: T.font.mono }]}>{value}</Text>
        )}
        <View style={[rrS.arrow, { backgroundColor: `${color}10` }]}>
          <Ionicons name="chevron-forward" size={14} color={color} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const rrS = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.forgeLight, borderRadius: T.radius.md,
    padding: 16, borderWidth: 1, borderColor: T.forgeBorder,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
    gap: 14,
  },
  iconBox: { width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 14, fontWeight: "800", color: T.white, marginBottom: 2 },
  sub: { fontSize: 11, color: T.creamDim, fontWeight: "600" },
  value: { fontSize: 13, fontWeight: "900" },
  arrow: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
});

// ─── Main ────────────────────────────────────────────────
export default function AgentDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [refreshing, setRefreshing] = useState(false);
  const [agencyData, setAgencyData] = useState<any>(null);

  // ✅ Devise locale uniquement (agence)
  const agencyName = agencyData?.name ?? user?.agency?.name ?? "Mon Agence";
  const currency = agencyData?.primaryCurrency ?? (agencyData?.wallets?.[0]?.currency) ?? "XOF";

  // Wallet agence (première devise disponible, la devise locale)
  const agencyWallet = Array.isArray(agencyData?.wallets)
    ? (agencyData.wallets.find((w: any) => w.isDefault) ?? agencyData.wallets[0])
    : null;
  const balance = toNum(agencyWallet?.balance ?? agencyData?.balance);
  const reserved = toNum(agencyWallet?.reservedBalance ?? 0);
  const available = balance - reserved;

  const headerAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      if (user?.agencyId) {
        const data = await api.getAgency(user.agencyId as string);
        setAgencyData(data);
      }
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  }, [user?.agencyId]);

  useFocusEffect(useCallback(() => {
    void loadData();
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
  }, [loadData]));

  const availablePct = balance > 0 ? Math.min((available / balance) * 100, 100) : 0;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={T.forge} />

      {/* ── Header ── */}
      <Animated.View
        style={[
          s.header,
          {
            opacity: headerAnim,
            transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
          },
        ]}
      >
        <LinearGradient
          colors={[T.forge, T.forgeMid]}
          style={s.headerGrad}
        >
          {/* Décor lumière ambre */}
          <View style={s.amberGlow} />

          <View style={s.headerTop}>
            <View style={{ flex: 1 }}>
              <View style={s.headerBadge}>
                <View style={s.headerBadgeDot} />
                <Text style={[s.headerBadgeTxt, { fontFamily: T.font.sans }]}>ESPACE GUICHET</Text>
              </View>
              <Text style={[s.headerName, { fontFamily: T.font.display }]}>
                Bonjour, {user?.firstName || "Agent"}
              </Text>
              <View style={s.agencyRow}>
                <Ionicons name="storefront" size={13} color={T.creamDim} />
                <Text style={[s.agencyName, { fontFamily: T.font.sans }]} numberOfLines={1}>
                  {agencyName}
                </Text>
              </View>
            </View>
            <View style={s.headerActions}>
              <TouchableOpacity style={s.headerBtn} onPress={loadData}>
                <Ionicons name="refresh" size={18} color={T.amberL} />
              </TouchableOpacity>
              <TouchableOpacity style={s.headerBtn} onPress={() => router.push("/(tabs)/admin/notifications")}>
                <Ionicons name="notifications" size={18} color={T.white} />
                <View style={s.notifDot} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Balance Card ── */}
          <View style={s.balanceCard}>
            <View style={s.balanceTop}>
              <View style={{ flex: 1 }}>
                <Text style={[s.balLabel, { fontFamily: T.font.sans }]}>SOLDE AGENCE · {currency}</Text>
                <Text style={[s.balAmount, { fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit>
                  {fmt(balance, currency)}
                </Text>
                <Text style={[s.balCurrency, { fontFamily: T.font.sans }]}>{currency}</Text>
              </View>
              <View style={s.balStatus}>
                <View style={s.activeDot} />
                <Text style={[s.activeText, { fontFamily: T.font.sans }]}>En ligne</Text>
              </View>
            </View>

            {/* Progress dispo/réservé */}
            <View style={s.balProgSection}>
              <View style={s.balProgBg}>
                <View style={[s.balProgFill, { width: `${availablePct}%` as any }]} />
              </View>
              <View style={s.balProgRow}>
                <Text style={[s.balProgLabel, { fontFamily: T.font.sans }]}>
                  Disponible <Text style={s.balProgValue}>{fmt(available, currency)} {currency}</Text>
                </Text>
                <Text style={[s.balProgLabel, { fontFamily: T.font.sans }]}>
                  Réservé <Text style={[s.balProgValue, { color: T.creamDim }]}>{fmt(reserved, currency)} {currency}</Text>
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, isDesktop && s.contentDesktop]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={T.amberL} />}
      >
        {/* Ops rapides */}
        <View style={s.sectionRow}>
          <View style={s.sectionDot} />
          <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>OPÉRATIONS RAPIDES</Text>
        </View>
        <View style={s.opsGrid}>
          <OpCard
            title="Dépôt Client"
            subtitle="Recharger un compte"
            icon="arrow-down-circle"
            color={T.green}
            bgColor="#0D1F12"
            onPress={() => router.push("/agent/deposit")}
          />
          <OpCard
            title="Retrait Client"
            subtitle="Payer un code"
            icon="arrow-up-circle"
            color={T.red}
            bgColor="#1F0D0D"
            onPress={() => router.push("/agent/withdraw")}
          />
          <OpCard
            title="Envoi Cash"
            subtitle="Sans compte"
            icon="paper-plane"
            color={T.blue}
            bgColor="#0D1220"
            onPress={() => router.push("/agent/send-cash")}
            badge="Nouveau"
          />
          <OpCard
            title="Clôture Jour"
            subtitle="Bilan & Commissions"
            icon="calculator"
            color={T.amberL}
            bgColor="#1A1000"
            onPress={() => router.push("/agent/commissions")}
          />
        </View>

        {/* Suivi & rapports */}
        <View style={[s.sectionRow, { marginTop: 8 }]}>
          <View style={[s.sectionDot, { backgroundColor: T.blue }]} />
          <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>SUIVI & RAPPORTS</Text>
        </View>

        <ReportRow
          title="Journal de Caisse"
          subtitle="Toutes les opérations du jour"
          icon="list-outline"
          color={T.amber}
          bgColor="#1A1000"
          onPress={() => router.push("/agent/transactions")}
        />
        <ReportRow
          title="Mes Commissions"
          subtitle="Gains, paliers et historique"
          icon="bar-chart-outline"
          color={T.purple}
          bgColor="#150C20"
          onPress={() => router.push("/agent/commissions")}
        />
        <ReportRow
          title="Taux du Jour"
          subtitle="Devises & taux de change"
          icon="trending-up-outline"
          color={T.green}
          bgColor="#0D1A0D"
          onPress={() => router.push("/(tabs)/rates")}
          value={`1 EUR`}
        />

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.forgeMid },

  header: { zIndex: 10 },
  headerGrad: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 24,
    overflow: "hidden",
  },
  amberGlow: {
    position: "absolute", width: 200, height: 200,
    borderRadius: 100, backgroundColor: T.amberGlow,
    top: -60, right: -60,
  },
  headerTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 20 },
  headerBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.forgeBorder,
    borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4,
    alignSelf: "flex-start", marginBottom: 8,
  },
  headerBadgeDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: T.amberL },
  headerBadgeTxt: { color: T.amberL, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  headerName: { color: T.white, fontSize: 26, fontWeight: "700", marginBottom: 4 },
  agencyRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  agencyName: { color: T.creamDim, fontSize: 13, fontWeight: "600" },
  headerActions: { flexDirection: "row", gap: 8, paddingTop: 4 },
  headerBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.forgeBorder,
    justifyContent: "center", alignItems: "center",
  },
  notifDot: {
    position: "absolute", top: 8, right: 8,
    width: 7, height: 7, borderRadius: 99,
    backgroundColor: T.red, borderWidth: 1.5, borderColor: T.forge,
  },

  balanceCard: {
    backgroundColor: T.forgeLight, borderRadius: 22,
    borderWidth: 1, borderColor: T.forgeBorder, padding: 20,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  balanceTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  balLabel: { color: T.creamDim, fontSize: 9, fontWeight: "900", letterSpacing: 1.5, marginBottom: 6 },
  balAmount: { color: T.white, fontSize: 36, letterSpacing: -0.8 },
  balCurrency: { color: T.amberL, fontSize: 13, fontWeight: "800", marginTop: 2 },
  balStatus: { alignItems: "flex-end", gap: 4 },
  activeDot: { width: 8, height: 8, borderRadius: 99, backgroundColor: T.green },
  activeText: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "700" },
  balProgSection: {},
  balProgBg: { height: 4, backgroundColor: T.ghost, borderRadius: 99, overflow: "hidden", marginBottom: 8 },
  balProgFill: { height: 4, borderRadius: 99, backgroundColor: T.amberL },
  balProgRow: { flexDirection: "row", justifyContent: "space-between" },
  balProgLabel: { color: T.creamDim, fontSize: 10, fontWeight: "700" },
  balProgValue: { color: T.amberL, fontWeight: "900" },

  content: { padding: 20, paddingTop: 22 },
  contentDesktop: { maxWidth: 1000, alignSelf: "center", width: "100%" },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: T.amber },
  sectionLabel: { flex: 1, fontSize: 11, fontWeight: "900", color: T.creamDim, letterSpacing: 1.5 },

  opsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
});