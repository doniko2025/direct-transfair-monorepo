// apps/direct-transfair-mobile/components/dashboards/AgentDashboard.tsx
// =========================================================
// AGENT DASHBOARD — Direct Transf'air v5.0
// Design: Violet clair — thème lumineux, moderne
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
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

// ─── Design Tokens ──────────────────────────────────────
const T = {
  // Violet principal
  primary:       "#6C47FF",
  primaryMid:    "#7C5CFF",
  primaryLight:  "#F5F3FF",
  primaryBorder: "#EDE9FE",
  primaryGlow:   "rgba(108,71,255,0.15)",

  // Texte
  textDark:   "#1A1A2E",
  textMuted:  "#9CA3AF",
  textSub:    "#6B7280",

  // Surfaces
  white:      "#FFFFFF",
  pageBg:     "#F5F3FF",
  cardBorder: "#EDE9FE",

  // Sémantiques
  green:      "#10B981",
  greenBg:    "#ECFDF5",
  greenBorder:"#A7F3D0",
  red:        "#EF4444",
  redBg:      "#FEF2F2",
  blue:       "#3B82F6",
  blueBg:     "#EFF6FF",
  purple:     "#8B5CF6",
  purpleBg:   "#F5F3FF",
  amber:      "#F59E0B",
  amberBg:    "#FFFBEB",

  // Overlay hero
  heroOverlay1: "rgba(255,255,255,0.08)",
  heroOverlay2: "rgba(255,255,255,0.05)",
  heroBadgeBg:  "rgba(255,255,255,0.15)",
  heroBadgeBdr: "rgba(255,255,255,0.20)",
  heroTextDim:  "rgba(255,255,255,0.65)",

  radius: { sm: 10, md: 16, lg: 20, xl: 28, pill: 99 },
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
        onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={[opS.iconBox, { backgroundColor: bgColor }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        {badge && (
          <View style={[opS.badge, { backgroundColor: T.blueBg, borderColor: "#BFDBFE" }]}>
            <Text style={[opS.badgeTxt, { color: T.blue }]}>{badge}</Text>
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
    backgroundColor: T.white,
    borderRadius: T.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: T.cardBorder,
    shadowColor: T.primary,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  badge: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeTxt: { fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  title: { fontSize: 13, fontWeight: "800", color: T.textDark, marginBottom: 3 },
  sub: { fontSize: 10, color: T.textMuted, fontWeight: "600" },
});

// ─── Report Row ──────────────────────────────────────────
function ReportRow({ title, subtitle, icon, color, bgColor, onPress, value }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 10 }}>
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
        <View style={[rrS.arrow, { backgroundColor: bgColor }]}>
          <Ionicons name="chevron-forward" size={14} color={color} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const rrS = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.white,
    borderRadius: T.radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: T.cardBorder,
    shadowColor: T.primary,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 13, fontWeight: "800", color: T.textDark, marginBottom: 2 },
  sub: { fontSize: 10, color: T.textMuted, fontWeight: "600" },
  value: { fontSize: 12, fontWeight: "900" },
  arrow: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});

// ─── Main ────────────────────────────────────────────────
export default function AgentDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [refreshing, setRefreshing] = useState(false);
  const [agencyData, setAgencyData] = useState<any>(null);

  const COUNTRY_CURRENCY_MAP: Record<string, string> = {
    GN: "GNF", SN: "XOF", ML: "XOF", CI: "XOF", BF: "XOF", BJ: "XOF",
    TG: "XOF", NE: "XOF", GW: "XOF", FR: "EUR", DE: "EUR", BE: "EUR",
    IT: "EUR", ES: "EUR", PT: "EUR", NL: "EUR", GB: "GBP", US: "USD",
  };
  const agencyCountryCode = ((agencyData?.country ?? user?.agency?.country ?? "") as string)
    .trim().toUpperCase().substring(0, 2);
  const derivedCurrency = COUNTRY_CURRENCY_MAP[agencyCountryCode] ?? "XOF";
  const agencyName = agencyData?.name ?? user?.agency?.name ?? "Mon Agence";
  const currency = agencyData?.primaryCurrency || agencyData?.wallets?.[0]?.currency || derivedCurrency;

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
      <StatusBar barStyle="light-content" backgroundColor={T.primary} />

      {/* ── Hero Header ── */}
      <Animated.View
        style={[
          s.header,
          {
            opacity: headerAnim,
            transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
          },
        ]}
      >
        <View style={s.heroGrad}>
          {/* Décors circulaires */}
          <View style={s.glowCircle1} />
          <View style={s.glowCircle2} />

          {/* Top bar */}
          <View style={s.headerTop}>
            <View style={{ flex: 1 }}>
              <View style={s.heroBadge}>
                <View style={s.heroBadgeDot} />
                <Text style={[s.heroBadgeTxt, { fontFamily: T.font.sans }]}>ESPACE GUICHET</Text>
              </View>
              <Text style={[s.headerName, { fontFamily: T.font.display }]}>
                Bonjour, {user?.firstName || "Agent"}
              </Text>
              <View style={s.agencyRow}>
                <Ionicons name="storefront-outline" size={13} color={T.heroTextDim} />
                <Text style={[s.agencyName, { fontFamily: T.font.sans }]} numberOfLines={1}>
                  {agencyName}
                </Text>
              </View>
            </View>
            <View style={s.headerActions}>
              <TouchableOpacity style={s.headerBtn} onPress={loadData}>
                <Ionicons name="refresh" size={17} color={T.white} />
              </TouchableOpacity>
              <TouchableOpacity style={s.headerBtn} onPress={() => router.push("/(tabs)/admin/notifications")}>
                <Ionicons name="notifications-outline" size={17} color={T.white} />
                <View style={s.notifDot} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Balance Card ── */}
          <View style={s.balanceCard}>
            <View style={s.balanceTop}>
              <View style={{ flex: 1 }}>
                <Text style={[s.balLabel, { fontFamily: T.font.sans }]}>
                  SOLDE AGENCE · {currency}
                </Text>
                <Text
                  style={[s.balAmount, { fontFamily: T.font.display }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {fmt(balance, currency)}
                </Text>
                <Text style={[s.balCurrency, { fontFamily: T.font.sans }]}>{currency}</Text>
              </View>
              <View style={s.onlinePill}>
                <View style={s.onlineDot} />
                <Text style={[s.onlineText, { fontFamily: T.font.sans }]}>En ligne</Text>
              </View>
            </View>

            {/* Barre disponible / réservé */}
            <View style={s.progressBg}>
              <View style={[s.progressFill, { width: `${availablePct}%` as any }]} />
            </View>
            <View style={s.balSubRow}>
              <Text style={[s.balSubLabel, { fontFamily: T.font.sans }]}>
                Disponible{" "}
                <Text style={s.balSubVal}>{fmt(available, currency)} {currency}</Text>
              </Text>
              <Text style={[s.balSubLabel, { fontFamily: T.font.sans }]}>
                Réservé{" "}
                <Text style={s.balSubValDim}>{fmt(reserved, currency)} {currency}</Text>
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* ── Scroll Content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, isDesktop && s.contentDesktop]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={T.primary} />
        }
      >
        {/* Section : Opérations rapides */}
        <View style={s.sectionRow}>
          <View style={s.sectionDot} />
          <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>OPÉRATIONS RAPIDES</Text>
        </View>
        <View style={s.opsGrid}>
          <OpCard
            title="Dépôt Client"
            subtitle="Recharger un compte"
            icon="arrow-down-circle-outline"
            color={T.green}
            bgColor={T.greenBg}
            onPress={() => router.push("/agent/deposit")}
          />
          <OpCard
            title="Retrait Client"
            subtitle="Payer un code"
            icon="arrow-up-circle-outline"
            color={T.red}
            bgColor={T.redBg}
            onPress={() => router.push("/agent/withdraw")}
          />
          <OpCard
            title="Envoi Cash"
            subtitle="Sans compte"
            icon="paper-plane-outline"
            color={T.blue}
            bgColor={T.blueBg}
            onPress={() => router.push("/agent/send-cash")}
            badge="Nouveau"
          />
          <OpCard
            title="Clôture Jour"
            subtitle="Bilan & Commissions"
            icon="calculator-outline"
            color={T.primary}
            bgColor={T.primaryLight}
            onPress={() => router.push("/agent/commissions")}
          />
        </View>

        {/* Section : Suivi & rapports */}
        <View style={[s.sectionRow, { marginTop: 6 }]}>
          <View style={[s.sectionDot, { backgroundColor: T.blue }]} />
          <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>SUIVI & RAPPORTS</Text>
        </View>

        <ReportRow
          title="Journal de Caisse"
          subtitle="Toutes les opérations du jour"
          icon="list-outline"
          color={T.amber}
          bgColor={T.amberBg}
          onPress={() => router.push("/agent/transactions")}
        />
        <ReportRow
          title="Mes Commissions"
          subtitle="Gains, paliers et historique"
          icon="bar-chart-outline"
          color={T.purple}
          bgColor={T.purpleBg}
          onPress={() => router.push("/agent/commissions")}
        />
        <ReportRow
          title="Taux du Jour"
          subtitle="Devises & taux de change"
          icon="trending-up-outline"
          color={T.green}
          bgColor={T.greenBg}
          onPress={() => router.push("/(tabs)/rates")}
          value="1 EUR"
        />

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: T.pageBg,
  },

  // ── Hero ──
  header: {
    zIndex: 10,
  },
  heroGrad: {
    backgroundColor: T.primary,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 24,
    overflow: "hidden",
  },
  glowCircle1: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: T.heroOverlay1,
    top: -50,
    right: -30,
  },
  glowCircle2: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: T.heroOverlay2,
    bottom: 10,
    left: -30,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: T.heroBadgeBg,
    borderWidth: 1,
    borderColor: T.heroBadgeBdr,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  heroBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 99,
    backgroundColor: "#A5F3FC",
  },
  heroBadgeTxt: {
    color: "#E8E0FF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  headerName: {
    color: T.white,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 4,
  },
  agencyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  agencyName: {
    color: T.heroTextDim,
    fontSize: 12,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 4,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: T.heroBadgeBg,
    borderWidth: 1,
    borderColor: T.heroBadgeBdr,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  notifDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: "#F87171",
    borderWidth: 1.5,
    borderColor: T.primary,
  },

  // ── Balance Card ──
  balanceCard: {
    backgroundColor: T.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: T.primary,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  balanceTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  balLabel: {
    color: T.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  balAmount: {
    color: T.textDark,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
  },
  balCurrency: {
    color: T.primary,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },
  onlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: T.greenBg,
    borderWidth: 1,
    borderColor: T.greenBorder,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: T.green,
  },
  onlineText: {
    color: "#059669",
    fontSize: 10,
    fontWeight: "700",
  },
  progressBg: {
    height: 5,
    backgroundColor: T.primaryLight,
    borderRadius: 99,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: 5,
    borderRadius: 99,
    backgroundColor: T.primary,
  },
  balSubRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  balSubLabel: {
    color: T.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  balSubVal: {
    color: T.primary,
    fontWeight: "900",
  },
  balSubValDim: {
    color: "#C4B5FD",
    fontWeight: "900",
  },

  // ── Content ──
  content: {
    padding: 20,
    paddingTop: 22,
  },
  contentDesktop: {
    maxWidth: 1000,
    alignSelf: "center",
    width: "100%",
  },

  // ── Section headers ──
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sectionDot: {
    width: 5,
    height: 5,
    borderRadius: 99,
    backgroundColor: T.primary,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: T.textSub,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  // ── Ops grid ──
  opsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
});