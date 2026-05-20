// apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
// =========================================================
// SUPER ADMIN DASHBOARD v13.1 (Modern Light - Syntax Fixed)
// ✅ FIX : DONIKO filtré côté frontend (code !== "DONIKO")
// ✅ FIX : Corrections des erreurs JSX sur DashHero
// =========================================================

import React, { useCallback, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
  Platform,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import CreateCompanyModal from "./CreateCompanyModal";

const { width: SW } = Dimensions.get("window");

// ─── Modern Design Tokens ────────────────────────────────────────
const T = {
  heroA: "#1E293B",
  heroB: "#334155",
  heroC: "#475569",

  brand:     "#4F46E5",
  brandDark: "#4338CA",
  brandLt:   "#EEF2FF",
  brandMd:   "#E0E7FF",

  pageBg:   "#F8FAFC",
  surface:  "#FFFFFF",
  border:   "#E2E8F0",
  borderMd: "#CBD5E1",

  ink:      "#0F172A",
  inkMid:   "#334155",
  inkSub:   "#64748B",
  inkMuted: "#94A3B8",

  green:    "#10B981",
  greenLt:  "#ECFDF5",
  red:      "#EF4444",
  redLt:    "#FEF2F2",
  amber:    "#F59E0B",
  amberLt:  "#FFFBEB",
  purple:   "#8B5CF6",
  purpleLt: "#F5F3FF",
  teal:     "#14B8A6",
  tealLt:   "#F0FDFA",

  white: "#FFFFFF",

  currencies: {
    EUR: { code: "EUR", symbol: "€",   flag: "🇪🇺", color: "#4F46E5", colorDark: "#3730A3", bg: "#EEF2FF", name: "Euro" },
    USD: { code: "USD", symbol: "$",   flag: "🇺🇸", color: "#10B981", colorDark: "#065F46", bg: "#ECFDF5", name: "Dollar US" },
    XOF: { code: "XOF", symbol: "CFA", flag: "🌍",  color: "#F59E0B", colorDark: "#92400E", bg: "#FFFBEB", name: "Franc CFA" },
    GNF: { code: "GNF", symbol: "FG",  flag: "🇬🇳", color: "#EF4444", colorDark: "#991B1B", bg: "#FEF2F2", name: "Franc Guinéen" },
    GBP: { code: "GBP", symbol: "£",   flag: "🇬🇧", color: "#8B5CF6", colorDark: "#6D28D9", bg: "#F5F3FF", name: "Livre Sterling" },
  },

  statusColors: {
    ACTIVE:    "#10B981",
    SUSPENDED: "#F59E0B",
    INACTIVE:  "#EF4444",
    EXPIRED:   "#EF4444",
    TRIAL:     "#6366F1",
  } as Record<string, string>,

  radius: { sm: 6, md: 12, lg: 16, xl: 24, xxl: 32 },

  font: {
    display:  Platform.select({ ios: "System", android: "sans-serif-medium", default: "System" }),
    sans:     Platform.select({ ios: "System", android: "sans-serif",        default: "System" }),
    subtitle: Platform.select({ ios: "System", android: "sans-serif-light",  default: "System" }),
    mono:     Platform.select({ ios: "Courier New", android: "monospace",    default: "Courier" }),
  },

  shadow: {
    card: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 3,
    },
    soft: {
      shadowColor: "#334155",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    hero: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 6,
    },
  },
};

const CURRENCIES_ORDER = ["EUR", "USD", "XOF", "GNF", "GBP"] as const;

const STACK_W        = SW - 40;
const STACK_H        = 125;
const STACK_OFFSET_X = 0;
const STACK_OFFSET_Y = 10;

// ─── Helpers ──────────────────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

// Formatage propre sans devise codée en dur
function fmtAmount(n: number, currency: string): string {
  const decimals = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  } catch {
    return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
  }
}

// ─── 3D Stack cartes devises ──────────────────────────────
function CurrencyStack({ wallets }: { wallets: any[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const total = CURRENCIES_ORDER.length;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 6,
      onPanResponderMove: (_, gs) => { translateX.setValue(gs.dx); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -48) setActiveIdx((p) => Math.min(p + 1, total - 1));
        else if (gs.dx > 48) setActiveIdx((p) => Math.max(p - 1, 0));
        Animated.spring(translateX, {
          toValue: 0, useNativeDriver: true, speed: 28, bounciness: 5,
        }).start();
      },
    })
  ).current;

  const activeCur = CURRENCIES_ORDER[activeIdx] as keyof typeof T.currencies;
  const activeCfg = T.currencies[activeCur];
  const activeW   = wallets.find((x) => x.currency === activeCur);
  const balance   = toNum(activeW?.balance);
  const reserved  = toNum(activeW?.reservedBalance);
  const available = balance - reserved;
  const behindCount = Math.min(2, total - activeIdx - 1);

  return (
    <View style={stk.wrapper} {...panResponder.panHandlers}>
      {([2, 1] as const)
        .filter((d) => d <= behindCount)
        .map((d) => {
          const behindCur = CURRENCIES_ORDER[activeIdx + d] as keyof typeof T.currencies;
          const cfg = T.currencies[behindCur];
          return (
            <View
              key={`behind-${d}`}
              style={[
                stk.card,
                {
                  position: "absolute",
                  bottom: d * STACK_OFFSET_Y,
                  transform: [{ scale: 1 - d * 0.04 }],
                  width: STACK_W,
                  opacity: 0.6 - d * 0.2,
                  zIndex: 10 - d,
                },
              ]}
            >
              <View style={stk.peekRow}>
                <Text style={{ fontSize: 16, marginRight: 6 }}>{cfg.flag}</Text>
                <Text style={[stk.peekCode, { color: T.ink, fontFamily: T.font.mono }]}>{cfg.code}</Text>
                <Text style={[stk.peekName, { fontFamily: T.font.subtitle }]}>{cfg.name}</Text>
              </View>
            </View>
          );
        })}

      <Animated.View
        style={[stk.card, stk.front, { transform: [{ translateX }] }]}
      >
        <View style={stk.row1}>
          <View style={[stk.flagBox, { backgroundColor: activeCfg.bg }]}>
            <Text style={{ fontSize: 18 }}>{activeCfg.flag}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[stk.cardCode, { color: T.ink, fontFamily: T.font.display }]}>{activeCur}</Text>
            <Text style={[stk.cardName, { fontFamily: T.font.subtitle }]}>{activeCfg.name}</Text>
          </View>
          <View style={stk.navArea}>
            <TouchableOpacity onPress={() => setActiveIdx((p) => Math.max(p - 1, 0))} style={[stk.navBtn, { opacity: activeIdx === 0 ? 0.25 : 1 }]}>
              <Ionicons name="chevron-back" size={14} color={T.inkMid} />
            </TouchableOpacity>
            <Text style={[stk.navCount, { color: T.inkSub, fontFamily: T.font.mono }]}>{activeIdx + 1}/{total}</Text>
            <TouchableOpacity onPress={() => setActiveIdx((p) => Math.min(p + 1, total - 1))} style={[stk.navBtn, { opacity: activeIdx === total - 1 ? 0.25 : 1 }]}>
              <Ionicons name="chevron-forward" size={14} color={T.inkMid} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={stk.row2}>
          <View style={{ flex: 1 }}>
            <Text style={[stk.balLabel, { fontFamily: T.font.sans }]}>SOLDE TOTAL</Text>
            <Text style={[stk.balAmount, { color: T.ink, fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {fmtAmount(balance, activeCur)}{" "}
              <Text style={[stk.balSym, { color: T.inkSub }]}>{activeCfg.symbol}</Text>
            </Text>
          </View>
          <View style={stk.availPill}>
            <Text style={[stk.availLbl, { fontFamily: T.font.sans }]}>Disponible</Text>
            <Text style={[stk.availAmt, { color: activeCfg.color, fontFamily: T.font.display }]}>{fmtAmount(available, activeCur)} {activeCfg.symbol}</Text>
          </View>
        </View>

        <View style={stk.dots}>
          {CURRENCIES_ORDER.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setActiveIdx(i)}>
              <View style={[stk.dot, { width: i === activeIdx ? 12 : 4, backgroundColor: i === activeIdx ? T.brand : T.borderMd }]} />
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const stk = StyleSheet.create({
  wrapper:     { marginHorizontal: 20, height: STACK_H + 20, justifyContent: "flex-start", alignItems: "center" },
  card:        { width: STACK_W, height: STACK_H, backgroundColor: T.surface, borderRadius: T.radius.lg, borderWidth: 1, borderColor: T.border, overflow: "hidden", padding: 16, ...T.shadow.card },
  front:       { zIndex: 20, position: "relative" },
  peekRow:     { flexDirection: "row", alignItems: "center", paddingTop: 4 },
  peekCode:    { fontSize: 13, fontWeight: "600", marginRight: 6 },
  peekName:    { fontSize: 11, color: T.inkSub },
  row1:        { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  flagBox:     { width: 34, height: 34, borderRadius: T.radius.sm, justifyContent: "center", alignItems: "center" },
  cardCode:    { fontSize: 14, fontWeight: "600" },
  cardName:    { fontSize: 11, color: T.inkSub },
  navArea:     { flexDirection: "row", alignItems: "center", gap: 6 },
  navBtn:      { width: 26, height: 26, borderRadius: T.radius.sm, backgroundColor: T.pageBg, justifyContent: "center", alignItems: "center" },
  navCount:    { fontSize: 10, fontWeight: "500" },
  row2:        { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  balLabel:    { fontSize: 9, fontWeight: "600", color: T.inkMuted, letterSpacing: 0.5, marginBottom: 2 },
  balAmount:   { fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
  balSym:      { fontSize: 14, fontWeight: "400" },
  availPill:   { alignItems: "flex-end" },
  availLbl:    { fontSize: 9, color: T.inkMuted, marginBottom: 1 },
  availAmt:    { fontSize: 13, fontWeight: "600" },
  dots:        { flexDirection: "row", gap: 4, marginTop: 10, alignItems: "center", justifyContent: "center" },
  dot:         { height: 4, borderRadius: 99 },
});

// ─── Hero COMPACT ─────────────────────────────────────────
function DashHero({ animValue, user, onRefresh, onNotif }: {
  animValue: Animated.Value; user: any; onRefresh: () => void; onNotif: () => void;
}) {
  const sbH = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
  return (
    <Animated.View style={[hS.outer, { opacity: animValue, transform: [{ translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}>
      <LinearGradient colors={[T.heroA, T.heroB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[hS.gradient, { paddingTop: sbH + 16, paddingBottom: 24 }]}>
        <View style={hS.topBar}>
          <View style={hS.topLeft}>
            <View style={hS.badge}>
              <View style={hS.activeDot} />
              <Text style={[hS.badgeTxt, { fontFamily: T.font.sans }]}>SUPER ADMIN</Text>
            </View>
            <Text style={[hS.name, { fontFamily: T.font.display }]}>{user?.firstName ?? "Console"}</Text>
            <Text style={[hS.sub, { fontFamily: T.font.subtitle }]}>Direct Transf'air™ · Trésorerie globale</Text>
          </View>
          <View style={hS.btns}>
            <TouchableOpacity style={hS.btn} onPress={onRefresh} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={16} color={T.white} />
            </TouchableOpacity>
            <TouchableOpacity style={hS.btn} onPress={onNotif} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={16} color={T.white} />
              <View style={hS.notifDot} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const hS = StyleSheet.create({
  outer:      { zIndex: 10 },
  gradient:   { borderBottomLeftRadius: T.radius.xl, borderBottomRightRadius: T.radius.xl, overflow: "hidden" },
  topBar:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  topLeft:    { flex: 1 },
  badge:      { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start", marginBottom: 6 },
  activeDot:  { width: 5, height: 5, borderRadius: 99, backgroundColor: T.green },
  badgeTxt:   { color: T.white, fontSize: 9, fontWeight: "600", letterSpacing: 0.5 },
  name:       { color: T.white, fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  sub:        { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 },
  btns:       { flexDirection: "row", gap: 8 },
  btn:        { width: 36, height: 36, borderRadius: T.radius.sm, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },
  notifDot:   { position: "absolute", top: 8, right: 8, width: 6, height: 6, borderRadius: 99, backgroundColor: T.red },
});

// ─── Stat Strip ───────────────────────────────────────────
function StatStrip({ stats }: { stats: { total: number; active: number; inactive: number } }) {
  const items = [
    { label: "Sociétés",  value: stats.total,    color: T.brand, icon: "business-outline" as const },
    { label: "Actives",   value: stats.active,   color: T.green, icon: "checkmark-circle-outline" as const },
    { label: "Inactives", value: stats.inactive, color: T.red,   icon: "close-circle-outline" as const },
  ];
  return (
    <View style={ssS.row}>
      {items.map((it, idx) => (
        <View key={idx} style={ssS.card}>
          <View style={ssS.meta}>
            <Ionicons name={it.icon} size={14} color={T.inkSub} style={{ marginRight: 4 }} />
            <Text style={[ssS.lbl, { fontFamily: T.font.sans }]}>{it.label}</Text>
          </View>
          <Text style={[ssS.val, { color: it.color, fontFamily: T.font.display }]}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}
const ssS = StyleSheet.create({
  row:    { flexDirection: "row", gap: 10, marginBottom: 20, marginTop: 10 },
  card:   { flex: 1, backgroundColor: T.surface, borderRadius: T.radius.md, padding: 14, borderWidth: 1, borderColor: T.border, ...T.shadow.soft },
  meta:   { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  val:    { fontSize: 22, fontWeight: "700" },
  lbl:    { fontSize: 11, color: T.inkSub, fontWeight: "500" },
});

// ─── Action Grid ──────────────────────────────────────────
function ActionGrid({ actions }: { actions: any[] }) {
  return (
    <View style={agS.grid}>
      {actions.map((a) => (
        <TouchableOpacity key={a.title} style={agS.card} onPress={a.onPress} activeOpacity={0.8}>
          <View style={[agS.iconBox, { backgroundColor: a.bgColor }]}>
            <Ionicons name={a.icon} size={18} color={a.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[agS.title, { fontFamily: T.font.sans }]} numberOfLines={1}>{a.title}</Text>
            <Text style={[agS.sub, { fontFamily: T.font.subtitle }]} numberOfLines={1}>{a.subtitle}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const agS = StyleSheet.create({
  grid:   { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 20 },
  card:   { width: "48.5%", flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.surface, borderRadius: T.radius.md, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: T.border, ...T.shadow.soft },
  iconBox:{ width: 34, height: 34, borderRadius: T.radius.sm, justifyContent: "center", alignItems: "center" },
  title:  { fontSize: 12, fontWeight: "600", color: T.ink },
  sub:    { fontSize: 10, color: T.inkSub, marginTop: 1 },
});

// ─── Client Card ─────────────────────────────────────────
function ClientCard({ item, onPress }: { item: any; onPress: () => void }) {
  const statusColor = T.statusColors[item.subscriptionStatus?.toUpperCase()] ?? T.inkMuted;
  return (
    <TouchableOpacity style={clS.card} onPress={onPress} activeOpacity={0.8}>
      <View style={clS.avatar}>
        <Text style={[clS.avatarLetter, { fontFamily: T.font.display }]}>{(item.name?.[0] ?? "C").toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[clS.name, { fontFamily: T.font.sans }]} numberOfLines={1}>{item.name}</Text>
        <View style={clS.metaRow}>
          <Text style={[clS.code, { fontFamily: T.font.mono }]}>{item.code}</Text>
          <View style={[clS.statusPill, { backgroundColor: `${statusColor}10` }]}>
            <Text style={[clS.statusTxt, { color: statusColor, fontFamily: T.font.sans }]}>{item.subscriptionStatus}</Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={14} color={T.inkMuted} style={{ marginRight: 4 }} />
    </TouchableOpacity>
  );
}
const clS = StyleSheet.create({
  card:       { flexDirection: "row", alignItems: "center", backgroundColor: T.surface, borderRadius: T.radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: T.border, gap: 12, ...T.shadow.soft },
  avatar:     { width: 36, height: 36, borderRadius: T.radius.sm, backgroundColor: T.pageBg, justifyContent: "center", alignItems: "center" },
  avatarLetter:{ fontSize: 15, fontWeight: "600", color: T.inkMid },
  name:       { color: T.ink, fontSize: 13, fontWeight: "600", marginBottom: 2 },
  metaRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  code:       { color: T.inkSub, fontSize: 10, fontWeight: "500" },
  statusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusTxt:  { fontSize: 9, fontWeight: "600", textTransform: "uppercase" },
});

// ─── Section Header ───────────────────────────────────────
function SH({ label, right }: { dot: string; label: string; right?: React.ReactNode }) {
  return (
    <View style={shS.row}>
      <Text style={[shS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      {right}
    </View>
  );
}
const shS = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, marginTop: 6 },
  label: { fontSize: 11, fontWeight: "700", color: T.inkSub, letterSpacing: 0.5 },
});

// ─── Main Component ───────────────────────────────────────
const LIST_H_PAD = 16;
const PLATFORM_CODE = "DONIKO";

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [clients,    setClients]    = useState<any[]>([]);
  const [wallets,    setWallets]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q,          setQ]          = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const headerAnim  = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  const runEntrance = useCallback(() => {
    Animated.stagger(120, [
      Animated.spring(headerAnim,  { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }),
      Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 2 }),
    ]).start();
  }, []);

  const loadData = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    try {
      const [rawClients, rawWallets] = await Promise.all([
        api.getClients().catch(() => []),
        api.getMyWallets?.().catch(() => []) ?? Promise.resolve([]),
      ]);
      const list = Array.isArray(rawClients) ? rawClients : ((rawClients as any)?.data ?? []);

      setClients(
        list
          .filter((c: any) => c.code !== PLATFORM_CODE)
          .map((c: any) => ({
            id: c.id?.toString(),
            name: c.name || "Client",
            code: c.code || "N/A",
            subscriptionStatus: c.subscriptionStatus || "ACTIVE",
            subscriptionType: c.subscriptionType || "RENTAL",
            ...c,
          }))
      );

      setWallets(Array.isArray(rawWallets) ? rawWallets : []);
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.message || "Impossible de charger les données.");
    } finally {
      if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData("init");
      runEntrance();
      return () => {};
    }, [loadData, runEntrance])
  );

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return clients;
    return clients.filter((c) =>
      `${c.name} ${c.code} ${c.subscriptionStatus}`.toLowerCase().includes(n)
    );
  }, [clients, q]);

  const stats = useMemo(() => ({
    total:    clients.length,
    active:   clients.filter((c) => c.subscriptionStatus?.toUpperCase() === "ACTIVE").length,
    inactive: clients.filter((c) =>
      ["INACTIVE", "EXPIRED", "SUSPENDED"].includes(c.subscriptionStatus?.toUpperCase())
    ).length,
  }), [clients]);

  const actions = useMemo(() => [
    { title: "Trésorerie",    subtitle: "Vue globale",       icon: "wallet-outline",           color: T.brand,  bgColor: T.brandLt,  onPress: () => router.push("/(tabs)/admin/treasury")    },
    { title: "Supervision",   subtitle: "Logs système",      icon: "shield-checkmark-outline", color: T.teal,   bgColor: T.tealLt,   onPress: () => router.push("/(tabs)/admin/supervision")  },
    { title: "Transactions",  subtitle: "Audit temps réel",  icon: "analytics-outline",        color: T.green,  bgColor: T.greenLt,  onPress: () => router.push("/(tabs)/admin/transactions") },
    { title: "Utilisateurs",  subtitle: "Accès & Rôles",     icon: "people-outline",           color: T.purple, bgColor: T.purpleLt, onPress: () => router.push("/(tabs)/admin/users")        },
  ], [router]);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={T.heroA} barStyle="light-content" />
      <View style={s.screen}>
        <DashHero
          animValue={headerAnim}
          user={user}
          onRefresh={() => void loadData("refresh")}
          onNotif={() => router.push("/(tabs)/admin/notifications")}
        />

        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <ClientCard
              item={item}
              onPress={() => router.push({ pathname: "/(tabs)/admin/clients/details", params: { id: item.id } })}
            />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: T.pageBg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData("refresh")} tintColor={T.brand} />}
          ListHeaderComponent={
            <Animated.View style={{ opacity: contentAnim, transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
              <View style={s.stackWrapper}>
                <CurrencyStack wallets={wallets} />
              </View>
              <StatStrip stats={stats} />
              <SH dot={T.brand} label="PILOTAGE RÉSEAU" />
              <ActionGrid actions={actions} />
              
              <View style={s.searchBox}>
                <Ionicons name="search" size={16} color={T.inkMuted} />
                <TextInput
                  value={q} onChangeText={setQ}
                  placeholder="Rechercher un client SaaS..."
                  placeholderTextColor={T.inkMuted}
                  style={[s.searchInput, { fontFamily: T.font.sans }]}
                  autoCapitalize="none" autoCorrect={false}
                />
                {!!q && (
                  <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn}>
                    <Ionicons name="close" size={14} color={T.inkMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <SH
                dot={T.green}
                label={`CLIENTS SAAS (${filtered.length})`}
                right={
                  <TouchableOpacity
                    style={[s.addBtn, !isSuperAdmin && { opacity: 0.4 }]}
                    onPress={() => {
                      if (!isSuperAdmin) { Alert.alert("Accès refusé", "Seul le Super Admin peut créer une société."); return; }
                      setCreateOpen(true);
                    }}
                  >
                    <View style={s.addBtnBg}>
                      <Ionicons name="add" size={18} color={T.brand} />
                    </View>
                  </TouchableOpacity>
                }
              />
              {loading && <ActivityIndicator color={T.brand} style={{ marginVertical: 24 }} size="large" />}
            </Animated.View>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <Ionicons name="business-outline" size={24} color={T.inkMuted} />
                </View>
                <Text style={[s.emptyTitle, { fontFamily: T.font.display }]}>Aucun client trouvé</Text>
                <Text style={[s.emptySub, { fontFamily: T.font.subtitle }]}>Modifiez votre recherche ou créez une nouvelle structure.</Text>
              </View>
            ) : null
          }
          ListFooterComponent={<View style={{ height: 60 }} />}
        />
      </View>

      <CreateCompanyModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => void loadData("refresh")}
        isSuperAdmin={isSuperAdmin}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: T.pageBg },
  screen:       { flex: 1, backgroundColor: T.pageBg },
  list:         { paddingHorizontal: LIST_H_PAD, paddingTop: 4 },
  stackWrapper: { marginTop: 16, marginBottom: 12 },
  searchBox:    { flexDirection: "row", alignItems: "center", backgroundColor: T.surface, borderRadius: T.radius.md, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: T.border, marginBottom: 16, gap: 8, ...T.shadow.soft },
  searchInput:  { flex: 1, fontSize: 13, color: T.ink },
  clearBtn:     { width: 20, height: 20, borderRadius: 5, backgroundColor: T.pageBg, justifyContent: "center", alignItems: "center" },
  addBtn:       {},
  addBtnBg:     { width: 28, height: 28, borderRadius: T.radius.sm, backgroundColor: T.brandLt, justifyContent: "center", alignItems: "center" },
  empty:        { alignItems: "center", paddingVertical: 40, gap: 6 },
  emptyIcon:    { width: 48, height: 48, borderRadius: T.radius.md, backgroundColor: T.pageBg, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  emptyTitle:   { color: T.ink, fontSize: 15, fontWeight: "600" },
  emptySub:     { color: T.inkMuted, fontSize: 12, textAlign: "center", paddingHorizontal: 32 },
});