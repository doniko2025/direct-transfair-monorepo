// apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
// =========================================================
// SUPER ADMIN DASHBOARD v6.0 — Direct Transf'air
// ✅ Design Banking Premium Light
// ✅ Police Trebuchet MS partout (comme capture 2)
// ✅ Carrousel corrigé : 1 carte pleine largeur visible
// ✅ Ombres bleues profondes sur toutes les cartes
// ✅ Hero parapluie propre (coins concaves)
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
  ScrollView,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import CreateCompanyModal from "./CreateCompanyModal";

const { width: SW } = Dimensions.get("window");

// ─── Design Tokens ────────────────────────────────────────
const T = {
  blue:       "#1956F0",
  blueDark:   "#1240D6",
  blueDeep:   "#0D33B0",
  blueLt:     "#EEF2FF",
  blueMd:     "#C7D5FF",

  pageBg:     "#F0F4FF",
  surface:    "#FFFFFF",
  border:     "#E2E8F0",
  borderMd:   "#D1D9E6",

  ink:        "#0F172A",
  inkMid:     "#374151",
  inkSub:     "#6B7280",
  inkMuted:   "#9CA3AF",

  green:      "#16A34A",
  greenLt:    "#DCFCE7",
  greenMd:    "#86EFAC",
  red:        "#DC2626",
  redLt:      "#FEE2E2",
  amber:      "#D97706",
  amberLt:    "#FEF3C7",
  purple:     "#7C3AED",
  purpleLt:   "#EDE9FE",

  white:      "#FFFFFF",

  currencies: {
    EUR: { code: "EUR", symbol: "€",    flag: "🇪🇺", color: "#1956F0", colorDark: "#1240D6", bg: "#EEF2FF",  name: "Euro" },
    USD: { code: "USD", symbol: "$",    flag: "🇺🇸", color: "#16A34A", colorDark: "#15803D", bg: "#DCFCE7",  name: "Dollar US" },
    XOF: { code: "XOF", symbol: "CFA",  flag: "🌍",  color: "#D97706", colorDark: "#B45309", bg: "#FEF3C7",  name: "Franc CFA" },
    GNF: { code: "GNF", symbol: "FG",   flag: "🇬🇳", color: "#DC2626", colorDark: "#B91C1C", bg: "#FEE2E2",  name: "Franc Guinéen" },
    GBP: { code: "GBP", symbol: "£",    flag: "🇬🇧", color: "#7C3AED", colorDark: "#6D28D9", bg: "#EDE9FE",  name: "Livre Sterling" },
  },

  statusColors: {
    ACTIVE:    "#16A34A",
    SUSPENDED: "#D97706",
    INACTIVE:  "#DC2626",
    EXPIRED:   "#DC2626",
    TRIAL:     "#6366F1",
  } as Record<string, string>,

  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 },

  // Police Trebuchet MS partout — esprit BNP Paribas clean
  font: {
    display:  Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:     Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    subtitle: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light",     default: "Trebuchet MS" }),
    mono:     Platform.select({ ios: "Trebuchet MS", android: "monospace",             default: "Trebuchet MS" }),
  },

  shadow: {
    card: {
      shadowColor: "#1240D6",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 20,
      elevation: 10,
    },
    deep: {
      shadowColor: "#0D33B0",
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.22,
      shadowRadius: 32,
      elevation: 18,
    },
    soft: {
      shadowColor: "#1240D6",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 5,
    },
  },
};

// Carrousel — carte réduite, 1 seule visible à la fois
const LIST_H_PAD = 18;
const CARD_MARGIN = 12;                          // marge entre cartes
const CARD_WIDTH  = SW - LIST_H_PAD * 2 - 32;   // écran - padding liste - respiration
const ITEM_WIDTH  = CARD_WIDTH + CARD_MARGIN;    // unité de snap
const HERO_BR = 48;

// ─── Helpers ─────────────────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

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

// ─── Hero Parapluie ───────────────────────────────────────
function UmbrellaHero({ children, animValue }: { children: React.ReactNode; animValue: Animated.Value }) {
  return (
    <Animated.View
      style={[
        s.heroOuter,
        {
          opacity: animValue,
          transform: [{
            translateY: animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0],
            }),
          }],
        },
      ]}
    >
      <LinearGradient
        colors={["#2461FF", "#1240D6", "#0E32B8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.heroGradient}
      >
        {/* Décos géométriques subtiles */}
        <View style={s.heroDeco1} />
        <View style={s.heroDeco2} />
        <View style={s.heroDeco3} />
        {children}
      </LinearGradient>
      {/* Coins concaves pageBg */}
      <View style={s.heroCornerLeft} />
      <View style={s.heroCornerRight} />
    </Animated.View>
  );
}

// ─── Currency Carousel Card ───────────────────────────────
function CurrencyCard({
  currency, balance, reserved, txCount,
}: {
  currency: keyof typeof T.currencies;
  balance: number;
  reserved: number;
  txCount: number;
}) {
  const cfg = T.currencies[currency];
  const available = balance - reserved;
  const pct = balance > 0 ? Math.min((available / balance) * 100, 100) : 0;

  return (
    <View style={[ccS.card, { width: CARD_WIDTH, borderTopColor: cfg.color }]}>
      {/* Accent bande colorée */}
      <View style={[ccS.topStripe, { backgroundColor: cfg.color }]} />

      {/* En-tête devise */}
      <View style={ccS.headerRow}>
        <View style={[ccS.flagBox, { backgroundColor: cfg.bg }]}>
          <Text style={{ fontSize: 26 }}>{cfg.flag}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ccS.codeTxt, { color: cfg.color, fontFamily: T.font.mono }]}>{cfg.code}</Text>
          <Text style={[ccS.nameTxt, { fontFamily: T.font.subtitle }]}>{cfg.name}</Text>
        </View>
        <View style={[ccS.txBadge, { backgroundColor: cfg.bg }]}>
          <Ionicons name="swap-horizontal-outline" size={11} color={cfg.color} />
          <Text style={[ccS.txTxt, { color: cfg.color, fontFamily: T.font.sans }]}>
            {txCount} TX
          </Text>
        </View>
      </View>

      {/* Séparateur */}
      <View style={[ccS.divider, { backgroundColor: `${cfg.color}18` }]} />

      {/* Montant principal */}
      <Text style={[ccS.balLabel, { fontFamily: T.font.sans }]}>TRÉSORERIE TOTALE</Text>
      <Text
        style={[ccS.balAmount, { color: cfg.colorDark, fontFamily: T.font.display }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {fmtAmount(balance, cfg.code)}
      </Text>
      <View style={ccS.symbolRow}>
        <View style={[ccS.symbolPill, { backgroundColor: cfg.bg }]}>
          <Text style={[ccS.symbolTxt, { color: cfg.color, fontFamily: T.font.mono }]}>
            {cfg.symbol} · {cfg.code}
          </Text>
        </View>
      </View>

      {/* Barre de progression */}
      <View style={ccS.progSection}>
        <View style={ccS.progRow}>
          <View style={ccS.progItem}>
            <View style={[ccS.progDot, { backgroundColor: cfg.color }]} />
            <Text style={[ccS.progKey, { fontFamily: T.font.subtitle }]}>Disponible</Text>
          </View>
          <Text style={[ccS.progVal, { color: cfg.colorDark, fontFamily: T.font.mono }]}>
            {fmtAmount(available, cfg.code)} {cfg.symbol}
          </Text>
        </View>

        <View style={ccS.barBg}>
          <Animated.View style={[ccS.barFill, { width: `${pct}%` as any, backgroundColor: cfg.color }]} />
        </View>

        <View style={ccS.progRow}>
          <View style={ccS.progItem}>
            <View style={[ccS.progDot, { backgroundColor: T.inkMuted }]} />
            <Text style={[ccS.progKey, { fontFamily: T.font.subtitle }]}>Réservé</Text>
          </View>
          <Text style={[ccS.progVal, { color: T.inkSub, fontFamily: T.font.mono }]}>
            {fmtAmount(reserved, cfg.code)} {cfg.symbol}
          </Text>
        </View>
      </View>
    </View>
  );
}

const ccS = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: T.radius.xl,
    backgroundColor: T.surface,
    overflow: "hidden",
    borderWidth: 1,
    borderTopWidth: 4,
    borderColor: T.border,
    padding: 18,
    ...T.shadow.deep,
  },
  topStripe: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 80,
    opacity: 0.04,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  flagBox: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
  },
  codeTxt: { fontSize: 14, fontWeight: "900", letterSpacing: 2 },
  nameTxt: { fontSize: 13, color: T.inkSub, marginTop: 2 },
  txBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  txTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  divider: { height: 1, marginBottom: 18 },
  balLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.8, color: T.inkMuted, marginBottom: 6 },
  balAmount: { fontSize: 34, fontWeight: "700", letterSpacing: -1, marginBottom: 8 },
  symbolRow: { marginBottom: 20 },
  symbolPill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  symbolTxt: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  progSection: { gap: 6 },
  progRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  progDot: { width: 6, height: 6, borderRadius: 99 },
  progKey: { fontSize: 12, color: T.inkSub },
  progVal: { fontSize: 12, fontWeight: "700" },
  barBg: { height: 6, backgroundColor: "#EEF2F8", borderRadius: 99, overflow: "hidden", marginVertical: 6 },
  barFill: { height: 6, borderRadius: 99 },
});

// ─── Stat Card ────────────────────────────────────────────
function StatCard({ label, value, icon, color, bgColor }: {
  label: string; value: number; icon: string; color: string; bgColor: string;
}) {
  return (
    <View style={stS.card}>
      <View style={[stS.iconBox, { backgroundColor: bgColor }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[stS.value, { color, fontFamily: T.font.display }]}>{value}</Text>
      <Text style={[stS.label, { fontFamily: T.font.sans }]}>{label}</Text>
    </View>
  );
}

const stS = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: T.radius.lg,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: T.border,
    ...T.shadow.card,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: "center", alignItems: "center", marginBottom: 10,
  },
  value: { fontSize: 28, fontWeight: "700", marginBottom: 4 },
  label: { fontSize: 9, color: T.inkMuted, fontWeight: "700", letterSpacing: 1, textAlign: "center" },
});

// ─── Action Card ─────────────────────────────────────────
function ActionCard({ action }: { action: any }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }], width: "48%", marginBottom: 12 }}>
      <TouchableOpacity
        onPress={action.onPress}
        onPressIn={() =>
          Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()
        }
        activeOpacity={1}
        style={acS.card}
      >
        {/* Bandeau coloré haut */}
        <View style={[acS.topBar, { backgroundColor: action.color }]} />

        <View style={[acS.iconBox, { backgroundColor: action.bgColor }]}>
          <Ionicons name={action.icon} size={24} color={action.color} />
        </View>

        <Text style={[acS.title, { fontFamily: T.font.sans }]} numberOfLines={1}>
          {action.title}
        </Text>
        <Text style={[acS.sub, { fontFamily: T.font.subtitle }]} numberOfLines={1}>
          {action.subtitle}
        </Text>

        <View style={[acS.arrowBox, { backgroundColor: action.bgColor }]}>
          <Ionicons name="arrow-forward" size={12} color={action.color} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const acS = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius.lg,
    padding: 18,
    paddingTop: 22,
    borderWidth: 1,
    borderColor: T.border,
    overflow: "hidden",
    ...T.shadow.card,
  },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 3, opacity: 0.8 },
  iconBox: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: "center", alignItems: "center", marginBottom: 14,
  },
  title: { fontSize: 13, fontWeight: "700", color: T.ink, marginBottom: 3 },
  sub: { fontSize: 11, color: T.inkSub },
  arrowBox: {
    position: "absolute", right: 12, top: 12,
    width: 26, height: 26, borderRadius: 8,
    justifyContent: "center", alignItems: "center",
  },
});

// ─── Client Card ─────────────────────────────────────────
function ClientCard({ item, onPress }: { item: any; onPress: () => void }) {
  const statusColor = T.statusColors[item.subscriptionStatus?.toUpperCase()] ?? T.inkMuted;

  return (
    <TouchableOpacity style={clS.card} onPress={onPress} activeOpacity={0.8}>
      {/* Avatar */}
      <View style={clS.avatar}>
        <Text style={[clS.avatarLetter, { fontFamily: T.font.display }]}>
          {(item.name?.[0] ?? "C").toUpperCase()}
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[clS.name, { fontFamily: T.font.sans }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={clS.metaRow}>
          <View style={clS.codeTag}>
            <Text style={[clS.codeText, { fontFamily: T.font.mono }]}>{item.code}</Text>
          </View>
          <View style={[clS.statusPill, { backgroundColor: `${statusColor}12`, borderColor: `${statusColor}30` }]}>
            <View style={[clS.dot, { backgroundColor: statusColor }]} />
            <Text style={[clS.statusText, { color: statusColor, fontFamily: T.font.sans }]}>
              {item.subscriptionStatus}
            </Text>
          </View>
        </View>
      </View>

      <View style={clS.right}>
        <View style={clS.typePill}>
          <Text style={[clS.typeText, { fontFamily: T.font.subtitle }]}>
            {item.subscriptionType === "PURCHASE" ? "Achat" : "Location"}
          </Text>
        </View>
        <View style={[clS.chevronBox, { backgroundColor: T.blueLt }]}>
          <Ionicons name="chevron-forward" size={12} color={T.blue} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const clS = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.surface,
    borderRadius: T.radius.lg,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T.border,
    gap: 12,
    ...T.shadow.soft,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 13,
    backgroundColor: T.blueLt,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: T.blueMd,
  },
  avatarLetter: { fontSize: 20, fontWeight: "700", color: T.blue },
  name: { color: T.ink, fontSize: 14, fontWeight: "700", marginBottom: 5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  codeTag: {
    backgroundColor: "#F8FAFF", borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: T.border,
  },
  codeText: { color: T.amber, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 7, borderWidth: 1,
  },
  dot: { width: 4, height: 4, borderRadius: 99 },
  statusText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  right: { alignItems: "flex-end", gap: 7 },
  typePill: {
    backgroundColor: "#F8FAFF", paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 7, borderWidth: 1, borderColor: T.border,
  },
  typeText: { color: T.inkSub, fontSize: 10 },
  chevronBox: {
    width: 26, height: 26, borderRadius: 8,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.blueMd,
  },
});

// ─── Dots carrousel ───────────────────────────────────────
const CURRENCIES_ORDER = ["EUR", "USD", "XOF", "GNF", "GBP"] as const;

function CurrencyDots({ active, total }: { active: number; total: number }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 16, marginBottom: 26 }}>
      {Array.from({ length: total }).map((_, i) => {
        const cfg = T.currencies[CURRENCIES_ORDER[i] as keyof typeof T.currencies];
        const isActive = i === active;
        return (
          <View
            key={i}
            style={{
              width: isActive ? 22 : 6,
              height: 6,
              borderRadius: 99,
              backgroundColor: isActive ? cfg.color : T.borderMd,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Section Header ───────────────────────────────────────
function SectionHeader({ dot, label, right }: { dot: string; label: string; right?: React.ReactNode }) {
  return (
    <View style={shS.row}>
      <View style={[shS.dot, { backgroundColor: dot }]} />
      <Text style={[shS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      {right}
    </View>
  );
}
const shS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14, marginLeft: 2 },
  dot: { width: 7, height: 7, borderRadius: 99 },
  label: { flex: 1, fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.6 },
});

// ─── Main Component ───────────────────────────────────────
export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role || "SUPER_ADMIN";
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [clients, setClients]             = useState<any[]>([]);
  const [wallets, setWallets]             = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [q, setQ]                         = useState("");
  const [createOpen, setCreateOpen]       = useState(false);
  const [activeCurrency, setActiveCurrency] = useState(0);

  const carouselRef = useRef<ScrollView>(null);
  const headerAnim  = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  const runEntrance = useCallback(() => {
    Animated.stagger(100, [
      Animated.spring(headerAnim,  { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 4 }),
      Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 3 }),
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
      setClients(list.map((c: any) => ({
        id: c.id?.toString(),
        name: c.name || "Client",
        code: c.code || "N/A",
        subscriptionStatus: c.subscriptionStatus || "ACTIVE",
        subscriptionType: c.subscriptionType || "RENTAL",
        ...c,
      })));
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

  const getWalletBalance = useCallback((currency: string) => {
    const w = wallets.find((x) => x.currency === currency);
    return { balance: toNum(w?.balance), reserved: toNum(w?.reservedBalance), txCount: 0 };
  }, [wallets]);

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
    {
      title: "Trésorerie", subtitle: "Vue globale",
      icon: "wallet-outline", color: T.blue, bgColor: T.blueLt,
      onPress: () => router.push("/(tabs)/admin/treasury"),
    },
    {
      title: "Taux & Devises", subtitle: "5 devises",
      icon: "trending-up-outline", color: T.amber, bgColor: T.amberLt,
      onPress: () => router.push("/(tabs)/admin/rates"),
    },
    {
      title: "Transactions", subtitle: "Audit temps réel",
      icon: "analytics-outline", color: T.green, bgColor: T.greenLt,
      onPress: () => router.push("/(tabs)/admin/transactions"),
    },
    {
      title: "Utilisateurs", subtitle: "Accès & Rôles",
      icon: "people-outline", color: T.purple, bgColor: T.purpleLt,
      onPress: () => router.push("/(tabs)/admin/users"),
    },
  ], [router]);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={T.blueDeep} barStyle="light-content" />

      <View style={s.screen}>
        {/* ══ HERO PARAPLUIE ══ */}
        <UmbrellaHero animValue={headerAnim}>
          <View style={s.heroContent}>
            <View style={{ flex: 1 }}>
              <View style={s.heroBadge}>
                <View style={s.heroBadgeDot} />
                <Text style={[s.heroBadgeTxt, { fontFamily: T.font.sans }]}>
                  SUPER ADMINISTRATION
                </Text>
              </View>
              <Text style={[s.heroTitle, { fontFamily: T.font.display }]}>
                Console Globale
              </Text>
              <Text style={[s.heroSub, { fontFamily: T.font.subtitle }]}>
                {user?.firstName ? `${user.firstName}  ·  ` : ""}Direct Transf'air™
              </Text>
            </View>

            <View style={s.heroActions}>
              <TouchableOpacity style={s.heroBtn} onPress={() => void loadData("refresh")}>
                <Ionicons name="refresh" size={18} color={T.white} />
              </TouchableOpacity>
              <TouchableOpacity style={s.heroBtn} onPress={() => router.push("/(tabs)/admin/notifications")}>
                <Ionicons name="notifications" size={18} color={T.white} />
                <View style={s.notifDot} />
              </TouchableOpacity>
            </View>
          </View>
        </UmbrellaHero>

        {/* ══ SCROLLABLE ══ */}
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <ClientCard
              item={item}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/admin/clients/details",
                  params: { id: item.id },
                })
              }
            />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: T.pageBg }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadData("refresh")} tintColor={T.blue} />
          }
          ListHeaderComponent={
            <Animated.View
              style={{
                opacity: contentAnim,
                transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
              }}
            >
              {/* STAT CARDS */}
              <View style={s.statsRow}>
                <StatCard label="SOCIÉTÉS"  value={stats.total}    icon="business-outline"         color={T.blue}  bgColor={T.blueLt}  />
                <StatCard label="ACTIVES"   value={stats.active}   icon="checkmark-circle-outline" color={T.green} bgColor={T.greenLt} />
                <StatCard label="INACTIVES" value={stats.inactive} icon="close-circle-outline"     color={T.red}   bgColor={T.redLt}   />
              </View>

              {/* TRÉSORERIE */}
              <SectionHeader dot={T.amber} label="TRÉSORERIE · 5 DEVISES" />

              {/* ── CARROUSEL : FlatList horizontal, 1 seule carte à la fois ──
                  • FlatList sorti du padding du parent via marginHorizontal négatif
                  • pagingEnabled sur ITEM_WIDTH via snapToInterval
                  • getItemLayout pour un snap instantané et précis
              */}
              <FlatList
                horizontal
                data={CURRENCIES_ORDER as unknown as string[]}
                keyExtractor={(cur) => cur}
                showsHorizontalScrollIndicator={false}
                snapToInterval={ITEM_WIDTH}
                snapToAlignment="start"
                decelerationRate="fast"
                getItemLayout={(_, index) => ({
                  length: ITEM_WIDTH,
                  offset: ITEM_WIDTH * index,
                  index,
                })}
                style={{ marginHorizontal: -LIST_H_PAD }}
                contentContainerStyle={{ paddingHorizontal: LIST_H_PAD }}
                onScroll={(e) => {
                  const idx = Math.round(
                    e.nativeEvent.contentOffset.x / ITEM_WIDTH
                  );
                  setActiveCurrency(
                    Math.max(0, Math.min(idx, CURRENCIES_ORDER.length - 1))
                  );
                }}
                scrollEventThrottle={16}
                renderItem={({ item: cur }) => {
                  const d = getWalletBalance(cur);
                  return (
                    <View style={{ width: ITEM_WIDTH, paddingRight: CARD_MARGIN }}>
                      <CurrencyCard
                        currency={cur as keyof typeof T.currencies}
                        balance={d.balance}
                        reserved={d.reserved}
                        txCount={d.txCount}
                      />
                    </View>
                  );
                }}
              />

              <CurrencyDots active={activeCurrency} total={CURRENCIES_ORDER.length} />

              {/* PILOTAGE */}
              <SectionHeader dot={T.blue} label="PILOTAGE RÉSEAU" />
              <View style={s.actionsGrid}>
                {actions.map((a) => <ActionCard key={a.title} action={a} />)}
              </View>

              {/* RECHERCHE */}
              <View style={s.searchBox}>
                <Ionicons name="search" size={16} color={T.inkMuted} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Rechercher un client SaaS..."
                  placeholderTextColor={T.inkMuted}
                  style={[s.searchInput, { fontFamily: T.font.subtitle }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!q && (
                  <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn}>
                    <Ionicons name="close" size={13} color={T.inkMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* CLIENTS */}
              <SectionHeader
                dot={T.green}
                label={`CLIENTS SAAS · ${filtered.length}`}
                right={
                  <TouchableOpacity
                    style={[s.addBtn, !isSuperAdmin && { opacity: 0.4 }]}
                    onPress={() => {
                      if (!isSuperAdmin) { Alert.alert("Accès refusé", "Seul le Super Admin peut créer une société."); return; }
                      setCreateOpen(true);
                    }}
                  >
                    <LinearGradient colors={[T.blue, T.blueDark]} style={s.addBtnGrad}>
                      <Ionicons name="add" size={18} color={T.white} />
                    </LinearGradient>
                  </TouchableOpacity>
                }
              />

              {loading && <ActivityIndicator color={T.blue} style={{ marginVertical: 28 }} size="large" />}
            </Animated.View>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <Ionicons name="business-outline" size={32} color={T.inkMuted} />
                </View>
                <Text style={[s.emptyTitle, { fontFamily: T.font.display }]}>Aucun client trouvé</Text>
                <Text style={[s.emptySub, { fontFamily: T.font.subtitle }]}>
                  Modifiez votre recherche ou créez un nouveau client SaaS
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={<View style={{ height: 130 }} />}
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

// ─── Styles globaux ───────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: T.pageBg },
  screen: { flex: 1, backgroundColor: T.pageBg },

  // ── Hero ──
  heroOuter: {
    zIndex: 10,
    shadowColor: "#0A2FA8",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 36,
    elevation: 24,
  },
  heroGradient: {
    borderBottomLeftRadius: HERO_BR,
    borderBottomRightRadius: HERO_BR,
    overflow: "hidden",
    paddingBottom: 32,
  },
  heroCornerLeft: {
    position: "absolute", bottom: 0, left: 0,
    width: HERO_BR, height: HERO_BR,
    backgroundColor: T.pageBg,
    borderTopRightRadius: HERO_BR,
  },
  heroCornerRight: {
    position: "absolute", bottom: 0, right: 0,
    width: HERO_BR, height: HERO_BR,
    backgroundColor: T.pageBg,
    borderTopLeftRadius: HERO_BR,
  },
  heroDeco1: {
    position: "absolute", width: 220, height: 220, borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.07)", top: -70, right: -50,
  },
  heroDeco2: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.05)", bottom: -40, left: 30,
  },
  heroDeco3: {
    position: "absolute", width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.04)", top: 30, left: "42%",
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 22,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 18 : 18,
    paddingBottom: 40,
    gap: 10,
  },
  heroBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: "flex-start", marginBottom: 12,
  },
  heroBadgeDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: "#4ADE80" },
  heroBadgeTxt: { color: "rgba(255,255,255,0.92)", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  heroTitle: { color: T.white, fontSize: 30, fontWeight: "700", marginBottom: 6, letterSpacing: -0.5 },
  heroSub: { color: "rgba(255,255,255,0.72)", fontSize: 14 },
  heroActions: { flexDirection: "row", gap: 9, paddingBottom: 4 },
  heroBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
    justifyContent: "center", alignItems: "center",
  },
  notifDot: {
    position: "absolute", top: 9, right: 9,
    width: 8, height: 8, borderRadius: 99,
    backgroundColor: "#EF4444",
    borderWidth: 1.5, borderColor: T.blue,
  },

  list: { paddingHorizontal: LIST_H_PAD },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 22, marginBottom: 28 },

  actionsGrid: {
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "space-between", marginBottom: 24,
  },

  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface,
    borderRadius: T.radius.lg,
    paddingHorizontal: 14, height: 50,
    borderWidth: 1, borderColor: T.border,
    marginBottom: 16, gap: 9,
    ...T.shadow.soft,
  },
  searchInput: { flex: 1, fontSize: 14, color: T.ink },
  clearBtn: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: "#F1F5F9",
    justifyContent: "center", alignItems: "center",
  },

  addBtn: {},
  addBtnGrad: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },

  empty: { alignItems: "center", paddingVertical: 52, gap: 10 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: T.blueLt,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.blueMd,
    ...T.shadow.card,
  },
  emptyTitle: { color: T.ink, fontSize: 17, fontWeight: "700" },
  emptySub: { color: T.inkMuted, fontSize: 13, textAlign: "center", lineHeight: 20, paddingHorizontal: 24 },
});