// apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
// apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
// =========================================================
// SUPER ADMIN DASHBOARD — Direct Transf'air v4.0
// Design: Obsidian Luxury — noir profond + or champagne
// ✅ Carrousel 5 devises (XOF, EUR, USD, GNF, GBP)
// ✅ Sociétés SaaS avec gestion statut
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
const IS_WEB = Platform.OS === "web";

// ─── Design Tokens ──────────────────────────────────────
const T = {
  // Obsidian Luxury
  ink:      "#0A0A0F",
  inkDeep:  "#050508",
  inkMid:   "#12121A",
  inkLight: "#1C1C28",
  inkBorder:"#2A2A3A",
  gold:     "#D4A853",
  goldSoft: "#F0C97A",
  goldPale: "#FBF0D9",
  goldGlow: "rgba(212,168,83,0.15)",
  cream:    "#F5EFE0",
  creamDim: "#C4B89A",
  white:    "#FFFFFF",
  ghost:    "rgba(255,255,255,0.06)",
  ghostMid: "rgba(255,255,255,0.12)",
  ghostHi:  "rgba(255,255,255,0.22)",

  // Devises
  currencies: {
    EUR: { code: "EUR", symbol: "€", flag: "🇪🇺", color: "#4F83CC", bg: "#0D1B2E" },
    USD: { code: "USD", symbol: "$", flag: "🇺🇸", color: "#5BAD7A", bg: "#0D2018" },
    XOF: { code: "XOF", symbol: "Fr", flag: "🌍", color: "#D4A853", bg: "#1A1200" },
    GNF: { code: "GNF", symbol: "FG", flag: "🇬🇳", color: "#E05252", bg: "#1A0808" },
    GBP: { code: "GBP", symbol: "£", flag: "🇬🇧", color: "#8B5CF6", bg: "#120D1E" },
  },

  // Status
  statusColors: {
    ACTIVE:    "#22C55E",
    SUSPENDED: "#F59E0B",
    INACTIVE:  "#EF4444",
    EXPIRED:   "#EF4444",
    TRIAL:     "#6366F1",
  } as Record<string, string>,

  radius: { sm: 12, md: 18, lg: 24, xl: 32 },
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

// ─── Currency Carousel Card ──────────────────────────────
function CurrencyCard({
  currency, balance, reserved, txCount, width,
}: {
  currency: keyof typeof T.currencies;
  balance: number;
  reserved: number;
  txCount: number;
  width: number;
}) {
  const cfg = T.currencies[currency];
  const available = balance - reserved;
  const pct = balance > 0 ? Math.min((available / balance) * 100, 100) : 0;

  return (
    <View style={[ccS.card, { width: width - 48, backgroundColor: cfg.bg }]}>
      {/* Glow overlay */}
      <View style={[ccS.glow, { backgroundColor: `${cfg.color}08` }]} />

      <View style={ccS.topRow}>
        <View style={[ccS.flagBox, { borderColor: `${cfg.color}40` }]}>
          <Text style={{ fontSize: 20 }}>{cfg.flag}</Text>
        </View>
        <View style={ccS.codeBox}>
          <Text style={[ccS.code, { color: cfg.color, fontFamily: T.font.mono }]}>{cfg.code}</Text>
          <Text style={[ccS.symbol, { color: cfg.color, fontFamily: T.font.display }]}>{cfg.symbol}</Text>
        </View>
        <View style={[ccS.badge, { borderColor: `${cfg.color}30`, backgroundColor: `${cfg.color}10` }]}>
          <Text style={[ccS.badgeTxt, { color: cfg.color, fontFamily: T.font.sans }]}>
            {txCount} TX
          </Text>
        </View>
      </View>

      <View style={ccS.balSection}>
        <Text style={[ccS.balLabel, { fontFamily: T.font.sans }]}>TRÉSORERIE TOTALE</Text>
        <Text style={[ccS.balAmount, { color: T.white, fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit>
          {fmtAmount(balance, cfg.code)}
        </Text>
        <Text style={[ccS.balSymbol, { color: cfg.color, fontFamily: T.font.sans }]}>{cfg.symbol} {cfg.code}</Text>
      </View>

      {/* Progress bar disponible */}
      <View style={ccS.progSection}>
        <View style={ccS.progRow}>
          <Text style={[ccS.progLabel, { fontFamily: T.font.sans }]}>Disponible</Text>
          <Text style={[ccS.progVal, { color: cfg.color, fontFamily: T.font.mono }]}>
            {fmtAmount(available, cfg.code)} {cfg.symbol}
          </Text>
        </View>
        <View style={ccS.progBarBg}>
          <View style={[ccS.progBarFill, { width: `${pct}%` as any, backgroundColor: cfg.color }]} />
        </View>
        <View style={ccS.progRow}>
          <Text style={[ccS.progLabel, { fontFamily: T.font.sans }]}>Réservé</Text>
          <Text style={[ccS.progVal, { color: T.creamDim, fontFamily: T.font.mono }]}>
            {fmtAmount(reserved, cfg.code)} {cfg.symbol}
          </Text>
        </View>
      </View>

      {/* Indicateur pagination */}
      <View style={ccS.paginationHint}>
        <Ionicons name="chevron-forward" size={14} color={`${cfg.color}60`} />
      </View>
    </View>
  );
}

const ccS = StyleSheet.create({
  card: {
    borderRadius: T.radius.xl,
    padding: 24,
    marginRight: 16,
    borderWidth: 1,
    borderColor: T.inkBorder,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: T.radius.xl,
  },
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 12 },
  flagBox: {
    width: 46, height: 46, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, backgroundColor: T.ghost,
  },
  codeBox: { flex: 1, gap: 1 },
  code: { fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  symbol: { fontSize: 22, fontWeight: "700" },
  badge: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1,
  },
  badgeTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  balSection: { marginBottom: 20 },
  balLabel: { color: T.creamDim, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 6 },
  balAmount: { fontSize: 34, letterSpacing: -0.5, marginBottom: 2 },
  balSymbol: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  progSection: { gap: 6 },
  progRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progLabel: { color: T.creamDim, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  progVal: { fontSize: 11, fontWeight: "800" },
  progBarBg: { height: 4, backgroundColor: T.ghost, borderRadius: 99, overflow: "hidden" },
  progBarFill: { height: 4, borderRadius: 99 },
  paginationHint: { position: "absolute", right: 14, top: "50%" },
});

// ─── Stat Card ───────────────────────────────────────────
function StatCard({ label, value, icon, color }: any) {
  return (
    <View style={stS.card}>
      <View style={[stS.iconBox, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[stS.value, { color: T.white, fontFamily: T.font.display }]}>{value}</Text>
      <Text style={[stS.label, { fontFamily: T.font.sans }]}>{label}</Text>
    </View>
  );
}

const stS = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: T.inkLight, borderRadius: T.radius.lg,
    padding: 16, alignItems: "center", borderWidth: 1, borderColor: T.inkBorder,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  iconBox: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: "center", alignItems: "center", marginBottom: 10,
  },
  value: { fontSize: 26, fontWeight: "700", marginBottom: 2 },
  label: { fontSize: 10, color: T.creamDim, fontWeight: "800", letterSpacing: 1, textAlign: "center" },
});

// ─── Action Card ─────────────────────────────────────────
function ActionCard({ action }: { action: any }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }], width: "48%", marginBottom: 14 }}>
      <TouchableOpacity
        onPress={action.onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
        style={acS.card}
      >
        <View style={[acS.iconBox, { backgroundColor: `${action.color}12` }]}>
          <Ionicons name={action.icon} size={22} color={action.color} />
        </View>
        <Text style={[acS.title, { fontFamily: T.font.sans }]} numberOfLines={1}>{action.title}</Text>
        <Text style={[acS.sub, { fontFamily: T.font.sans }]} numberOfLines={1}>{action.subtitle}</Text>
        <View style={[acS.arrow, { backgroundColor: `${action.color}15` }]}>
          <Ionicons name="arrow-forward" size={12} color={action.color} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const acS = StyleSheet.create({
  card: {
    backgroundColor: T.inkLight, borderRadius: T.radius.lg,
    padding: 18, borderWidth: 1, borderColor: T.inkBorder,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
    overflow: "hidden",
  },
  iconBox: {
    width: 46, height: 46, borderRadius: 14,
    justifyContent: "center", alignItems: "center", marginBottom: 14,
  },
  title: { fontSize: 14, fontWeight: "800", color: T.white, marginBottom: 4 },
  sub: { fontSize: 11, color: T.creamDim, fontWeight: "600" },
  arrow: {
    position: "absolute", right: 14, top: 14,
    width: 26, height: 26, borderRadius: 8,
    justifyContent: "center", alignItems: "center",
  },
});

// ─── Client Card ─────────────────────────────────────────
function ClientCard({ item, onPress }: { item: any; onPress: () => void }) {
  const statusColor = T.statusColors[item.subscriptionStatus?.toUpperCase()] ?? T.creamDim;

  return (
    <TouchableOpacity style={clS.card} onPress={onPress} activeOpacity={0.8}>
      <View style={clS.left}>
        <LinearGradient
          colors={[T.inkMid, T.inkLight]}
          style={clS.avatar}
        >
          <Text style={[clS.avatarLetter, { fontFamily: T.font.display }]}>
            {(item.name?.[0] ?? "C").toUpperCase()}
          </Text>
        </LinearGradient>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[clS.name, { fontFamily: T.font.display }]} numberOfLines={1}>{item.name}</Text>
        <View style={clS.metaRow}>
          <View style={clS.codeTag}>
            <Text style={[clS.codeText, { fontFamily: T.font.mono }]}>{item.code}</Text>
          </View>
          <View style={[clS.statusPill, { backgroundColor: `${statusColor}15`, borderColor: `${statusColor}30` }]}>
            <View style={[clS.dot, { backgroundColor: statusColor }]} />
            <Text style={[clS.statusText, { color: statusColor, fontFamily: T.font.sans }]}>
              {item.subscriptionStatus}
            </Text>
          </View>
        </View>
      </View>

      <View style={clS.right}>
        <View style={[clS.typePill, { backgroundColor: T.ghost }]}>
          <Text style={[clS.typeText, { fontFamily: T.font.sans }]}>
            {item.subscriptionType === "PURCHASE" ? "Achat" : "Location"}
          </Text>
        </View>
        <View style={clS.chevronBox}>
          <Ionicons name="chevron-forward" size={14} color={T.gold} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const clS = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.inkLight, borderRadius: T.radius.lg,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: T.inkBorder,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
    gap: 14,
  },
  left: {},
  avatar: {
    width: 50, height: 50, borderRadius: 16,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  avatarLetter: { color: T.gold, fontSize: 22, fontWeight: "700" },
  name: { color: T.white, fontSize: 16, fontWeight: "700", marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  codeTag: {
    backgroundColor: T.ghost, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: T.inkBorder,
  },
  codeText: { color: T.gold, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  dot: { width: 5, height: 5, borderRadius: 99 },
  statusText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  right: { alignItems: "flex-end", gap: 8 },
  typePill: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: T.inkBorder,
  },
  typeText: { color: T.creamDim, fontSize: 10, fontWeight: "700" },
  chevronBox: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: T.goldGlow, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: `${T.gold}30`,
  },
});

// ─── Carrousel dots ──────────────────────────────────────
function CurrencyDots({ active, total }: { active: number; total: number }) {
  const CURRENCIES = ["XOF", "EUR", "USD", "GNF", "GBP"] as const;
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 20 }}>
      {Array.from({ length: total }).map((_, i) => {
        const cfg = T.currencies[CURRENCIES[i] as keyof typeof T.currencies];
        return (
          <View
            key={i}
            style={{
              width: i === active ? 20 : 6,
              height: 6,
              borderRadius: 99,
              backgroundColor: i === active ? cfg.color : T.inkBorder,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────
const CURRENCIES_ORDER = ["XOF", "EUR", "USD", "GNF", "GBP"] as const;

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role || "SUPER_ADMIN";
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [clients, setClients] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [activeCurrency, setActiveCurrency] = useState(0);
  const carouselRef = useRef<ScrollView>(null);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  const runEntrance = useCallback(() => {
    Animated.stagger(80, [
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }),
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

      const list = Array.isArray(rawClients) ? rawClients : ((rawClients as any)?.data ?? []);
      setClients(list.map((c: any) => ({
        id: c.id?.toString(),
        name: c.name || "Client",
        code: c.code || "N/A",
        subscriptionStatus: c.subscriptionStatus || "ACTIVE",
        subscriptionType: c.subscriptionType || "RENTAL",
        ...c,
      })));

      const wals = Array.isArray(rawWallets) ? rawWallets : [];
      setWallets(wals);
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.message || "Impossible de charger les données.");
    } finally {
      if (mode === "refresh") setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadData("init");
    runEntrance();
    return () => {};
  }, [loadData, runEntrance]));

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
    total: clients.length,
    active: clients.filter((c) => c.subscriptionStatus?.toUpperCase() === "ACTIVE").length,
    inactive: clients.filter((c) => ["INACTIVE", "EXPIRED", "SUSPENDED"].includes(c.subscriptionStatus?.toUpperCase())).length,
  }), [clients]);

  const actions = useMemo(() => [
    { title: "Trésorerie", subtitle: "Vue globale", icon: "wallet-outline", color: "#4F83CC", onPress: () => router.push("/(tabs)/admin/treasury") },
    { title: "Taux & Devises", subtitle: "5 devises", icon: "trending-up-outline", color: T.gold, onPress: () => router.push("/(tabs)/admin/rates") },
    { title: "Transactions", subtitle: "Audit temps réel", icon: "analytics-outline", color: "#22C55E", onPress: () => router.push("/(tabs)/admin/transactions") },
    { title: "Utilisateurs", subtitle: "Accès & Rôles", icon: "people-outline", color: "#8B5CF6", onPress: () => router.push("/(tabs)/admin/users") },
  ], [router]);

  const cardWidth = SW;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={T.ink} barStyle="light-content" />

      <View style={s.screen}>
        {/* ── Header ── */}
        <Animated.View
          style={[
            s.header,
            {
              opacity: headerAnim,
              transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}
        >
          <LinearGradient
            colors={[T.inkDeep, T.ink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.headerGradient}
          >
            {/* Décor or */}
            <View style={s.headerGoldLine} />

            <View style={s.headerContent}>
              <View style={{ flex: 1 }}>
                <View style={s.headerBadge}>
                  <View style={s.headerBadgeDot} />
                  <Text style={[s.headerBadgeText, { fontFamily: T.font.sans }]}>
                    SUPER ADMINISTRATION
                  </Text>
                </View>
                <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>
                  Console Globale
                </Text>
                <Text style={[s.headerSub, { fontFamily: T.font.sans }]}>
                  {user?.firstName ? `${user.firstName} · ` : ""}Direct Transf'air™
                </Text>
              </View>

              <View style={s.headerActions}>
                <TouchableOpacity
                  style={s.headerBtn}
                  onPress={() => void loadData("refresh")}
                >
                  <Ionicons name="refresh" size={20} color={T.gold} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.headerBtn}
                  onPress={() => router.push("/(tabs)/admin/notifications")}
                >
                  <Ionicons name="notifications" size={20} color={T.white} />
                  <View style={s.notifBadge} />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadData("refresh")} tintColor={T.gold} />
          }
          ListHeaderComponent={
            <Animated.View
              style={{
                opacity: contentAnim,
                transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
              }}
            >
              {/* Stats */}
              <View style={s.statsRow}>
                <StatCard label="SOCIÉTÉS" value={stats.total} icon="business-outline" color={T.gold} />
                <StatCard label="ACTIVES" value={stats.active} icon="checkmark-circle-outline" color="#22C55E" />
                <StatCard label="INACTIVES" value={stats.inactive} icon="close-circle-outline" color="#EF4444" />
              </View>

              {/* Section label trésorerie */}
              <View style={s.sectionRow}>
                <View style={s.sectionDot} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>TRÉSORERIE · 5 DEVISES</Text>
              </View>

              {/* Carrousel devises */}
              <ScrollView
                ref={carouselRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                snapToInterval={SW - 32}
                decelerationRate="fast"
                contentContainerStyle={{ paddingLeft: 0, paddingRight: 16 }}
                onScroll={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / (SW - 48));
                  setActiveCurrency(Math.max(0, Math.min(idx, CURRENCIES_ORDER.length - 1)));
                }}
                scrollEventThrottle={16}
                style={{ marginHorizontal: 0 }}
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
                      width={SW}
                    />
                  );
                })}
              </ScrollView>

              <CurrencyDots active={activeCurrency} total={CURRENCIES_ORDER.length} />

              {/* Actions rapides */}
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: "#4F83CC" }]} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>PILOTAGE RÉSEAU</Text>
              </View>
              <View style={s.actionsGrid}>
                {actions.map((a) => <ActionCard key={a.title} action={a} />)}
              </View>

              {/* Search */}
              <View style={s.searchBox}>
                <Ionicons name="search" size={18} color={T.creamDim} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Rechercher un client SaaS..."
                  placeholderTextColor={T.creamDim}
                  style={[s.searchInput, { fontFamily: T.font.sans }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!q && (
                  <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn}>
                    <Ionicons name="close" size={15} color={T.creamDim} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Section liste */}
              <View style={[s.sectionRow, { marginTop: 8 }]}>
                <View style={[s.sectionDot, { backgroundColor: "#22C55E" }]} />
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
                  <LinearGradient colors={[T.gold, T.goldSoft]} style={s.addBtnGrad}>
                    <Ionicons name="add" size={20} color={T.ink} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {loading && <ActivityIndicator color={T.gold} style={{ marginVertical: 30 }} size="large" />}
            </Animated.View>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <Ionicons name="business-outline" size={36} color={T.creamDim} />
                </View>
                <Text style={[s.emptyTitle, { fontFamily: T.font.display }]}>Aucun client trouvé</Text>
                <Text style={[s.emptySub, { fontFamily: T.font.sans }]}>
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.ink },
  screen: { flex: 1, backgroundColor: T.inkMid },

  header: { zIndex: 10 },
  headerGradient: { paddingBottom: 20 },
  headerGoldLine: {
    height: 1.5,
    backgroundColor: T.gold,
    opacity: 0.3,
    marginBottom: 0,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 16 : 16,
    paddingBottom: 20,
    gap: 12,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: T.goldGlow,
    borderWidth: 1,
    borderColor: `${T.gold}30`,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  headerBadgeDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: T.gold },
  headerBadgeText: { color: T.gold, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  headerTitle: { color: T.white, fontSize: 30, fontWeight: "700", marginBottom: 4 },
  headerSub: { color: T.creamDim, fontSize: 13, fontWeight: "600" },
  headerActions: { flexDirection: "row", gap: 10, paddingBottom: 4 },
  headerBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: T.ghost,
    borderWidth: 1, borderColor: T.inkBorder,
    justifyContent: "center", alignItems: "center",
  },
  notifBadge: {
    position: "absolute", top: 10, right: 10,
    width: 8, height: 8, borderRadius: 99,
    backgroundColor: "#EF4444",
    borderWidth: 1.5, borderColor: T.ink,
  },

  list: { paddingHorizontal: 20, paddingTop: 20 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },

  sectionRow: {
    flexDirection: "row", alignItems: "center",
    gap: 8, marginBottom: 14, marginLeft: 2,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: T.gold },
  sectionLabel: {
    flex: 1,
    fontSize: 11, fontWeight: "900", color: T.creamDim, letterSpacing: 1.5,
  },

  actionsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 24 },

  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.inkLight, borderRadius: 16,
    paddingHorizontal: 16, height: 52,
    borderWidth: 1, borderColor: T.inkBorder,
    marginBottom: 20, gap: 10,
  },
  searchInput: {
    flex: 1, fontSize: 14, color: T.white, fontWeight: "600",
  },
  clearBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
  },

  addBtn: { marginLeft: 8 },
  addBtnGrad: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },

  empty: { alignItems: "center", paddingVertical: 50, gap: 12 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: T.inkLight, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  emptyTitle: { color: T.white, fontSize: 18, fontWeight: "700" },
  emptySub: { color: T.creamDim, fontSize: 13, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
});