// apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
// =========================================================
// SUPER ADMIN DASHBOARD v10.0 — Direct Transf'air
// ✅ Hero forme capture2 : violet plein, blanc remonte avec
//    grand arrondi + coins concaves pageBg
// ✅ Cartes devises superposées 3D stack (capture3)
//    swipe au doigt (PanResponder natif)
// ✅ Hero compact ~30% écran
// ✅ Stats / Actions / Clients identiques
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

// ─── Design Tokens ────────────────────────────────────────
const T = {
  heroA: "#5B5BD6",
  heroB: "#4545C0",
  heroC: "#3232A8",

  blue:     "#1956F0",
  blueDark: "#1240D6",
  blueDeep: "#0D33B0",
  blueLt:   "#EEF2FF",
  blueMd:   "#C7D5FF",

  pageBg:   "#F0F4FF",
  surface:  "#FFFFFF",
  border:   "#E2E8F0",
  borderMd: "#D1D9E6",

  ink:      "#0F172A",
  inkMid:   "#374151",
  inkSub:   "#6B7280",
  inkMuted: "#9CA3AF",

  green:    "#16A34A",
  greenLt:  "#DCFCE7",
  red:      "#DC2626",
  redLt:    "#FEE2E2",
  amber:    "#D97706",
  amberLt:  "#FEF3C7",
  purple:   "#7C3AED",
  purpleLt: "#EDE9FE",

  white: "#FFFFFF",

  currencies: {
    EUR: { code: "EUR", symbol: "€",   flag: "🇪🇺", color: "#1956F0", colorDark: "#1240D6", bg: "#EEF2FF", name: "Euro" },
    USD: { code: "USD", symbol: "$",   flag: "🇺🇸", color: "#16A34A", colorDark: "#15803D", bg: "#DCFCE7", name: "Dollar US" },
    XOF: { code: "XOF", symbol: "CFA", flag: "🌍",  color: "#D97706", colorDark: "#B45309", bg: "#FEF3C7", name: "Franc CFA" },
    GNF: { code: "GNF", symbol: "FG",  flag: "🇬🇳", color: "#DC2626", colorDark: "#B91C1C", bg: "#FEE2E2", name: "Franc Guinéen" },
    GBP: { code: "GBP", symbol: "£",   flag: "🇬🇧", color: "#7C3AED", colorDark: "#6D28D9", bg: "#EDE9FE", name: "Livre Sterling" },
  },

  statusColors: {
    ACTIVE:    "#16A34A",
    SUSPENDED: "#D97706",
    INACTIVE:  "#DC2626",
    EXPIRED:   "#DC2626",
    TRIAL:     "#6366F1",
  } as Record<string, string>,

  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 32 },

  font: {
    display:  Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:     Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    subtitle: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light",     default: "Trebuchet MS" }),
    mono:     Platform.select({ ios: "Trebuchet MS", android: "monospace",             default: "Trebuchet MS" }),
  },

  shadow: {
    card: {
      shadowColor: "#1240D6",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.13,
      shadowRadius: 16,
      elevation: 8,
    },
    soft: {
      shadowColor: "#1240D6",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 4,
    },
    hero: {
      shadowColor: "#2E2E9A",
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.32,
      shadowRadius: 32,
      elevation: 24,
    },
  },
};

const CURRENCIES_ORDER = ["EUR", "USD", "XOF", "GNF", "GBP"] as const;

const STACK_W        = SW - 64;
const STACK_H        = 110;
const STACK_OFFSET_X = 7;
const STACK_OFFSET_Y = 9;

// ─── Helpers ──────────────────────────────────────────────
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
      {/* Cartes derrière — effet 3D stack */}
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
                  top: -(d * STACK_OFFSET_Y),
                  left: d * STACK_OFFSET_X,
                  right: d * STACK_OFFSET_X,
                  width: undefined,
                  opacity: 1 - d * 0.22,
                  zIndex: 10 - d,
                  borderTopColor: cfg.color,
                },
              ]}
            >
              <View style={[stk.topAccent, { backgroundColor: cfg.color }]} />
              <View style={stk.peekRow}>
                <Text style={{ fontSize: 16, marginRight: 6 }}>{cfg.flag}</Text>
                <Text style={[stk.peekCode, { color: cfg.color, fontFamily: T.font.mono }]}>{cfg.code}</Text>
                <Text style={[stk.peekName, { fontFamily: T.font.subtitle }]}>{cfg.name}</Text>
              </View>
            </View>
          );
        })}

      {/* Carte active (front) */}
      <Animated.View
        style={[
          stk.card,
          stk.front,
          { borderTopColor: activeCfg.color, transform: [{ translateX }] },
        ]}
      >
        <View style={[stk.topAccent, { backgroundColor: activeCfg.color }]} />
        <View style={[stk.cardBgTint, { backgroundColor: activeCfg.bg }]} />

        {/* Row 1 : flag + nom + nav */}
        <View style={stk.row1}>
          <View style={[stk.flagBox, { backgroundColor: activeCfg.bg }]}>
            <Text style={{ fontSize: 20 }}>{activeCfg.flag}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[stk.cardCode, { color: activeCfg.color, fontFamily: T.font.mono }]}>
              {activeCur}
            </Text>
            <Text style={[stk.cardName, { fontFamily: T.font.subtitle }]}>{activeCfg.name}</Text>
          </View>
          <View style={stk.navArea}>
            <TouchableOpacity
              onPress={() => setActiveIdx((p) => Math.max(p - 1, 0))}
              style={[stk.navBtn, { opacity: activeIdx === 0 ? 0.25 : 1 }]}
            >
              <Ionicons name="chevron-back" size={11} color={activeCfg.color} />
            </TouchableOpacity>
            <Text style={[stk.navCount, { color: activeCfg.color, fontFamily: T.font.mono }]}>
              {activeIdx + 1}/{total}
            </Text>
            <TouchableOpacity
              onPress={() => setActiveIdx((p) => Math.min(p + 1, total - 1))}
              style={[stk.navBtn, { opacity: activeIdx === total - 1 ? 0.25 : 1 }]}
            >
              <Ionicons name="chevron-forward" size={11} color={activeCfg.color} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 2 : montants */}
        <View style={stk.row2}>
          <View style={{ flex: 1 }}>
            <Text style={[stk.balLabel, { fontFamily: T.font.sans }]}>SOLDE TOTAL</Text>
            <Text
              style={[stk.balAmount, { color: activeCfg.colorDark, fontFamily: T.font.display }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {fmtAmount(balance, activeCur)}{" "}
              <Text style={[stk.balSym, { color: activeCfg.color }]}>{activeCfg.symbol}</Text>
            </Text>
          </View>
          <View style={[stk.availPill, { backgroundColor: activeCfg.bg }]}>
            <Text style={[stk.availLbl, { color: activeCfg.colorDark, fontFamily: T.font.sans }]}>DISPO</Text>
            <Text style={[stk.availAmt, { color: activeCfg.colorDark, fontFamily: T.font.mono }]}>
              {fmtAmount(available, activeCur)}
            </Text>
          </View>
        </View>

        {/* Dots */}
        <View style={stk.dots}>
          {CURRENCIES_ORDER.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setActiveIdx(i)}>
              <View
                style={[
                  stk.dot,
                  {
                    width: i === activeIdx ? 16 : 5,
                    backgroundColor: i === activeIdx ? activeCfg.color : T.borderMd,
                  },
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const stk = StyleSheet.create({
  wrapper: {
    marginTop: 14,
    marginHorizontal: 20,
    height: STACK_H + STACK_OFFSET_Y * 2 + 8,
    justifyContent: "flex-end",
  },
  card: {
    width: STACK_W,
    height: STACK_H,
    backgroundColor: T.surface,
    borderRadius: 18,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: "rgba(200,210,240,0.6)",
    overflow: "hidden",
    padding: 12,
    shadowColor: "#1240D6",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 10,
  },
  front: { zIndex: 20, position: "relative" },
  topAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  cardBgTint: {
    position: "absolute", top: 0, left: 0, right: 0,
    height: STACK_H * 0.45, opacity: 0.18,
  },
  peekRow: {
    flexDirection: "row", alignItems: "center",
    paddingTop: 14, paddingHorizontal: 12,
  },
  peekCode: { fontSize: 11, fontWeight: "900", letterSpacing: 1.3, marginRight: 6 },
  peekName: { fontSize: 9, color: T.inkMuted },
  row1: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 8 },
  flagBox: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  cardCode: { fontSize: 12, fontWeight: "900", letterSpacing: 1.4 },
  cardName: { fontSize: 9, color: T.inkSub, marginTop: 1 },
  navArea: { flexDirection: "row", alignItems: "center", gap: 4 },
  navBtn: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.04)",
    justifyContent: "center", alignItems: "center",
  },
  navCount: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  row2: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  balLabel: { fontSize: 8, fontWeight: "800", letterSpacing: 1.5, color: T.inkMuted, marginBottom: 2 },
  balAmount: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  balSym: { fontSize: 12, fontWeight: "700" },
  availPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center", minWidth: 68 },
  availLbl: { fontSize: 8, fontWeight: "800", letterSpacing: 1.2, marginBottom: 2 },
  availAmt: { fontSize: 13, fontWeight: "700" },
  dots: { flexDirection: "row", gap: 4, marginTop: 7, alignItems: "center" },
  dot: { height: 4, borderRadius: 99 },
});

// ─── Hero — forme capture2 ────────────────────────────────
const HERO_CURVE = 30;

function DashHero({
  animValue,
  user,
  wallets,
  onRefresh,
  onNotif,
}: {
  animValue: Animated.Value;
  user: any;
  wallets: any[];
  onRefresh: () => void;
  onNotif: () => void;
}) {
  const sbH = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;

  return (
    <Animated.View
      style={[
        hS.outer,
        {
          opacity: animValue,
          transform: [{
            translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }),
          }],
        },
      ]}
    >
      <LinearGradient
        colors={["#5B5BD6", "#4545C2", "#3232A8"]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={[hS.gradient, { paddingTop: sbH + 12 }]}
      >
        <View style={hS.c1} />
        <View style={hS.c2} />

        {/* Top bar */}
        <View style={hS.topBar}>
          <View style={hS.topLeft}>
            <View style={hS.badge}>
              <View style={hS.activeDot} />
              <Text style={[hS.badgeTxt, { fontFamily: T.font.sans }]}>SUPER ADMIN</Text>
            </View>
            <Text style={[hS.name, { fontFamily: T.font.display }]}>
              {user?.firstName ?? "Console"}
            </Text>
            <Text style={[hS.sub, { fontFamily: T.font.subtitle }]}>
              Direct Transf'air™ · Trésorerie
            </Text>
          </View>
          <View style={hS.btns}>
            <TouchableOpacity style={hS.btn} onPress={onRefresh} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={15} color={T.white} />
            </TouchableOpacity>
            <TouchableOpacity style={hS.btn} onPress={onNotif} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={15} color={T.white} />
              <View style={hS.notifDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stack 3D */}
        <CurrencyStack wallets={wallets} />

        <View style={{ height: 28 }} />
      </LinearGradient>

      {/* Coins concaves : effet blanc qui remonte (capture2) */}
      <View style={hS.cornerL} />
      <View style={hS.cornerR} />
    </Animated.View>
  );
}

const hS = StyleSheet.create({
  outer: { zIndex: 10, ...T.shadow.hero },
  gradient: {
    borderBottomLeftRadius: HERO_CURVE,
    borderBottomRightRadius: HERO_CURVE,
    overflow: "hidden",
  },
  c1: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.06)", top: -55, right: -35,
  },
  c2: {
    position: "absolute", width: 90, height: 90, borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.04)", bottom: 15, left: 10,
  },
  topBar: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 0,
  },
  topLeft: { flex: 1 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: "flex-start", marginBottom: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  activeDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: "#4ADE80" },
  badgeTxt: { color: "rgba(255,255,255,0.92)", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  name: { color: T.white, fontSize: 21, fontWeight: "700", letterSpacing: -0.4 },
  sub: { color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 1 },
  btns: { flexDirection: "row", gap: 7, paddingTop: 2 },
  btn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  notifDot: {
    position: "absolute", top: 7, right: 7,
    width: 6, height: 6, borderRadius: 99,
    backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: "#4545C2",
  },
  cornerL: {
    position: "absolute", bottom: 0, left: 0,
    width: HERO_CURVE, height: HERO_CURVE,
    backgroundColor: T.pageBg, borderTopRightRadius: HERO_CURVE,
  },
  cornerR: {
    position: "absolute", bottom: 0, right: 0,
    width: HERO_CURVE, height: HERO_CURVE,
    backgroundColor: T.pageBg, borderTopLeftRadius: HERO_CURVE,
  },
});

// ─── Stat Strip ───────────────────────────────────────────
function StatStrip({ stats }: { stats: { total: number; active: number; inactive: number } }) {
  const items = [
    { label: "Sociétés",  value: stats.total,    color: T.blue,  bg: T.blueLt,  icon: "business-outline" as const },
    { label: "Actives",   value: stats.active,   color: T.green, bg: T.greenLt, icon: "checkmark-circle-outline" as const },
    { label: "Inactives", value: stats.inactive, color: T.red,   bg: T.redLt,   icon: "close-circle-outline" as const },
  ];
  return (
    <View style={ssS.row}>
      {items.map((it, idx) => (
        <View key={idx} style={[ssS.card, { borderLeftColor: it.color }]}>
          <View style={[ssS.iconBox, { backgroundColor: it.bg }]}>
            <Ionicons name={it.icon} size={16} color={it.color} />
          </View>
          <Text style={[ssS.val, { color: it.color, fontFamily: T.font.display }]}>{it.value}</Text>
          <Text style={[ssS.lbl, { fontFamily: T.font.sans }]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}
const ssS = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginTop: 20, marginBottom: 22 },
  card: {
    flex: 1, backgroundColor: T.surface, borderRadius: T.radius.md,
    paddingVertical: 12, paddingHorizontal: 10, alignItems: "center",
    borderLeftWidth: 3, borderTopWidth: 1, borderRightWidth: 1,
    borderBottomWidth: 1, borderColor: T.border, ...T.shadow.soft,
  },
  iconBox: { width: 32, height: 32, borderRadius: 9, justifyContent: "center", alignItems: "center", marginBottom: 7 },
  val: { fontSize: 22, fontWeight: "700", marginBottom: 2 },
  lbl: { fontSize: 8, color: T.inkMuted, fontWeight: "800", letterSpacing: 0.9, textAlign: "center" },
});

// ─── Action Grid ──────────────────────────────────────────
function ActionGrid({ actions }: { actions: any[] }) {
  return (
    <View style={agS.grid}>
      {actions.map((a) => (
        <TouchableOpacity key={a.title} style={agS.card} onPress={a.onPress} activeOpacity={0.8}>
          <View style={[agS.bar, { backgroundColor: a.color }]} />
          <View style={[agS.iconBox, { backgroundColor: a.bgColor }]}>
            <Ionicons name={a.icon} size={20} color={a.color} />
          </View>
          <Text style={[agS.title, { fontFamily: T.font.sans }]} numberOfLines={1}>{a.title}</Text>
          <Text style={[agS.sub, { fontFamily: T.font.subtitle }]} numberOfLines={1}>{a.subtitle}</Text>
          <View style={[agS.arrow, { backgroundColor: a.bgColor }]}>
            <Ionicons name="arrow-forward" size={10} color={a.color} />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const agS = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 22 },
  card: {
    width: "48.5%", backgroundColor: T.surface, borderRadius: T.radius.md,
    padding: 14, paddingTop: 18, marginBottom: 10,
    borderWidth: 1, borderColor: T.border, overflow: "hidden", ...T.shadow.soft,
  },
  bar: { position: "absolute", top: 0, left: 0, right: 0, height: 3, opacity: 0.85 },
  iconBox: { width: 40, height: 40, borderRadius: 11, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 2 },
  sub: { fontSize: 10, color: T.inkSub },
  arrow: { position: "absolute", right: 10, top: 10, width: 22, height: 22, borderRadius: 6, justifyContent: "center", alignItems: "center" },
});

// ─── Client Card ─────────────────────────────────────────
function ClientCard({ item, onPress }: { item: any; onPress: () => void }) {
  const statusColor = T.statusColors[item.subscriptionStatus?.toUpperCase()] ?? T.inkMuted;
  return (
    <TouchableOpacity style={clS.card} onPress={onPress} activeOpacity={0.8}>
      <View style={clS.avatar}>
        <Text style={[clS.avatarLetter, { fontFamily: T.font.display }]}>
          {(item.name?.[0] ?? "C").toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[clS.name, { fontFamily: T.font.sans }]} numberOfLines={1}>{item.name}</Text>
        <View style={clS.metaRow}>
          <Text style={[clS.code, { fontFamily: T.font.mono }]}>{item.code}</Text>
          <View style={[clS.statusPill, { backgroundColor: `${statusColor}12`, borderColor: `${statusColor}28` }]}>
            <View style={[clS.dot, { backgroundColor: statusColor }]} />
            <Text style={[clS.statusTxt, { color: statusColor, fontFamily: T.font.sans }]}>
              {item.subscriptionStatus}
            </Text>
          </View>
        </View>
      </View>
      <View style={[clS.chevron, { backgroundColor: T.blueLt }]}>
        <Ionicons name="chevron-forward" size={11} color={T.blue} />
      </View>
    </TouchableOpacity>
  );
}
const clS = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: T.surface,
    borderRadius: T.radius.md, padding: 13, marginBottom: 8,
    borderWidth: 1, borderColor: T.border, gap: 11, ...T.shadow.soft,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 11, backgroundColor: T.blueLt,
    justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: T.blueMd,
  },
  avatarLetter: { fontSize: 17, fontWeight: "700", color: T.blue },
  name: { color: T.ink, fontSize: 13, fontWeight: "700", marginBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  code: { color: T.amber, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  dot: { width: 4, height: 4, borderRadius: 99 },
  statusTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  chevron: { width: 24, height: 24, borderRadius: 7, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.blueMd },
});

// ─── Section Header ───────────────────────────────────────
function SH({ dot, label, right }: { dot: string; label: string; right?: React.ReactNode }) {
  return (
    <View style={shS.row}>
      <View style={[shS.dot, { backgroundColor: dot }]} />
      <Text style={[shS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      {right}
    </View>
  );
}
const shS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
  dot: { width: 6, height: 6, borderRadius: 99 },
  label: { flex: 1, fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.6 },
});

// ─── Main Component ───────────────────────────────────────
const LIST_H_PAD = 18;

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
    { title: "Trésorerie",     subtitle: "Vue globale",      icon: "wallet-outline",      color: T.blue,   bgColor: T.blueLt,   onPress: () => router.push("/(tabs)/admin/treasury") },
    { title: "Taux & Devises", subtitle: "5 devises",        icon: "trending-up-outline", color: T.amber,  bgColor: T.amberLt,  onPress: () => router.push("/(tabs)/admin/rates") },
    { title: "Transactions",   subtitle: "Audit temps réel", icon: "analytics-outline",   color: T.green,  bgColor: T.greenLt,  onPress: () => router.push("/(tabs)/admin/transactions") },
    { title: "Utilisateurs",   subtitle: "Accès & Rôles",    icon: "people-outline",      color: T.purple, bgColor: T.purpleLt, onPress: () => router.push("/(tabs)/admin/users") },
  ], [router]);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor="#3232A8" barStyle="light-content" />

      <View style={s.screen}>
        <DashHero
          animValue={headerAnim}
          user={user}
          wallets={wallets}
          onRefresh={() => void loadData("refresh")}
          onNotif={() => router.push("/(tabs)/admin/notifications")}
        />

        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <ClientCard
              item={item}
              onPress={() =>
                router.push({ pathname: "/(tabs)/admin/clients/details", params: { id: item.id } })
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
                transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              }}
            >
              <StatStrip stats={stats} />
              <SH dot={T.blue} label="PILOTAGE RÉSEAU" />
              <ActionGrid actions={actions} />

              <View style={s.searchBox}>
                <Ionicons name="search" size={15} color={T.inkMuted} />
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
                    <Ionicons name="close" size={12} color={T.inkMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <SH
                dot={T.green}
                label={`CLIENTS SAAS · ${filtered.length}`}
                right={
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
                    <LinearGradient colors={[T.blue, T.blueDark]} style={s.addBtnGrad}>
                      <Ionicons name="add" size={16} color={T.white} />
                    </LinearGradient>
                  </TouchableOpacity>
                }
              />

              {loading && <ActivityIndicator color={T.blue} style={{ marginVertical: 24 }} size="large" />}
            </Animated.View>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <Ionicons name="business-outline" size={28} color={T.inkMuted} />
                </View>
                <Text style={[s.emptyTitle, { fontFamily: T.font.display }]}>Aucun client trouvé</Text>
                <Text style={[s.emptySub, { fontFamily: T.font.subtitle }]}>
                  Modifiez votre recherche ou créez un nouveau client
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={<View style={{ height: 120 }} />}
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
  safe:   { flex: 1, backgroundColor: T.pageBg },
  screen: { flex: 1, backgroundColor: T.pageBg },
  list: { paddingHorizontal: LIST_H_PAD, paddingTop: 4 },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface, borderRadius: T.radius.md,
    paddingHorizontal: 13, height: 46,
    borderWidth: 1, borderColor: T.border,
    marginBottom: 14, gap: 8, ...T.shadow.soft,
  },
  searchInput: { flex: 1, fontSize: 13, color: T.ink },
  clearBtn: { width: 24, height: 24, borderRadius: 7, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  addBtn: {},
  addBtnGrad: { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 44, gap: 8 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 18, backgroundColor: T.blueLt,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.blueMd, ...T.shadow.card,
  },
  emptyTitle: { color: T.ink, fontSize: 16, fontWeight: "700" },
  emptySub: { color: T.inkMuted, fontSize: 12, textAlign: "center", lineHeight: 18, paddingHorizontal: 24 },
});