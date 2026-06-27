// apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
// =========================================================
// SUPER ADMIN DASHBOARD v15.0 — Blanc Pur Premium
// ✅ Hero : fond blanc, avatar dégradé (seul élément coloré)
//          greeting dynamique heure-of-day
// ✅ StatStrip : barre-accent top 3px, chiffres au premier plan
// ✅ ActionGrid : barre-accent gauche 3px, layout vertical
// ✅ CurrencyStack : tinte subtile couleur-devise sur la carte
// ✅ Logique métier 100% intouchée
// =========================================================

import React, { useCallback, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import CreateCompanyModal from "./CreateCompanyModal";

const { width: SW } = Dimensions.get("window");

// ─── Design Tokens ─────────────────────────────────────────
const T = {
  // Gradient avatar (seul élément coloré du hero)
  heroA: "#4F46E5",
  heroB: "#7C3AED",

  brand:     "#4F46E5",
  brandDark: "#4338CA",
  brandLt:   "#EEF2FF",
  brandMd:   "#E0E7FF",

  // Fond neutre froid — distinct des cartes blanches
  pageBg:    "#F3F5F9",
  surface:   "#FFFFFF",
  surfaceAlt:"#F8F9FD",
  border:    "#E8EDFB",
  borderMd:  "#D1D9F5",

  ink:      "#1E1B4B",
  inkMid:   "#3730A3",
  inkSub:   "#6B7280",
  inkMuted: "#9CA3AF",

  green:    "#059669",
  greenLt:  "#ECFDF5",
  greenMd:  "#D1FAE5",
  red:      "#DC2626",
  redLt:    "#FEF2F2",
  amber:    "#D97706",
  amberLt:  "#FFFBEB",
  violet:   "#7C3AED",
  violetLt: "#F5F3FF",
  violetMd: "#EDE9FE",
  teal:     "#0D9488",
  tealLt:   "#F0FDFA",
  tealMd:   "#CCFBF1",
  rose:     "#E11D48",
  roseLt:   "#FFF1F2",

  white: "#FFFFFF",
  black: "#000000",

  currencies: {
    EUR: { code: "EUR", symbol: "€",   flag: "🇪🇺", color: "#4F46E5", colorDark: "#3730A3", bg: "#EEF2FF", name: "Euro"            },
    USD: { code: "USD", symbol: "$",   flag: "🇺🇸", color: "#059669", colorDark: "#065F46", bg: "#ECFDF5", name: "Dollar US"        },
    XOF: { code: "XOF", symbol: "CFA", flag: "🌍",  color: "#D97706", colorDark: "#92400E", bg: "#FFFBEB", name: "Franc CFA"        },
    GNF: { code: "GNF", symbol: "FG",  flag: "🇬🇳", color: "#DC2626", colorDark: "#991B1B", bg: "#FEF2F2", name: "Franc Guinéen"    },
    GBP: { code: "GBP", symbol: "£",   flag: "🇬🇧", color: "#7C3AED", colorDark: "#6D28D9", bg: "#F5F3FF", name: "Livre Sterling"   },
  },

  statusColors: {
    ACTIVE:    "#059669",
    SUSPENDED: "#D97706",
    INACTIVE:  "#DC2626",
    EXPIRED:   "#DC2626",
    TRIAL:     "#4F46E5",
  } as Record<string, string>,

  statusBg: {
    ACTIVE:    "#ECFDF5",
    SUSPENDED: "#FFFBEB",
    INACTIVE:  "#FEF2F2",
    EXPIRED:   "#FEF2F2",
    TRIAL:     "#EEF2FF",
  } as Record<string, string>,

  radius: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 999 },

  font: {
    display:  Platform.select({ ios: "System", android: "sans-serif-medium", default: "System" }),
    sans:     Platform.select({ ios: "System", android: "sans-serif",        default: "System" }),
    subtitle: Platform.select({ ios: "System", android: "sans-serif-light",  default: "System" }),
    mono:     Platform.select({ ios: "Courier New", android: "monospace",    default: "Courier" }),
  },

  shadow: {
    card: {
      shadowColor: "#4F46E5",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    float: {
      shadowColor: "#1E1B4B",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 6,
    },
    hero: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 4,
    },
  },
};

const TAB_BAR_HEIGHT      = Platform.OS === "ios" ? 84 : 70;
const LIST_BOTTOM_PADDING = TAB_BAR_HEIGHT + 16;
const CURRENCIES_ORDER    = ["EUR", "USD", "XOF", "GNF", "GBP"] as const;
const STACK_W             = SW - 40;
const STACK_H             = 130;
const STACK_OFFSET_Y      = 10;
const PLATFORM_CODE       = "DONIKO";

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

// ─── Currency Stack ────────────────────────────────────────
function CurrencyStack({ wallets }: { wallets: any[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const total      = CURRENCIES_ORDER.length;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, gs) => Math.abs(gs.dx) > 6,
      onPanResponderMove:           (_, gs) => { translateX.setValue(gs.dx); },
      onPanResponderRelease:        (_, gs) => {
        if (gs.dx < -48)     setActiveIdx((p) => Math.min(p + 1, total - 1));
        else if (gs.dx > 48) setActiveIdx((p) => Math.max(p - 1, 0));
        Animated.spring(translateX, {
          toValue: 0, useNativeDriver: true, speed: 28, bounciness: 5,
        }).start();
      },
    })
  ).current;

  const activeCur   = CURRENCIES_ORDER[activeIdx] as keyof typeof T.currencies;
  const activeCfg   = T.currencies[activeCur];
  const activeW     = wallets.find((x) => x.currency === activeCur);
  const balance     = toNum(activeW?.balance);
  const reserved    = toNum(activeW?.reservedBalance);
  const available   = balance - reserved;
  const behindCount = Math.min(2, total - activeIdx - 1);

  return (
    <View style={stk.wrapper} {...panResponder.panHandlers}>
      {/* Cards behind */}
      {([2, 1] as const)
        .filter((d) => d <= behindCount)
        .map((d) => {
          const behindCur = CURRENCIES_ORDER[activeIdx + d] as keyof typeof T.currencies;
          const cfg       = T.currencies[behindCur];
          return (
            <View
              key={`behind-${d}`}
              style={[
                stk.card,
                {
                  position: "absolute",
                  bottom:   d * STACK_OFFSET_Y,
                  transform: [{ scale: 1 - d * 0.03 }],
                  width:    STACK_W,
                  opacity:  0.45 - d * 0.12,   // d=1 → 33 %, d=2 → 21 % — très discret
                  zIndex:   10 - d,
                  backgroundColor: d === 1 ? "#F0F3FF" : "#E8EEFF",
                },
              ]}
            >
              <View style={stk.peekRow}>
                <Text style={{ fontSize: 15, marginRight: 6 }}>{cfg.flag}</Text>
                <Text style={[stk.peekCode, { color: T.inkMid, fontFamily: T.font.mono }]}>{cfg.code}</Text>
                <Text style={[stk.peekName, { color: T.inkSub, fontFamily: T.font.subtitle }]}>{cfg.name}</Text>
              </View>
            </View>
          );
        })}

      {/* Front card — fond blanc pur, barre accent latérale pour la couleur */}
      <Animated.View
        style={[
          stk.card,
          stk.front,
          { transform: [{ translateX }] },
        ]}
      >
        <View style={[stk.accentBar, { backgroundColor: activeCfg.color }]} />
        <View style={stk.inner}>
          <View style={stk.row1}>
            <View style={[stk.flagBox, { backgroundColor: activeCfg.bg }]}>
              <Text style={{ fontSize: 18 }}>{activeCfg.flag}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[stk.cardCode, { color: T.ink, fontFamily: T.font.display }]}>{activeCur}</Text>
              <Text style={[stk.cardName, { color: T.inkSub, fontFamily: T.font.subtitle }]}>{activeCfg.name}</Text>
            </View>
            <View style={stk.navArea}>
              <TouchableOpacity
                onPress={() => setActiveIdx((p) => Math.max(p - 1, 0))}
                style={[stk.navBtn, { opacity: activeIdx === 0 ? 0.25 : 1 }]}
              >
                <Ionicons name="chevron-back" size={13} color={T.inkMid} />
              </TouchableOpacity>
              <Text style={[stk.navCount, { color: T.inkSub, fontFamily: T.font.mono }]}>
                {activeIdx + 1}/{total}
              </Text>
              <TouchableOpacity
                onPress={() => setActiveIdx((p) => Math.min(p + 1, total - 1))}
                style={[stk.navBtn, { opacity: activeIdx === total - 1 ? 0.25 : 1 }]}
              >
                <Ionicons name="chevron-forward" size={13} color={T.inkMid} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={stk.divider} />

          <View style={stk.row2}>
            <View style={{ flex: 1 }}>
              <Text style={[stk.balLabel, { color: T.inkMuted, fontFamily: T.font.sans }]}>SOLDE TOTAL</Text>
              <Text
                style={[stk.balAmount, { color: T.ink, fontFamily: T.font.display }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {fmtAmount(balance, activeCur)}{" "}
                <Text style={[stk.balSym, { color: T.inkSub }]}>{activeCfg.symbol}</Text>
              </Text>
            </View>
            <View style={[stk.availPill, { backgroundColor: activeCfg.bg, borderColor: `${activeCfg.color}25` }]}>
              <Text style={[stk.availLbl, { color: activeCfg.colorDark, fontFamily: T.font.sans }]}>Disponible</Text>
              <Text style={[stk.availAmt, { color: activeCfg.color, fontFamily: T.font.display }]}>
                {fmtAmount(available, activeCur)} {activeCfg.symbol}
              </Text>
            </View>
          </View>

          <View style={stk.dots}>
            {CURRENCIES_ORDER.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setActiveIdx(i)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <View
                  style={[
                    stk.dot,
                    {
                      width: i === activeIdx ? 16 : 4,
                      backgroundColor: i === activeIdx ? activeCfg.color : T.borderMd,
                    },
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const stk = StyleSheet.create({
  wrapper:   { marginHorizontal: 20, height: STACK_H + 22, justifyContent: "flex-start", alignItems: "center" },
  card:      { width: STACK_W, height: STACK_H, backgroundColor: T.surface, borderRadius: T.radius.lg, borderWidth: 1, borderColor: T.border, overflow: "hidden", ...T.shadow.float },
  front:     { zIndex: 20, position: "relative", flexDirection: "row" },
  accentBar: { width: 4, height: "100%" },
  inner:     { flex: 1, padding: 14 },
  peekRow:   { flexDirection: "row", alignItems: "center", paddingTop: 6, paddingHorizontal: 14 },
  peekCode:  { fontSize: 12, fontWeight: "600", marginRight: 6 },
  peekName:  { fontSize: 11 },
  row1:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  flagBox:   { width: 34, height: 34, borderRadius: T.radius.sm, justifyContent: "center", alignItems: "center" },
  cardCode:  { fontSize: 14, fontWeight: "700" },
  cardName:  { fontSize: 11, marginTop: 1 },
  navArea:   { flexDirection: "row", alignItems: "center", gap: 4 },
  navBtn:    { width: 26, height: 26, borderRadius: T.radius.xs, backgroundColor: T.surface, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  navCount:  { fontSize: 10, fontWeight: "500" },
  divider:   { height: 1, backgroundColor: T.border, marginBottom: 10 },
  row2:      { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  balLabel:  { fontSize: 9, fontWeight: "700", letterSpacing: 0.6, marginBottom: 3, textTransform: "uppercase" },
  balAmount: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  balSym:    { fontSize: 14, fontWeight: "400" },
  availPill: { alignItems: "flex-end", paddingHorizontal: 10, paddingVertical: 6, borderRadius: T.radius.sm, borderWidth: 1 },
  availLbl:  { fontSize: 9, fontWeight: "600", marginBottom: 2, textTransform: "uppercase" },
  availAmt:  { fontSize: 13, fontWeight: "700" },
  dots:      { flexDirection: "row", gap: 4, marginTop: 10, alignItems: "center", justifyContent: "center" },
  dot:       { height: 4, borderRadius: T.radius.full },
});

// ─── Hero — fond blanc pur ─────────────────────────────────
// Signature : l'avatar dégradé est le SEUL élément coloré du hero.
// Tout le reste est typographie sombre sur blanc.
function DashHero({
  animValue,
  user,
  onRefresh,
  onNotif,
}: {
  animValue: Animated.Value;
  user: any;
  onRefresh: () => void;
  onNotif:   () => void;
}) {
  const insets  = useSafeAreaInsets();
  const initial = (user?.firstName ?? "A")[0].toUpperCase();
  const hour    = new Date().getHours();
  const greeting =
    hour < 5  ? "Bonne nuit,"       :
    hour < 12 ? "Bonjour,"          :
    hour < 18 ? "Bon après-midi,"   :
                "Bonsoir,";

  return (
    <Animated.View
      style={[
        hS.outer,
        {
          opacity: animValue,
          transform: [{
            translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }),
          }],
        },
      ]}
    >
      <View style={[hS.card, { paddingTop: insets.top + 14 }]}>

        {/* ── Ligne principale : avatar · info · boutons ── */}
        <View style={hS.topBar}>

          {/* Avatar dégradé — seul splash de couleur */}
          <LinearGradient
            colors={[T.heroA, T.heroB]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={hS.avatar}
          >
            <Text style={[hS.avatarTxt, { fontFamily: T.font.display }]}>{initial}</Text>
          </LinearGradient>

          {/* Texte */}
          <View style={{ flex: 1 }}>
            <Text style={[hS.greeting, { fontFamily: T.font.subtitle }]}>{greeting}</Text>
            <Text style={[hS.name, { fontFamily: T.font.display }]}>
              {user?.firstName ?? "Console"}
            </Text>
          </View>

          {/* Boutons d'action */}
          <View style={hS.btns}>
            <TouchableOpacity style={hS.btn} onPress={onRefresh} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={18} color={T.inkSub} />
            </TouchableOpacity>
            <TouchableOpacity style={hS.btn} onPress={onNotif} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={18} color={T.inkSub} />
              <View style={hS.notifDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Ligne bas : badge rôle + sous-titre ── */}
        <View style={hS.footRow}>
          <View style={hS.badge}>
            <View style={hS.activeDot} />
            <Text style={[hS.badgeTxt, { fontFamily: T.font.sans }]}>SUPER ADMIN</Text>
          </View>
          <Text style={[hS.sub, { fontFamily: T.font.subtitle }]}>
            Direct Transf'air™ · Trésorerie globale
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const hS = StyleSheet.create({
  outer: { zIndex: 10 },
  card: {
    backgroundColor: T.white,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    ...T.shadow.hero,
  },
  topBar: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },

  // ── Avatar ──
  avatar: {
    width: 54, height: 54, borderRadius: 27,
    justifyContent: "center", alignItems: "center",
    flexShrink: 0,
  },
  avatarTxt: { color: T.white, fontSize: 22, fontWeight: "700" },

  // ── Texte ──
  greeting: { fontSize: 11, color: T.inkSub, marginBottom: 3, letterSpacing: 0.2 },
  name:     { fontSize: 26, fontWeight: "700", color: T.ink, letterSpacing: -0.5 },

  // ── Boutons ──
  btns: { flexDirection: "row", gap: 8 },
  btn: {
    width: 40, height: 40, borderRadius: T.radius.md,
    backgroundColor: T.surfaceAlt,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.border,
  },
  notifDot: {
    position: "absolute", top: 9, right: 9,
    width: 7, height: 7, borderRadius: T.radius.full,
    backgroundColor: T.rose, borderWidth: 1.5, borderColor: T.white,
  },

  // ── Footer row ──
  footRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: T.brandLt,
    borderRadius: T.radius.xs,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: T.brandMd,
  },
  activeDot: { width: 5, height: 5, borderRadius: T.radius.full, backgroundColor: T.green },
  badgeTxt:  { color: T.brandDark, fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  sub:       { flex: 1, fontSize: 11, color: T.inkSub },
});

// ─── Stat Strip ───────────────────────────────────────────
// Chiffre au premier plan, barre d'accent top 3 px per card
function StatStrip({ stats }: { stats: { total: number; active: number; inactive: number } }) {
  const items = [
    { label: "Sociétés",  value: stats.total,    color: T.brand, icon: "business-outline"          as const },
    { label: "Actives",   value: stats.active,   color: T.green, icon: "checkmark-circle-outline"  as const },
    { label: "Inactives", value: stats.inactive, color: T.red,   icon: "close-circle-outline"      as const },
  ];
  return (
    <View style={ssS.row}>
      {items.map((it, idx) => (
        <View key={idx} style={ssS.card}>
          <View style={[ssS.accentTop, { backgroundColor: it.color }]} />
          <Text style={[ssS.val, { fontFamily: T.font.display }]}>{it.value}</Text>
          <View style={ssS.footer}>
            <Text style={[ssS.lbl, { fontFamily: T.font.sans }]}>{it.label}</Text>
            <Ionicons name={it.icon} size={12} color={it.color} />
          </View>
        </View>
      ))}
    </View>
  );
}

const ssS = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, marginBottom: 20, marginTop: 10 },
  card: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: T.radius.md,
    paddingTop: 18, paddingHorizontal: 14, paddingBottom: 12,
    borderWidth: 1, borderColor: T.border,
    overflow: "hidden",
    ...T.shadow.card,
  },
  accentTop: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  val:    { fontSize: 30, fontWeight: "700", letterSpacing: -1, color: T.ink, marginBottom: 6 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lbl:    { fontSize: 10, color: T.inkSub, fontWeight: "600" },
});

// ─── Action Grid ──────────────────────────────────────────
// Barre-accent gauche 3 px — icône + titre + sous-titre empilés
function ActionGrid({ actions }: { actions: any[] }) {
  return (
    <View style={agS.grid}>
      {actions.map((a) => (
        <TouchableOpacity key={a.title} style={agS.card} onPress={a.onPress} activeOpacity={0.82}>
          {/* Barre couleur gauche */}
          <View style={[agS.leftBar, { backgroundColor: a.color }]} />

          <View style={agS.content}>
            <View style={[agS.iconBox, { backgroundColor: a.bgColor }]}>
              <Ionicons name={a.icon} size={16} color={a.color} />
            </View>
            <Text style={[agS.title, { fontFamily: T.font.sans, color: T.ink }]} numberOfLines={1}>
              {a.title}
            </Text>
            <Text style={[agS.sub, { fontFamily: T.font.subtitle, color: T.inkSub }]} numberOfLines={1}>
              {a.subtitle}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={11} color={T.borderMd} style={{ paddingRight: 12 }} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const agS = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 20 },
  card: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.surface,
    borderRadius: T.radius.md,
    marginBottom: 10,
    borderWidth: 1, borderColor: T.border,
    overflow: "hidden",
    ...T.shadow.card,
  },
  leftBar: { width: 3, alignSelf: "stretch" },
  content: { flex: 1, padding: 12 },
  iconBox: {
    width: 30, height: 30, borderRadius: T.radius.xs,
    justifyContent: "center", alignItems: "center",
    marginBottom: 8,
  },
  title: { fontSize: 12, fontWeight: "700" },
  sub:   { fontSize: 10, marginTop: 2 },
});

// ─── Client Card ──────────────────────────────────────────
function ClientCard({ item, onPress }: { item: any; onPress: () => void }) {
  const statusKey   = item.subscriptionStatus?.toUpperCase() ?? "ACTIVE";
  const statusColor = T.statusColors[statusKey] ?? T.inkMuted;
  const statusBg    = T.statusBg[statusKey]    ?? T.pageBg;

  const AVATAR_COLORS = [
    { bg: T.brandLt,  border: T.brandMd,  text: T.brand  },
    { bg: T.violetLt, border: T.violetMd, text: T.violet },
    { bg: T.greenLt,  border: T.greenMd,  text: T.green  },
    { bg: T.tealLt,   border: T.tealMd,   text: T.teal   },
    { bg: T.amberLt,  border: "#FDE68A",  text: T.amber  },
    { bg: T.roseLt,   border: "#FECDD3",  text: T.rose   },
  ];
  const nameChar = (item.name ?? "?")[0].toUpperCase();
  const avCfg    = AVATAR_COLORS[nameChar.charCodeAt(0) % AVATAR_COLORS.length];

  const statusLabel: Record<string, string> = {
    ACTIVE:    "ACTIF",
    INACTIVE:  "INACTIF",
    SUSPENDED: "SUSPENDU",
    EXPIRED:   "EXPIRÉ",
    TRIAL:     "ESSAI",
  };

  return (
    <TouchableOpacity style={ccS.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[ccS.statusBar, { backgroundColor: statusColor }]} />

      <View style={[ccS.avatar, { backgroundColor: avCfg.bg, borderColor: avCfg.border }]}>
        <Text style={[ccS.avatarTxt, { color: avCfg.text, fontFamily: T.font.display }]}>
          {nameChar}
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[ccS.name, { fontFamily: T.font.display }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[ccS.code, { fontFamily: T.font.mono }]} numberOfLines={1}>
          {item.code}{item.subscriptionType ? `  ·  ${item.subscriptionType}` : ""}
        </Text>
      </View>

      <View style={[ccS.badge, { backgroundColor: statusBg, borderColor: `${statusColor}40` }]}>
        <View style={[ccS.dot, { backgroundColor: statusColor }]} />
        <Text style={[ccS.badgeTxt, { color: statusColor, fontFamily: T.font.sans }]}>
          {statusLabel[statusKey] ?? statusKey}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={13} color={T.borderMd} style={{ marginLeft: 4, marginRight: 12 }} />
    </TouchableOpacity>
  );
}

const ccS = StyleSheet.create({
  card:      { flexDirection: "row", alignItems: "center", backgroundColor: T.surface, borderRadius: T.radius.md, marginBottom: 10, borderWidth: 1, borderColor: T.border, overflow: "hidden", ...T.shadow.card },
  statusBar: { width: 4, alignSelf: "stretch" },
  avatar:    { width: 40, height: 40, borderRadius: T.radius.sm, justifyContent: "center", alignItems: "center", borderWidth: 1, marginLeft: 12, marginRight: 10, flexShrink: 0 },
  avatarTxt: { fontSize: 16, fontWeight: "700" },
  name:      { fontSize: 13, fontWeight: "700", color: T.ink, marginBottom: 2 },
  code:      { fontSize: 10, color: T.inkSub, fontWeight: "600" },
  badge:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: T.radius.full, borderWidth: 1, flexShrink: 0 },
  dot:       { width: 5, height: 5, borderRadius: T.radius.full },
  badgeTxt:  { fontSize: 9, fontWeight: "800" },
});

// ─── Section Header ───────────────────────────────────────
function SH({
  accentColor = T.brand,
  label,
  right,
}: {
  accentColor?: string;
  label: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={shS.row}>
      <View style={[shS.accent, { backgroundColor: accentColor }]} />
      <Text style={[shS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      {right}
    </View>
  );
}

const shS = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, marginTop: 4, gap: 8 },
  accent: { width: 3, height: 13, borderRadius: T.radius.full },
  label:  { flex: 1, fontSize: 11, fontWeight: "700", color: T.inkSub, letterSpacing: 0.6, textTransform: "uppercase" },
});

// ─── Main Component ───────────────────────────────────────
const LIST_H_PAD = 16;

export default function SuperAdminDashboard() {
  const router     = useRouter();
  const { user }   = useAuth();
  const insets     = useSafeAreaInsets();
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
      const list = Array.isArray(rawClients)
        ? rawClients
        : ((rawClients as any)?.data ?? []);

      setClients(
        list
          .filter((c: any) => c.code !== PLATFORM_CODE)
          .map((c: any) => ({
            id:                 c.id?.toString(),
            name:               c.name || "Client",
            code:               c.code || "N/A",
            subscriptionStatus: c.subscriptionStatus || "ACTIVE",
            subscriptionType:   c.subscriptionType   || "RENTAL",
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
    { title: "Trésorerie",   subtitle: "Vue globale",      icon: "wallet-outline"           as const, color: T.brand,  bgColor: T.brandLt,  onPress: () => router.push("/(tabs)/admin/treasury")    },
    { title: "Supervision",  subtitle: "Logs système",     icon: "shield-checkmark-outline" as const, color: T.teal,   bgColor: T.tealLt,   onPress: () => router.push("/(tabs)/admin/supervision")  },
    { title: "Transactions", subtitle: "Audit temps réel", icon: "analytics-outline"        as const, color: T.green,  bgColor: T.greenLt,  onPress: () => router.push("/(tabs)/admin/transactions") },
    { title: "Utilisateurs", subtitle: "Accès & Rôles",    icon: "people-outline"           as const, color: T.violet, bgColor: T.violetLt, onPress: () => router.push("/(tabs)/admin/users")        },
  ], [router]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* StatusBar dark-content pour fond blanc */}
      <StatusBar backgroundColor={T.white} barStyle="dark-content" translucent={false} />

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
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/admin/clients/details",
                  params:   { id: item.id },
                })
              }
            />
          )}
          contentContainerStyle={[
            s.list,
            { paddingBottom: LIST_BOTTOM_PADDING + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: T.pageBg }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadData("refresh")}
              tintColor={T.brand}
              colors={[T.brand]}
            />
          }
          ListHeaderComponent={
            <Animated.View
              style={{
                opacity: contentAnim,
                transform: [{
                  translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
                }],
              }}
            >
              {/* ── Carte devises ── */}
              <View style={s.stackWrapper}>
                <CurrencyStack wallets={wallets} />
              </View>

              {/* ── Stats ── */}
              <StatStrip stats={stats} />

              {/* ── Actions ── */}
              <SH accentColor={T.brand} label="Pilotage réseau" />
              <ActionGrid actions={actions} />

              {/* ── Recherche ── */}
              <View style={s.searchBox}>
                <Ionicons name="search" size={15} color={T.inkMuted} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Rechercher un client SaaS..."
                  placeholderTextColor={T.inkMuted}
                  style={[s.searchInput, { fontFamily: T.font.sans }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!q && (
                  <TouchableOpacity
                    onPress={() => setQ("")}
                    style={s.clearBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={12} color={T.inkMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* ── Header liste clients ── */}
              <SH
                accentColor={T.green}
                label={`Clients SaaS (${filtered.length})`}
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
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="add" size={16} color={T.brand} />
                  </TouchableOpacity>
                }
              />

              {loading && (
                <ActivityIndicator color={T.brand} style={{ marginVertical: 24 }} size="large" />
              )}
            </Animated.View>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <Ionicons name="business-outline" size={22} color={T.inkMuted} />
                </View>
                <Text style={[s.emptyTitle, { fontFamily: T.font.display }]}>Aucun client trouvé</Text>
                <Text style={[s.emptySub, { fontFamily: T.font.subtitle }]}>
                  Modifiez votre recherche ou créez une nouvelle structure.
                </Text>
              </View>
            ) : null
          }
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

// ─── Styles globaux ────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: T.white }, // blanc (ex-heroA) — le hero est blanc
  screen: { flex: 1, backgroundColor: T.pageBg },

  list:         { paddingHorizontal: LIST_H_PAD, paddingTop: 6 },
  stackWrapper: { marginTop: 18, marginBottom: 14 },

  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface, borderRadius: T.radius.md,
    paddingHorizontal: 12, height: 44,
    borderWidth: 1, borderColor: T.border,
    marginBottom: 16, gap: 8,
    ...T.shadow.card,
  },
  searchInput: { flex: 1, fontSize: 13, color: T.ink },
  clearBtn: {
    width: 20, height: 20, borderRadius: T.radius.full,
    backgroundColor: T.pageBg, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.border,
  },

  addBtn: {
    width: 30, height: 30, borderRadius: T.radius.sm,
    backgroundColor: T.brandLt,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.brandMd,
  },

  empty: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyIcon: {
    width: 52, height: 52, borderRadius: T.radius.md,
    backgroundColor: T.surface, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.border,
  },
  emptyTitle: { color: T.ink,     fontSize: 15, fontWeight: "600" },
  emptySub:   { color: T.inkMuted, fontSize: 12, textAlign: "center", paddingHorizontal: 36 },
});