// apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
// =========================================================
// SUPER ADMIN DASHBOARD v14.3 — Direct Transf'air
// ✅ v14.3 : Suppression de la section "AGENCES DU RÉSEAU" globale
//            Les agences s'affichent désormais UNIQUEMENT dans
//            les détails de chaque société (clients/details.tsx)
// =========================================================

import React, { useCallback, useMemo, useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  FlatList, ActivityIndicator, TextInput, RefreshControl,
  Alert, Platform, Animated, PanResponder, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import CreateCompanyModal from "./CreateCompanyModal";

const { width: SW } = Dimensions.get("window");

const T = {
  heroA: "#4F46E5",
  heroB: "#7C3AED",
  brand:     "#4F46E5",
  brandDark: "#4338CA",
  brandLt:   "#EEF2FF",
  brandMd:   "#E0E7FF",
  pageBg:    "#F5F7FF",
  surface:   "#FFFFFF",
  surfaceAlt:"#FAFBFF",
  border:    "#E8EDFB",
  borderMd:  "#D1D9F5",
  ink:      "#1E1B4B",
  inkMid:   "#3730A3",
  inkSub:   "#6B7280",
  inkMuted: "#9CA3AF",
  green:    "#059669", greenLt:  "#ECFDF5", greenMd:  "#D1FAE5",
  red:      "#DC2626", redLt:    "#FEF2F2",
  amber:    "#D97706", amberLt:  "#FFFBEB",
  violet:   "#7C3AED", violetLt: "#F5F3FF", violetMd: "#EDE9FE",
  teal:     "#0D9488", tealLt:   "#F0FDFA", tealMd:   "#CCFBF1",
  rose:     "#E11D48", roseLt:   "#FFF1F2",
  white: "#FFFFFF",
  currencies: {
    EUR: { code: "EUR", symbol: "€",   flag: "🇪🇺", color: "#4F46E5", colorDark: "#3730A3", bg: "#EEF2FF", name: "Euro" },
    USD: { code: "USD", symbol: "$",   flag: "🇺🇸", color: "#059669", colorDark: "#065F46", bg: "#ECFDF5", name: "Dollar US" },
    XOF: { code: "XOF", symbol: "CFA", flag: "🌍",  color: "#D97706", colorDark: "#92400E", bg: "#FFFBEB", name: "Franc CFA" },
    GNF: { code: "GNF", symbol: "FG",  flag: "🇬🇳", color: "#DC2626", colorDark: "#991B1B", bg: "#FEF2F2", name: "Franc Guinéen" },
    GBP: { code: "GBP", symbol: "£",   flag: "🇬🇧", color: "#7C3AED", colorDark: "#6D28D9", bg: "#F5F3FF", name: "Livre Sterling" },
  },
  statusColors: { ACTIVE: "#059669", SUSPENDED: "#D97706", INACTIVE: "#DC2626", EXPIRED: "#DC2626", TRIAL: "#4F46E5" } as Record<string, string>,
  statusBg:     { ACTIVE: "#ECFDF5", SUSPENDED: "#FFFBEB", INACTIVE: "#FEF2F2", EXPIRED: "#FEF2F2", TRIAL: "#EEF2FF"   } as Record<string, string>,
  radius: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 999 },
  font: {
    display:  Platform.select({ ios: "System", android: "sans-serif-medium", default: "System" }),
    sans:     Platform.select({ ios: "System", android: "sans-serif",        default: "System" }),
    subtitle: Platform.select({ ios: "System", android: "sans-serif-light",  default: "System" }),
    mono:     Platform.select({ ios: "Courier New", android: "monospace",    default: "Courier" }),
  },
  shadow: {
    card:  { shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 2  }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
    float: { shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 6  }, shadowOpacity: 0.10, shadowRadius: 18, elevation: 5 },
    hero:  { shadowColor: "#3730A3", shadowOffset: { width: 0, height: 8  }, shadowOpacity: 0.14, shadowRadius: 20, elevation: 7 },
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
  } catch { return n.toFixed(decimals); }
}

// ─── Currency Stack Card ──────────────────────────────────
function CurrencyStack({ wallets }: { wallets: any[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const total = CURRENCIES_ORDER.length;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, gs) => Math.abs(gs.dx) > 6,
      onPanResponderMove:  (_, gs) => { translateX.setValue(gs.dx); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -48)     setActiveIdx((p) => Math.min(p + 1, total - 1));
        else if (gs.dx > 48) setActiveIdx((p) => Math.max(p - 1, 0));
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 28, bounciness: 5 }).start();
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
      {([2, 1] as const).filter((d) => d <= behindCount).map((d) => {
        const behindCur = CURRENCIES_ORDER[activeIdx + d] as keyof typeof T.currencies;
        const cfg = T.currencies[behindCur];
        return (
          <View key={`behind-${d}`} style={[stk.card, {
            position: "absolute", bottom: d * STACK_OFFSET_Y,
            transform: [{ scale: 1 - d * 0.03 }], width: STACK_W,
            opacity: 0.55 - d * 0.18, zIndex: 10 - d,
            backgroundColor: d === 1 ? "#F0F3FF" : "#E8EEFF",
          }]}>
            <View style={stk.peekRow}>
              <Text style={{ fontSize: 15, marginRight: 6 }}>{cfg.flag}</Text>
              <Text style={[stk.peekCode, { color: T.inkMid, fontFamily: T.font.mono }]}>{cfg.code}</Text>
              <Text style={[stk.peekName, { color: T.inkSub, fontFamily: T.font.subtitle }]}>{cfg.name}</Text>
            </View>
          </View>
        );
      })}

      <Animated.View style={[stk.card, stk.front, { transform: [{ translateX }] }]}>
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
              <TouchableOpacity onPress={() => setActiveIdx((p) => Math.max(p - 1, 0))} style={[stk.navBtn, { opacity: activeIdx === 0 ? 0.25 : 1 }]}>
                <Ionicons name="chevron-back" size={13} color={T.inkMid} />
              </TouchableOpacity>
              <Text style={[stk.navCount, { color: T.inkSub, fontFamily: T.font.mono }]}>{activeIdx + 1}/{total}</Text>
              <TouchableOpacity onPress={() => setActiveIdx((p) => Math.min(p + 1, total - 1))} style={[stk.navBtn, { opacity: activeIdx === total - 1 ? 0.25 : 1 }]}>
                <Ionicons name="chevron-forward" size={13} color={T.inkMid} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={stk.divider} />
          <View style={stk.row2}>
            <View style={{ flex: 1 }}>
              <Text style={[stk.balLabel, { color: T.inkMuted, fontFamily: T.font.sans }]}>SOLDE TOTAL</Text>
              <Text style={[stk.balAmount, { color: T.ink, fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {fmtAmount(balance, activeCur)}{" "}
                <Text style={[stk.balSym, { color: T.inkSub }]}>{activeCfg.symbol}</Text>
              </Text>
            </View>
            <View style={[stk.availPill, { backgroundColor: activeCfg.bg }]}>
              <Text style={[stk.availLbl, { color: activeCfg.colorDark, fontFamily: T.font.sans }]}>Disponible</Text>
              <Text style={[stk.availAmt, { color: activeCfg.color, fontFamily: T.font.display }]}>
                {fmtAmount(available, activeCur)} {activeCfg.symbol}
              </Text>
            </View>
          </View>
          <View style={stk.dots}>
            {CURRENCIES_ORDER.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => setActiveIdx(i)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <View style={[stk.dot, { width: i === activeIdx ? 16 : 4, backgroundColor: i === activeIdx ? activeCfg.color : T.borderMd }]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
const stk = StyleSheet.create({
  wrapper:  { marginHorizontal: 20, height: STACK_H + 22, justifyContent: "flex-start", alignItems: "center" },
  card:     { width: STACK_W, height: STACK_H, backgroundColor: T.surface, borderRadius: T.radius.lg, borderWidth: 1, borderColor: T.border, overflow: "hidden", ...T.shadow.float },
  front:    { zIndex: 20, position: "relative", flexDirection: "row" },
  accentBar:{ width: 4, height: "100%" },
  inner:    { flex: 1, padding: 14 },
  peekRow:  { flexDirection: "row", alignItems: "center", paddingTop: 6, paddingHorizontal: 14 },
  peekCode: { fontSize: 12, fontWeight: "600", marginRight: 6 },
  peekName: { fontSize: 11 },
  row1:     { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  flagBox:  { width: 34, height: 34, borderRadius: T.radius.sm, justifyContent: "center", alignItems: "center" },
  cardCode: { fontSize: 14, fontWeight: "700" },
  cardName: { fontSize: 11, marginTop: 1 },
  navArea:  { flexDirection: "row", alignItems: "center", gap: 4 },
  navBtn:   { width: 26, height: 26, borderRadius: T.radius.xs, backgroundColor: T.pageBg, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  navCount: { fontSize: 10, fontWeight: "500" },
  divider:  { height: 1, backgroundColor: T.border, marginBottom: 10 },
  row2:     { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  balLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.6, marginBottom: 3, textTransform: "uppercase" },
  balAmount:{ fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  balSym:   { fontSize: 14, fontWeight: "400" },
  availPill:{ alignItems: "flex-end", paddingHorizontal: 10, paddingVertical: 6, borderRadius: T.radius.sm },
  availLbl: { fontSize: 9, fontWeight: "600", marginBottom: 2, textTransform: "uppercase" },
  availAmt: { fontSize: 13, fontWeight: "700" },
  dots:     { flexDirection: "row", gap: 4, marginTop: 10, alignItems: "center", justifyContent: "center" },
  dot:      { height: 4, borderRadius: T.radius.full },
});

// ─── Hero ─────────────────────────────────────────────────
function DashHero({ animValue, user, onRefresh, onNotif }: {
  animValue: Animated.Value; user: any; onRefresh: () => void; onNotif: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View style={[hS.outer, {
      opacity: animValue,
      transform: [{ translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
    }]}>
      <LinearGradient
        colors={[T.heroA, T.heroB, "#9333EA"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[hS.gradient, { paddingTop: insets.top + 14, paddingBottom: 28 }]}
      >
        <View style={hS.deco1} />
        <View style={hS.deco2} />
        <View style={hS.topBar}>
          <View style={hS.topLeft}>
            <View style={hS.badge}>
              <View style={hS.activeDot} />
              <Text style={[hS.badgeTxt, { fontFamily: T.font.sans }]}>SUPER ADMIN</Text>
            </View>
            <Text style={[hS.name, { fontFamily: T.font.display }]}>{user?.firstName ?? "Console"}</Text>
            <Text style={[hS.sub,  { fontFamily: T.font.subtitle }]}>Direct Transf'air™ · Trésorerie globale</Text>
          </View>
          <View style={hS.btns}>
            <TouchableOpacity style={hS.btn} onPress={onRefresh} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={17} color={T.white} />
            </TouchableOpacity>
            <TouchableOpacity style={hS.btn} onPress={onNotif} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={17} color={T.white} />
              <View style={hS.notifDot} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}
const hS = StyleSheet.create({
  outer:    { zIndex: 10 },
  gradient: { borderBottomLeftRadius: T.radius.xl, borderBottomRightRadius: T.radius.xl, overflow: "hidden" },
  deco1:    { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.05)", top: -40, right: -40 },
  deco2:    { position: "absolute", width: 100, height: 100, borderRadius: 50,  backgroundColor: "rgba(255,255,255,0.06)", bottom: 10, left: 30 },
  topBar:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  topLeft:  { flex: 1 },
  badge:    { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: T.radius.xs, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 8 },
  activeDot:{ width: 5, height: 5, borderRadius: T.radius.full, backgroundColor: "#34D399" },
  badgeTxt: { color: T.white, fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  name:     { color: T.white, fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
  sub:      { color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 3 },
  btns:     { flexDirection: "row", gap: 8 },
  btn:      { width: 38, height: 38, borderRadius: T.radius.sm, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  notifDot: { position: "absolute", top: 9, right: 9, width: 7, height: 7, borderRadius: T.radius.full, backgroundColor: "#F87171", borderWidth: 1.5, borderColor: T.white },
});

// ─── Stat Strip ───────────────────────────────────────────
function StatStrip({ stats }: { stats: { total: number; active: number; inactive: number } }) {
  const items = [
    { label: "Sociétés",  value: stats.total,    color: T.brand, bg: T.brandLt, icon: "business-outline" as const },
    { label: "Actives",   value: stats.active,   color: T.green, bg: T.greenLt, icon: "checkmark-circle-outline" as const },
    { label: "Inactives", value: stats.inactive, color: T.red,   bg: T.redLt,   icon: "close-circle-outline" as const },
  ];
  return (
    <View style={ssS.row}>
      {items.map((it, idx) => (
        <View key={idx} style={ssS.card}>
          <View style={[ssS.iconWrap, { backgroundColor: it.bg }]}>
            <Ionicons name={it.icon} size={14} color={it.color} />
          </View>
          <Text style={[ssS.val, { color: it.color, fontFamily: T.font.display }]}>{it.value}</Text>
          <Text style={[ssS.lbl, { fontFamily: T.font.sans }]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}
const ssS = StyleSheet.create({
  row:     { flexDirection: "row", gap: 10, marginBottom: 20, marginTop: 10 },
  card:    { flex: 1, backgroundColor: T.surface, borderRadius: T.radius.md, padding: 14, borderWidth: 1, borderColor: T.border, alignItems: "center", gap: 4, ...T.shadow.card },
  iconWrap:{ width: 28, height: 28, borderRadius: T.radius.xs, justifyContent: "center", alignItems: "center", marginBottom: 2 },
  val:     { fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
  lbl:     { fontSize: 11, color: T.inkSub, fontWeight: "500" },
});

// ─── Action Grid ──────────────────────────────────────────
function ActionGrid({ actions }: { actions: any[] }) {
  return (
    <View style={agS.grid}>
      {actions.map((a) => (
        <TouchableOpacity key={a.title} style={agS.card} onPress={a.onPress} activeOpacity={0.82}>
          <View style={[agS.iconBox, { backgroundColor: a.bgColor }]}>
            <Ionicons name={a.icon} size={18} color={a.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[agS.title, { fontFamily: T.font.sans, color: T.ink }]} numberOfLines={1}>{a.title}</Text>
            <Text style={[agS.sub, { fontFamily: T.font.subtitle, color: T.inkSub }]} numberOfLines={1}>{a.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={12} color={T.borderMd} />
        </TouchableOpacity>
      ))}
    </View>
  );
}
const agS = StyleSheet.create({
  grid:    { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 20 },
  card:    { width: "48.5%", flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.surface, borderRadius: T.radius.md, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: T.border, ...T.shadow.card },
  iconBox: { width: 36, height: 36, borderRadius: T.radius.sm, justifyContent: "center", alignItems: "center" },
  title:   { fontSize: 12, fontWeight: "600" },
  sub:     { fontSize: 10, marginTop: 1 },
});

// ─── Client Card ──────────────────────────────────────────
// ✅ v14.3 : Affiche la société + ses compteurs
//            NE liste PAS les agences ici → voir details.tsx
const AVATAR_PALETTE = [
  { bg: "#EEF2FF", text: "#4F46E5" }, { bg: "#ECFDF5", text: "#059669" },
  { bg: "#FEF2F2", text: "#DC2626" }, { bg: "#FFFBEB", text: "#D97706" },
  { bg: "#F5F3FF", text: "#7C3AED" }, { bg: "#F0FDFA", text: "#0D9488" },
];
function getAvatarColors(name: string) {
  return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length];
}

function ClientCard({ item, onPress }: { item: any; onPress: () => void }) {
  const statusKey   = item.subscriptionStatus?.toUpperCase() ?? "ACTIVE";
  const statusColor = T.statusColors[statusKey] ?? T.inkMuted;
  const statusBg    = T.statusBg[statusKey]    ?? T.pageBg;
  const avatarColors = getAvatarColors(item.name || "C");
  const agencyCount  = item._count?.agencies ?? item.agencies?.length ?? 0;
  const userCount    = item._count?.users    ?? item.users?.length    ?? 0;
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 10 }}>
      <TouchableOpacity
        style={cc.card}
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
      >
        {/* Barre gauche colorée selon statut */}
        <View style={[cc.sideBar, { backgroundColor: statusColor }]} />

        <View style={cc.body}>
          {/* Row principale */}
          <View style={cc.topRow}>
            {/* Avatar */}
            <View style={[cc.avatar, { backgroundColor: avatarColors.bg }]}>
              <Text style={[cc.avatarLetter, { color: avatarColors.text, fontFamily: T.font.display }]}>
                {(item.name?.[0] ?? "C").toUpperCase()}
              </Text>
            </View>

            {/* Nom + code */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={cc.nameRow}>
                <Text style={[cc.name, { fontFamily: T.font.sans }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={[cc.codeBadge, { backgroundColor: T.amberLt }]}>
                  <Text style={[cc.codeText, { fontFamily: T.font.mono }]}>{item.code}</Text>
                </View>
              </View>
              {/* Status */}
              <View style={[cc.statusBadge, { backgroundColor: statusBg, borderColor: `${statusColor}30` }]}>
                <View style={[cc.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[cc.statusText, { color: statusColor, fontFamily: T.font.sans }]}>
                  {statusKey}
                </Text>
              </View>
            </View>

            {/* Flèche */}
            <View style={cc.chevronBox}>
              <Ionicons name="chevron-forward" size={14} color={T.brand} />
            </View>
          </View>

          {/* Tags compteurs — agences, utilisateurs, type contrat */}
          <View style={cc.tagsRow}>
            <View style={[cc.tag, { backgroundColor: T.brandLt, borderColor: T.brandMd }]}>
              <Ionicons name="storefront-outline" size={10} color={T.brand} />
              <Text style={[cc.tagText, { color: T.brand, fontFamily: T.font.sans }]}>
                {agencyCount} agence{agencyCount > 1 ? "s" : ""}
              </Text>
            </View>
            <View style={[cc.tag, { backgroundColor: T.violetLt, borderColor: T.violetMd }]}>
              <Ionicons name="people-outline" size={10} color={T.violet} />
              <Text style={[cc.tagText, { color: T.violet, fontFamily: T.font.sans }]}>
                {userCount} utilisateur{userCount > 1 ? "s" : ""}
              </Text>
            </View>
            <View style={[cc.tag, { backgroundColor: T.amberLt, borderColor: "#FDE68A" }]}>
              <Ionicons name="swap-horizontal-outline" size={10} color={T.amber} />
              <Text style={[cc.tagText, { color: T.amber, fontFamily: T.font.sans }]}>
                {item.subscriptionType === "PURCHASE" ? "Achat" : "Location"}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const cc = StyleSheet.create({
  card:        { flexDirection: "row", backgroundColor: T.surface, borderRadius: T.radius.lg, borderWidth: 1, borderColor: T.border, overflow: "hidden", ...T.shadow.card },
  sideBar:     { width: 4 },
  body:        { flex: 1, padding: 14 },
  topRow:      { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  avatar:      { width: 44, height: 44, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  avatarLetter:{ fontSize: 18, fontWeight: "800" },
  nameRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" },
  name:        { fontSize: 14, fontWeight: "700", color: T.ink },
  codeBadge:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  codeText:    { fontSize: 9, fontWeight: "900", color: T.amber, letterSpacing: 0.5 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
  statusDot:   { width: 5, height: 5, borderRadius: 99 },
  statusText:  { fontSize: 9, fontWeight: "800" },
  chevronBox:  { width: 28, height: 28, borderRadius: 8, backgroundColor: T.brandLt, justifyContent: "center", alignItems: "center" },
  tagsRow:     { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tag:         { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, borderWidth: 1 },
  tagText:     { fontSize: 10, fontWeight: "700" },
});

// ─── Section Header ───────────────────────────────────────
function SH({ accentColor = T.brand, label, right }: {
  accentColor?: string; label: string; right?: React.ReactNode;
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
  const router       = useRouter();
  const { user }     = useAuth();
  const insets       = useSafeAreaInsets();
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
    if (mode === "refresh") setRefreshing(true); else setLoading(true);
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
      if (mode === "refresh") setRefreshing(false); else setLoading(false);
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
    inactive: clients.filter((c) => ["INACTIVE", "EXPIRED", "SUSPENDED"].includes(c.subscriptionStatus?.toUpperCase())).length,
  }), [clients]);

  const actions = useMemo(() => [
    { title: "Trésorerie",   subtitle: "Vue globale",      icon: "wallet-outline",           color: T.brand,  bgColor: T.brandLt,  onPress: () => router.push("/(tabs)/admin/treasury")    },
    { title: "Supervision",  subtitle: "Logs système",     icon: "shield-checkmark-outline", color: T.teal,   bgColor: T.tealLt,   onPress: () => router.push("/(tabs)/admin/supervision")  },
    { title: "Transactions", subtitle: "Audit temps réel", icon: "analytics-outline",        color: T.green,  bgColor: T.greenLt,  onPress: () => router.push("/(tabs)/admin/transactions") },
    { title: "Utilisateurs", subtitle: "Accès & Rôles",    icon: "people-outline",           color: T.violet, bgColor: T.violetLt, onPress: () => router.push("/(tabs)/admin/users")        },
  ], [router]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar backgroundColor={T.heroA} barStyle="light-content" translucent={false} />
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
              onPress={() => router.push({
                pathname: "/(tabs)/admin/clients/details",
                params:   { id: item.id },
              })}
            />
          )}
          contentContainerStyle={[s.list, { paddingBottom: LIST_BOTTOM_PADDING + insets.bottom }]}
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
            <Animated.View style={{
              opacity: contentAnim,
              transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            }}>
              <View style={s.stackWrapper}>
                <CurrencyStack wallets={wallets} />
              </View>

              <StatStrip stats={stats} />

              <SH accentColor={T.brand} label="Pilotage réseau" />
              <ActionGrid actions={actions} />

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
                  <TouchableOpacity onPress={() => setQ("")} style={s.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={12} color={T.inkMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* ✅ v14.3 : "Clients SaaS" uniquement — plus d'agences ici */}
              <SH
                accentColor={T.green}
                label={`Clients SaaS (${filtered.length})`}
                right={
                  <TouchableOpacity
                    style={[s.addBtn, !isSuperAdmin && { opacity: 0.4 }]}
                    onPress={() => {
                      if (!isSuperAdmin) { Alert.alert("Accès refusé", "Seul le Super Admin peut créer une société."); return; }
                      setCreateOpen(true);
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="add" size={16} color={T.brand} />
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

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: T.heroA },
  screen:       { flex: 1, backgroundColor: T.pageBg },
  list:         { paddingHorizontal: LIST_H_PAD, paddingTop: 6 },
  stackWrapper: { marginTop: 18, marginBottom: 14 },
  searchBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: T.surface,
    borderRadius: T.radius.md, paddingHorizontal: 12, height: 44,
    borderWidth: 1, borderColor: T.border, marginBottom: 16, gap: 8, ...T.shadow.card,
  },
  searchInput:  { flex: 1, fontSize: 13, color: T.ink },
  clearBtn:     { width: 20, height: 20, borderRadius: T.radius.full, backgroundColor: T.pageBg, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  addBtn:       { width: 30, height: 30, borderRadius: T.radius.sm, backgroundColor: T.brandLt, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.brandMd },
  empty:        { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyIcon:    { width: 52, height: 52, borderRadius: T.radius.md, backgroundColor: T.surface, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  emptyTitle:   { color: T.ink, fontSize: 15, fontWeight: "600" },
  emptySub:     { color: T.inkMuted, fontSize: 12, textAlign: "center", paddingHorizontal: 36 },
});