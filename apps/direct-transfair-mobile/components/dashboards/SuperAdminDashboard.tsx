// apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
// =========================================================
// SUPER ADMIN DASHBOARD — Direct Transf'air v5.3
// ✅ Hero forme PARAPLUIE CORRECTE : convexe vers le BAS
//    → Une View bleue elliptique dépasse sous le gradient,
//      surplombant les stat cards comme un parapluie ouvert.
// ✅ Ombres très profondes sur toutes les cartes
// ✅ Police Futura / Trebuchet MS (esprit BNP Paribas)
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
  blue:        "#1956F0",
  blueDark:    "#1240D6",
  blueLt:      "#EEF2FF",
  blueMd:      "#C7D5FF",

  pageBg:      "#F0F4FF",
  surface:     "#FFFFFF",
  border:      "#E2E8F0",

  ink:         "#0F172A",
  inkMid:      "#475569",
  inkMuted:    "#94A3B8",

  green:       "#16A34A",
  greenLt:     "#DCFCE7",
  red:         "#DC2626",
  redLt:       "#FEE2E2",
  amber:       "#D97706",
  amberLt:     "#FEF3C7",
  purple:      "#7C3AED",
  purpleLt:    "#EDE9FE",

  white:       "#FFFFFF",

  currencies: {
    EUR: { code: "EUR", symbol: "€",   flag: "🇪🇺", color: "#1956F0", bg: "#EEF2FF", name: "Euro" },
    USD: { code: "USD", symbol: "$",   flag: "🇺🇸", color: "#16A34A", bg: "#DCFCE7", name: "Dollar US" },
    XOF: { code: "XOF", symbol: "CFA", flag: "🌍",  color: "#D97706", bg: "#FEF3C7", name: "Franc CFA" },
    GNF: { code: "GNF", symbol: "FG",  flag: "🇬🇳", color: "#DC2626", bg: "#FEE2E2", name: "Franc Guinéen" },
    GBP: { code: "GBP", symbol: "£",   flag: "🇬🇧", color: "#7C3AED", bg: "#EDE9FE", name: "Livre Sterling" },
  },

  statusColors: {
    ACTIVE:    "#16A34A",
    SUSPENDED: "#D97706",
    INACTIVE:  "#DC2626",
    EXPIRED:   "#DC2626",
    TRIAL:     "#6366F1",
  } as Record<string, string>,

  radius: { sm: 10, md: 12, lg: 16, xl: 20, xxl: 28 },

  font: {
    // Titres : Georgia (serif élégant, proche de l'identité BNP)
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    // Labels & badges : Futura / Trebuchet MS — géométrique, esprit BNP Paribas
    sans:    Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "sans-serif" }),
    // Sous-titres : Futura / Trebuchet ultra-léger, JAMAIS gras
    subtitle: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// Hauteur du "ventre" de parapluie qui dépasse sous le hero vers les stat cards
const UMBRELLA_BELLY = 44;
// Largeur compacte des cartes devises
const CARD_WIDTH = Math.round(SW * 0.72);

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

// ─── Umbrella Hero ────────────────────────────────────────
// FORME PARAPLUIE FINALE — comme le dessin :
//
//   ╔══════════════════════════════════╗   ← haut plat
//   ║   gradient bleu  (contenu)       ║
//   ║                                  ║
//   ╚══╗                          ╔══╝   ← coins bas concaves (rentrent vers l'int.)
//       ╚══════════════════════╝         ← bas arrondi convexe vers le bas
//
// TECHNIQUE :
//   1. Le gradient a borderBottomLeftRadius + borderBottomRightRadius très grands (60)
//      avec overflow:"hidden" → cela arrondit le bas du hero vers l'intérieur
//      = les CÔTÉS du bas rentrent → look "parapluie" / "chapeau"
//   2. Deux Views "oreilles" en pageBg positionnées en absolute aux coins bas,
//      avec borderRadius sur le coin intérieur → elles "mangent" les angles
//      et accentuent l'effet de concavité aux coins
//   3. Ombre portée sur le wrapper pour donner du relief

const HERO_BR = 56; // border-radius du bas du hero

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
              outputRange: [-24, 0],
            }),
          }],
        },
      ]}
    >
      {/* Gradient avec coins bas très arrondis = forme parapluie */}
      <LinearGradient
        colors={["#2461FF", "#1240D6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.heroGradient}
      >
        <View style={s.heroDeco1} />
        <View style={s.heroDeco2} />
        <View style={s.heroDeco3} />
        {children}
      </LinearGradient>

      {/* Coin concave BAS-GAUCHE : carré pageBg avec borderTopRightRadius
          positionné en bas-gauche → mange le coin arrondi du gradient
          et crée l'illusion d'une "encoche" concave à gauche             */}
      <View style={s.heroCornerLeft} />
      {/* Coin concave BAS-DROIT (symétrique) */}
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
      <View style={[ccS.topAccent, { backgroundColor: cfg.color }]} />

      <View style={ccS.topRow}>
        <View style={[ccS.flagBox, { backgroundColor: cfg.bg, borderColor: `${cfg.color}25` }]}>
          <Text style={{ fontSize: 22 }}>{cfg.flag}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ccS.code, { color: cfg.color, fontFamily: T.font.mono }]}>{cfg.code}</Text>
          {/* Sous-titre style BNP — Gill Sans, poids 300, sans gras */}
          <Text style={[ccS.curName, { fontFamily: T.font.subtitle, fontWeight: "300" }]}>{cfg.name}</Text>
        </View>
        <View style={[ccS.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[ccS.badgeTxt, { color: cfg.color, fontFamily: T.font.sans }]}>
            {txCount} TX
          </Text>
        </View>
      </View>

      <Text style={[ccS.balLabel, { fontFamily: T.font.sans }]}>TRÉSORERIE TOTALE</Text>
      <Text
        style={[ccS.balAmount, { fontFamily: T.font.display, color: T.ink }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {fmtAmount(balance, cfg.code)}
      </Text>
      <Text style={[ccS.balSymbol, { color: cfg.color, fontFamily: T.font.sans }]}>
        {cfg.symbol} · {cfg.code}
      </Text>

      <View style={ccS.progSection}>
        <View style={ccS.progRow}>
          {/* Libellés sous-titres en Gill Sans léger */}
          <Text style={[ccS.progLabel, { fontFamily: T.font.subtitle, fontWeight: "300" }]}>Disponible</Text>
          <Text style={[ccS.progVal, { color: cfg.color, fontFamily: T.font.mono }]}>
            {fmtAmount(available, cfg.code)} {cfg.symbol}
          </Text>
        </View>
        <View style={ccS.progBarBg}>
          <View style={[ccS.progBarFill, { width: `${pct}%` as any, backgroundColor: cfg.color }]} />
        </View>
        <View style={ccS.progRow}>
          <Text style={[ccS.progLabel, { fontFamily: T.font.subtitle, fontWeight: "300" }]}>Réservé</Text>
          <Text style={[ccS.progVal, { color: T.inkMuted, fontFamily: T.font.mono }]}>
            {fmtAmount(reserved, cfg.code)} {cfg.symbol}
          </Text>
        </View>
      </View>
    </View>
  );
}

const ccS = StyleSheet.create({
  card: {
    borderRadius: T.radius.xl,
    padding: 20,
    marginRight: 14,
    borderWidth: 1,
    borderTopWidth: 4,
    borderColor: T.border,
    backgroundColor: T.surface,
    overflow: "hidden",
    // Ombres professionnelles renforcées
    shadowColor: "#1240D6",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  topAccent: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 64, opacity: 0.05,
  },
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 10 },
  flagBox: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: "center", alignItems: "center", borderWidth: 1,
  },
  code: { fontSize: 13, fontWeight: "900", letterSpacing: 1.8 },
  // Sous-titre devise : Gill Sans léger, style BNP
  curName: { fontSize: 13, color: T.inkMuted, marginTop: 2 },
  badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  badgeTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  balLabel: {
    color: T.inkMuted, fontSize: 10, fontWeight: "800",
    letterSpacing: 1.6, marginBottom: 5,
  },
  // Montant agrandi : 32 → beaucoup plus lisible
  balAmount: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5, marginBottom: 3 },
  balSymbol: { fontSize: 13, fontWeight: "700", letterSpacing: 0.3, marginBottom: 16 },
  progSection: { gap: 5 },
  progRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progLabel: { color: T.inkMuted, fontSize: 11 },
  progVal: { fontSize: 11, fontWeight: "800" },
  progBarBg: {
    height: 5, backgroundColor: "#EEF2F8",
    borderRadius: 99, overflow: "hidden", marginVertical: 5,
  },
  progBarFill: { height: 5, borderRadius: 99 },
});

// ─── Stat Card ────────────────────────────────────────────
function StatCard({ label, value, icon, color, bgColor }: {
  label: string; value: number; icon: string;
  color: string; bgColor: string;
}) {
  return (
    <View style={stS.card}>
      <View style={[stS.iconBox, { backgroundColor: bgColor }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[stS.value, { fontFamily: T.font.display, color }]}>{value}</Text>
      {/* Label en Gill Sans léger */}
      <Text style={[stS.label, { fontFamily: T.font.subtitle, fontWeight: "300" }]}>{label}</Text>
    </View>
  );
}

const stS = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: T.radius.lg,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: T.border,
    // Ombres renforcées — caractère pro
    shadowColor: "#1240D6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 11,
    justifyContent: "center", alignItems: "center", marginBottom: 9,
  },
  value: { fontSize: 24, fontWeight: "700", marginBottom: 3 },
  label: {
    fontSize: 9, color: T.inkMuted,
    letterSpacing: 0.9, textAlign: "center",
  },
});

// ─── Action Card ─────────────────────────────────────────
function ActionCard({ action }: { action: any }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }], width: "48%", marginBottom: 12 }}>
      <TouchableOpacity
        onPress={action.onPress}
        onPressIn={() =>
          Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()
        }
        activeOpacity={1}
        style={acS.card}
      >
        <View style={[acS.iconBox, { backgroundColor: action.bgColor }]}>
          <Ionicons name={action.icon} size={22} color={action.color} />
        </View>
        <View style={[acS.arrow, { backgroundColor: action.bgColor }]}>
          <Ionicons name="arrow-forward" size={12} color={action.color} />
        </View>
        <Text style={[acS.title, { fontFamily: T.font.sans }]} numberOfLines={1}>
          {action.title}
        </Text>
        {/* Sous-titre action : Gill Sans léger, style BNP */}
        <Text style={[acS.sub, { fontFamily: T.font.subtitle, fontWeight: "300" }]} numberOfLines={1}>
          {action.subtitle}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const acS = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius.lg,
    padding: 17,
    borderWidth: 1,
    borderColor: T.border,
    // Ombres profondes sur les cartes action
    shadowColor: "#1240D6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    overflow: "hidden",
  },
  iconBox: {
    width: 46, height: 46, borderRadius: 13,
    justifyContent: "center", alignItems: "center", marginBottom: 13,
  },
  title: { fontSize: 13, fontWeight: "700", color: T.ink, marginBottom: 4 },
  sub: { fontSize: 11, color: T.inkMuted },
  arrow: {
    position: "absolute", right: 12, top: 12,
    width: 26, height: 26, borderRadius: 8,
    justifyContent: "center", alignItems: "center",
  },
});

// ─── Client Card ─────────────────────────────────────────
function ClientCard({ item, onPress }: { item: any; onPress: () => void }) {
  const statusColor = T.statusColors[item.subscriptionStatus?.toUpperCase()] ?? T.inkMuted;

  return (
    <TouchableOpacity style={clS.card} onPress={onPress} activeOpacity={0.75}>
      <View style={clS.avatar}>
        <Text style={[clS.avatarLetter, { fontFamily: T.font.display }]}>
          {(item.name?.[0] ?? "C").toUpperCase()}
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[clS.name, { fontFamily: T.font.display }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={clS.metaRow}>
          <View style={clS.codeTag}>
            <Text style={[clS.codeText, { fontFamily: T.font.mono }]}>{item.code}</Text>
          </View>
          <View
            style={[
              clS.statusPill,
              { backgroundColor: `${statusColor}15`, borderColor: `${statusColor}28` },
            ]}
          >
            <View style={[clS.dot, { backgroundColor: statusColor }]} />
            <Text style={[clS.statusText, { color: statusColor, fontFamily: T.font.sans }]}>
              {item.subscriptionStatus}
            </Text>
          </View>
        </View>
      </View>

      <View style={clS.right}>
        <View style={clS.typePill}>
          {/* Type abonnement : Gill Sans léger */}
          <Text style={[clS.typeText, { fontFamily: T.font.subtitle, fontWeight: "300" }]}>
            {item.subscriptionType === "PURCHASE" ? "Achat" : "Location"}
          </Text>
        </View>
        <View style={clS.chevronBox}>
          <Ionicons name="chevron-forward" size={13} color={T.blue} />
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
    padding: 15,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: T.border,
    // Ombres client card
    shadowColor: "#1240D6",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 6,
    gap: 12,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: T.blueLt,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.blueMd,
  },
  avatarLetter: { fontSize: 20, fontWeight: "700", color: T.blue },
  name: { color: T.ink, fontSize: 14, fontWeight: "700", marginBottom: 5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  codeTag: {
    backgroundColor: "#F8FAFF",
    borderRadius: 6,
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
    backgroundColor: "#F8FAFF",
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 7, borderWidth: 1, borderColor: T.border,
  },
  typeText: { color: T.inkMuted, fontSize: 10 },
  chevronBox: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: T.blueLt,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.blueMd,
  },
});

// ─── Dots carrousel ───────────────────────────────────────
const CURRENCIES_ORDER = ["EUR", "USD", "XOF", "GNF", "GBP"] as const;

function CurrencyDots({ active, total }: { active: number; total: number }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 5, marginBottom: 24 }}>
      {Array.from({ length: total }).map((_, i) => {
        const cfg = T.currencies[CURRENCIES_ORDER[i] as keyof typeof T.currencies];
        const isActive = i === active;
        return (
          <View
            key={i}
            style={{
              width: isActive ? 20 : 5,
              height: 5,
              borderRadius: 99,
              backgroundColor: isActive ? cfg.color : T.border,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────
export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role || "SUPER_ADMIN";
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [clients, setClients]       = useState<any[]>([]);
  const [wallets, setWallets]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ]                   = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [activeCurrency, setActiveCurrency] = useState(0);

  const carouselRef  = useRef<ScrollView>(null);
  const headerAnim   = useRef(new Animated.Value(0)).current;
  const contentAnim  = useRef(new Animated.Value(0)).current;

  const runEntrance = useCallback(() => {
    Animated.stagger(80, [
      Animated.spring(headerAnim,  { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }),
      Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }),
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

      const list = Array.isArray(rawClients)
        ? rawClients
        : ((rawClients as any)?.data ?? []);

      setClients(list.map((c: any) => ({
        id:                 c.id?.toString(),
        name:               c.name || "Client",
        code:               c.code || "N/A",
        subscriptionStatus: c.subscriptionStatus || "ACTIVE",
        subscriptionType:   c.subscriptionType   || "RENTAL",
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
    return {
      balance:  toNum(w?.balance),
      reserved: toNum(w?.reservedBalance),
      txCount:  0,
    };
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
      title: "Trésorerie",     subtitle: "Vue globale",
      icon: "wallet-outline",         color: T.blue,   bgColor: T.blueLt,
      onPress: () => router.push("/(tabs)/admin/treasury"),
    },
    {
      title: "Taux & Devises", subtitle: "5 devises actives",
      icon: "trending-up-outline",    color: T.amber,  bgColor: T.amberLt,
      onPress: () => router.push("/(tabs)/admin/rates"),
    },
    {
      title: "Transactions",   subtitle: "Audit temps réel",
      icon: "analytics-outline",      color: T.green,  bgColor: T.greenLt,
      onPress: () => router.push("/(tabs)/admin/transactions"),
    },
    {
      title: "Utilisateurs",   subtitle: "Accès & Rôles",
      icon: "people-outline",         color: T.purple, bgColor: T.purpleLt,
      onPress: () => router.push("/(tabs)/admin/users"),
    },
  ], [router]);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={T.blue} barStyle="light-content" />

      <View style={s.screen}>

        {/* ══════════════════════════════════════════════
            HERO PARAPLUIE
            La forme "parapluie" est obtenue grâce à :
            1. Un borderBottomLeftRadius et borderBottomRightRadius élevés
               sur heroOuter (overflow: hidden) → coupe le gradient en arc convexe
            2. Une View "umbrellaBump" positionnée en absolute en bas du gradient,
               de hauteur UMBRELLA_CURVE, avec borderRadius circulaire,
               backgroundColor pageBg → simule le "creux" central convexe
        ══════════════════════════════════════════════ */}
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
              {/* Sous-titre : Gill Sans style BNP, fontWeight "300", JAMAIS gras */}
              <Text style={[s.heroSub, { fontFamily: T.font.subtitle }]}>
                {user?.firstName ? `${user.firstName}  ·  ` : ""}Direct Transf'air™
              </Text>
            </View>

            <View style={s.heroActions}>
              <TouchableOpacity
                style={s.heroBtn}
                onPress={() => void loadData("refresh")}
              >
                <Ionicons name="refresh" size={18} color={T.white} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.heroBtn}
                onPress={() => router.push("/(tabs)/admin/notifications")}
              >
                <Ionicons name="notifications" size={18} color={T.white} />
                <View style={s.notifBadge} />
              </TouchableOpacity>
            </View>
          </View>
        </UmbrellaHero>

        {/* ══════════════════════════════════════════════
            CONTENU SCROLLABLE
        ══════════════════════════════════════════════ */}
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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadData("refresh")}
              tintColor={T.blue}
            />
          }
          ListHeaderComponent={
            <Animated.View
              style={{
                opacity: contentAnim,
                transform: [{
                  translateY: contentAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                }],
              }}
            >
              {/* ── Stat cards ──
                  marginTop: 24 : espace clair sous le hero parapluie,
                  les cartes ne "collent" plus à la courbe du bas du hero */}
              <View style={s.statsRow}>
                <StatCard
                  label="SOCIÉTÉS"  value={stats.total}
                  icon="business-outline"         color={T.blue}  bgColor={T.blueLt}
                />
                <StatCard
                  label="ACTIVES"   value={stats.active}
                  icon="checkmark-circle-outline" color={T.green} bgColor={T.greenLt}
                />
                <StatCard
                  label="INACTIVES" value={stats.inactive}
                  icon="close-circle-outline"     color={T.red}   bgColor={T.redLt}
                />
              </View>

              {/* Section trésorerie */}
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: T.amber }]} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>
                  TRÉSORERIE · 5 DEVISES
                </Text>
              </View>

              {/* Carrousel devises */}
              <ScrollView
                ref={carouselRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + 14}
                decelerationRate="fast"
                contentContainerStyle={{ paddingRight: 18 }}
                onScroll={(e) => {
                  const idx = Math.round(
                    e.nativeEvent.contentOffset.x / (CARD_WIDTH + 14)
                  );
                  setActiveCurrency(
                    Math.max(0, Math.min(idx, CURRENCIES_ORDER.length - 1))
                  );
                }}
                scrollEventThrottle={16}
              >
                {CURRENCIES_ORDER.map((cur) => {
                  const d = getWalletBalance(cur);
                  return (
                    <CurrencyCard
                      key={cur}
                      currency={cur}
                      balance={d.balance}
                      reserved={d.reserved}
                      txCount={d.txCount}
                    />
                  );
                })}
              </ScrollView>

              <CurrencyDots active={activeCurrency} total={CURRENCIES_ORDER.length} />

              {/* Actions rapides */}
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: T.blue }]} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>
                  PILOTAGE RÉSEAU
                </Text>
              </View>
              <View style={s.actionsGrid}>
                {actions.map((a) => (
                  <ActionCard key={a.title} action={a} />
                ))}
              </View>

              {/* Recherche */}
              <View style={s.searchBox}>
                <Ionicons name="search" size={16} color={T.inkMuted} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Rechercher un client SaaS..."
                  placeholderTextColor={T.inkMuted}
                  style={[s.searchInput, { fontFamily: T.font.subtitle, fontWeight: "300" }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!q && (
                  <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn}>
                    <Ionicons name="close" size={13} color={T.inkMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Section clients */}
              <View style={[s.sectionRow, { marginTop: 4 }]}>
                <View style={[s.sectionDot, { backgroundColor: T.green }]} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>
                  CLIENTS SAAS · {filtered.length}
                </Text>
                <TouchableOpacity
                  style={[s.addBtn, !isSuperAdmin && { opacity: 0.4 }]}
                  onPress={() => {
                    if (!isSuperAdmin) {
                      Alert.alert("Accès refusé", "Seul le Super Admin peut créer une société.");
                      return;
                    }
                    setCreateOpen(true);
                  }}
                >
                  <LinearGradient
                    colors={[T.blue, T.blueDark]}
                    style={s.addBtnGrad}
                  >
                    <Ionicons name="add" size={18} color={T.white} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {loading && (
                <ActivityIndicator
                  color={T.blue}
                  style={{ marginVertical: 28 }}
                  size="large"
                />
              )}
            </Animated.View>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <Ionicons name="business-outline" size={32} color={T.inkMuted} />
                </View>
                <Text style={[s.emptyTitle, { fontFamily: T.font.display }]}>
                  Aucun client trouvé
                </Text>
                <Text style={[s.emptySub, { fontFamily: T.font.subtitle, fontWeight: "300" }]}>
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

  // ══════════════════════════════════════════════
  // FORME PARAPLUIE — coins bas concaves, centre convexe
  // ──────────────────────────────────────────────
  // heroOuter : wrapper avec overflow:visible + ombre portée.
  //             Les "oreilles" (heroCornerLeft/Right) sont positionnées
  //             ici en absolute et dépassent légèrement sous le gradient.
  //
  // heroGradient : borderBottomLeftRadius + borderBottomRightRadius = HERO_BR (56)
  //               avec overflow:"hidden" → le gradient est coupé en forme
  //               de "chapeau" : bas arrondi vers le bas au centre,
  //               les bords du bas rentrent vers l'intérieur.
  //
  // heroCornerLeft/Right : carrés pageBg avec un seul borderRadius
  //   sur le coin intérieur → ils "mordent" les angles arrondis du gradient
  //   et accentuent la concavité visuelle des coins bas.
  // ══════════════════════════════════════════════
  heroOuter: {
    zIndex: 10,
    shadowColor: "#0A2FA8",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.40,
    shadowRadius: 32,
    elevation: 22,
  },
  heroGradient: {
    // Forme parapluie : coins bas très arrondis
    borderBottomLeftRadius:  HERO_BR,
    borderBottomRightRadius: HERO_BR,
    overflow: "hidden",
    paddingBottom: 28,
  },

  // "Oreille" gauche : rectangle pageBg en bas-gauche avec borderTopRightRadius
  // → efface le coin arrondi du gradient côté gauche, crée la concavité
  heroCornerLeft: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: HERO_BR,
    height: HERO_BR,
    backgroundColor: T.pageBg,
    borderTopRightRadius: HERO_BR,
  },
  // "Oreille" droite (symétrique)
  heroCornerRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: HERO_BR,
    height: HERO_BR,
    backgroundColor: T.pageBg,
    borderTopLeftRadius: HERO_BR,
  },

  heroDeco1: {
    position: "absolute", width: 240, height: 240, borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.07)", top: -80, right: -60,
  },
  heroDeco2: {
    position: "absolute", width: 130, height: 130, borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.05)", bottom: -50, left: 20,
  },
  heroDeco3: {
    position: "absolute", width: 70, height: 70, borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.04)", top: 20, left: "45%",
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 22,
    paddingTop: Platform.OS === "android"
      ? (StatusBar.currentHeight ?? 0) + 16
      : 16,
    paddingBottom: 36,   // padding bas étendu pour la courbe parapluie
    gap: 10,
  },
  heroBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: "flex-start", marginBottom: 10,
  },
  heroBadgeDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: "#4ADE80" },
  heroBadgeTxt: {
    color: "rgba(255,255,255,0.92)", fontSize: 10,
    fontWeight: "900", letterSpacing: 1.4,
  },
  heroTitle: {
    color: T.white, fontSize: 28, fontWeight: "700",
    marginBottom: 5, letterSpacing: -0.3,
  },
  // Sous-titre hero : Trebuchet MS (esprit BNP Paribas), fontWeight "300", jamais gras
  heroSub: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: "300",
    letterSpacing: 0.15,
  },
  heroActions: { flexDirection: "row", gap: 9, paddingBottom: 4 },
  heroBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
    justifyContent: "center", alignItems: "center",
  },
  notifBadge: {
    position: "absolute", top: 9, right: 9,
    width: 8, height: 8, borderRadius: 99,
    backgroundColor: "#EF4444",
    borderWidth: 1.5, borderColor: T.blue,
  },

  list: { paddingHorizontal: 18, paddingTop: 0 },

  // ── Stat cards ──
  // Stat cards : marginTop = UMBRELLA_BELLY + buffer
  // → elles commencent en dessous du dôme parapluie qui les surplombe
  statsRow: {
    flexDirection: "row", gap: 10,
    marginTop: 20,
    marginBottom: 26,
  },

  sectionRow: {
    flexDirection: "row", alignItems: "center",
    gap: 8, marginBottom: 13, marginLeft: 2,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 99 },
  sectionLabel: {
    flex: 1, fontSize: 10, fontWeight: "900",
    color: T.inkMuted, letterSpacing: 1.4,
  },

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
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 14, color: T.ink },
  clearBtn: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: "#F1F5F9",
    justifyContent: "center", alignItems: "center",
  },

  addBtn: { marginLeft: 8 },
  addBtnGrad: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },

  empty: { alignItems: "center", paddingVertical: 52, gap: 10 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: T.blueLt,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.blueMd,
    shadowColor: T.blue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 6,
  },
  emptyTitle: { color: T.ink, fontSize: 17, fontWeight: "700" },
  emptySub: {
    color: T.inkMuted, fontSize: 13, textAlign: "center",
    lineHeight: 20, paddingHorizontal: 24,
  },
});