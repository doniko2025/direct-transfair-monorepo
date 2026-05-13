// apps/direct-transfair-mobile/components/dashboards/SuperAdminDashboard.tsx
// =========================================================
// SUPER ADMIN DASHBOARD v8.0 — Direct Transf'air
// ✅ Hero compact forme fintech (wave bottom, inspiration capture 2)
// ✅ Cartes devises compactes, superposées, swipe au doigt
// ✅ Stats / Actions / Clients modernes
// ✅ Animations entrée fluides
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
import Svg, { Path } from "react-native-svg";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import CreateCompanyModal from "./CreateCompanyModal";

const { width: SW } = Dimensions.get("window");

// ─── Design Tokens ────────────────────────────────────────
const T = {
  blue:     "#1956F0",
  blueDark: "#1240D6",
  blueDeep: "#0A2CB8",
  blueDeeper:"#0822A0",
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

  white:    "#FFFFFF",

  currencies: {
    EUR: { code: "EUR", symbol: "€",   flag: "🇪🇺", color: "#1956F0", colorDark: "#1240D6", bg: "#EEF2FF",  name: "Euro" },
    USD: { code: "USD", symbol: "$",   flag: "🇺🇸", color: "#16A34A", colorDark: "#15803D", bg: "#DCFCE7",  name: "Dollar US" },
    XOF: { code: "XOF", symbol: "CFA", flag: "🌍",  color: "#D97706", colorDark: "#B45309", bg: "#FEF3C7",  name: "Franc CFA" },
    GNF: { code: "GNF", symbol: "FG",  flag: "🇬🇳", color: "#DC2626", colorDark: "#B91C1C", bg: "#FEE2E2",  name: "Franc Guinéen" },
    GBP: { code: "GBP", symbol: "£",   flag: "🇬🇧", color: "#7C3AED", colorDark: "#6D28D9", bg: "#EDE9FE",  name: "Livre Sterling" },
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
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    deep: {
      shadowColor: "#0D33B0",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.2,
      shadowRadius: 28,
      elevation: 16,
    },
    soft: {
      shadowColor: "#1240D6",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 4,
    },
  },
};

const CURRENCIES_ORDER = ["EUR", "USD", "XOF", "GNF", "GBP"] as const;

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

// ─── Cartes devises compactes empilées — swipe au doigt ──
const CARD_W = SW - 80;
const CARD_H = 110; // compact
const PEEK_OFFSET = 8;
const PEEK_SCALE_STEP = 0.04;

function CurrencyStack({ wallets }: { wallets: any[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const total = CURRENCIES_ORDER.length;

  const getWalletData = (currency: string) => {
    const w = wallets.find((x) => x.currency === currency);
    return { balance: toNum(w?.balance), reserved: toNum(w?.reservedBalance) };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 8,
      onPanResponderMove: (_, gs) => { translateX.setValue(gs.dx); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -45) setActiveIdx((p) => Math.min(p + 1, total - 1));
        else if (gs.dx > 45) setActiveIdx((p) => Math.max(p - 1, 0));
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 32, bounciness: 5 }).start();
      },
    })
  ).current;

  return (
    <View style={stk.wrapper} {...panResponder.panHandlers}>
      {/* Cartes empilées derrière — 2 visibles */}
      {[2, 1].map((offset) => {
        const idx = activeIdx + offset;
        if (idx >= total) return null;
        const cfg = T.currencies[CURRENCIES_ORDER[idx] as keyof typeof T.currencies];
        return (
          <View
            key={`behind-${offset}`}
            style={[
              stk.card,
              {
                position: "absolute",
                top: offset * PEEK_OFFSET,
                left: offset * 5,
                right: offset * 5,
                opacity: 1 - offset * 0.22,
                transform: [{ scaleX: 1 - offset * PEEK_SCALE_STEP }],
                zIndex: 10 - offset,
                borderTopColor: cfg.color,
              },
            ]}
          >
            <View style={[stk.peekAccent, { backgroundColor: cfg.color }]} />
            <View style={stk.peekInner}>
              <Text style={{ fontSize: 16 }}>{cfg.flag}</Text>
              <Text style={[stk.peekCode, { color: cfg.color }]}>{cfg.code}</Text>
            </View>
          </View>
        );
      })}

      {/* Carte active */}
      {(() => {
        const cur = CURRENCIES_ORDER[activeIdx] as keyof typeof T.currencies;
        const cfg = T.currencies[cur];
        const data = getWalletData(cur);
        const available = data.balance - data.reserved;
        return (
          <Animated.View
            style={[stk.card, stk.front, { borderTopColor: cfg.color, transform: [{ translateX }] }]}
          >
            {/* Accent bande */}
            <View style={[stk.frontAccent, { backgroundColor: cfg.color }]} />

            <View style={stk.row}>
              {/* Gauche: flag + nom + montant */}
              <View style={stk.left}>
                <View style={stk.flagRow}>
                  <View style={[stk.flagBox, { backgroundColor: cfg.bg }]}>
                    <Text style={{ fontSize: 18 }}>{cfg.flag}</Text>
                  </View>
                  <View>
                    <Text style={[stk.code, { color: cfg.color }]}>{cfg.code}</Text>
                    <Text style={stk.name}>{cfg.name}</Text>
                  </View>
                </View>
                <Text
                  style={[stk.amount, { color: cfg.colorDark }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {fmtAmount(data.balance, cur)}{" "}
                  <Text style={[stk.symbol, { color: cfg.color }]}>{cfg.symbol}</Text>
                </Text>
              </View>

              {/* Droite: dispo + nav */}
              <View style={stk.right}>
                <View style={[stk.dispoBox, { backgroundColor: cfg.bg }]}>
                  <Text style={[stk.dispoLabel, { color: cfg.colorDark }]}>DISPO</Text>
                  <Text style={[stk.dispoAmt, { color: cfg.colorDark }]}>{fmtAmount(available, cur)}</Text>
                </View>
                {/* Dots */}
                <View style={stk.dots}>
                  {CURRENCIES_ORDER.map((_, i) => (
                    <TouchableOpacity key={i} onPress={() => setActiveIdx(i)}>
                      <View style={[stk.dot, {
                        width: i === activeIdx ? 14 : 4,
                        backgroundColor: i === activeIdx ? cfg.color : "rgba(0,0,0,0.18)",
                      }]} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </Animated.View>
        );
      })()}
    </View>
  );
}

const stk = StyleSheet.create({
  wrapper: {
    height: CARD_H + PEEK_OFFSET * 2 + 10,
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 18,
    borderWidth: 1,
    borderTopWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
    padding: 12,
    overflow: "hidden",
    shadowColor: "#0A2FA8",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 12,
  },
  front: { zIndex: 20, position: "relative", top: 0 },
  frontAccent: {
    position: "absolute", top: 0, left: 0, right: 0, height: 44, opacity: 0.06,
  },
  peekAccent: {
    position: "absolute", top: 0, left: 0, right: 0, height: 3, opacity: 0.7,
  },
  peekInner: { flexDirection: "row", alignItems: "center", gap: 7, padding: 10 },
  peekCode: { fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },

  row: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  left: { flex: 1, gap: 8 },
  right: { alignItems: "flex-end", gap: 8 },

  flagRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  flagBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  code: { fontSize: 12, fontWeight: "900", letterSpacing: 1.4 },
  name: { fontSize: 10, color: T.inkSub, marginTop: 1 },

  amount: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  symbol: { fontSize: 13, fontWeight: "700" },

  dispoBox: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6, alignItems: "center", minWidth: 66 },
  dispoLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 1.2, marginBottom: 2 },
  dispoAmt: { fontSize: 12, fontWeight: "700" },

  dots: { flexDirection: "row", gap: 3, alignItems: "center" },
  dot: { height: 4, borderRadius: 99 },
});

// ─── Hero — forme wave/fintech (inspiration capture 2) ────
// La forme basse est une courbe SVG asymétrique (vague douce),
// fond bleu profond dégradé, le hero est compact.

const HERO_H = 260; // hauteur totale du hero zone
const WAVE_H = 38;  // hauteur de la vague basse

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
  // Courbe SVG pour simuler la forme "vague" de la capture 2
  // Chemin: part du coin bas-gauche, monte légèrement au centre, descend à droite
  const wavePath = `M0,0 L${SW},0 L${SW},${WAVE_H - 10} Q${SW * 0.75},${WAVE_H + 14} ${SW * 0.5},${WAVE_H - 4} Q${SW * 0.25},${WAVE_H - 22} 0,${WAVE_H + 6} Z`;

  return (
    <Animated.View
      style={[
        heroS.outer,
        {
          opacity: animValue,
          transform: [{ translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        },
      ]}
    >
      <LinearGradient
        colors={["#2461FF", "#1340D4", "#0A22A8"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={heroS.gradient}
      >
        {/* Décos lumineuses */}
        <View style={heroS.glow1} />
        <View style={heroS.glow2} />
        <View style={heroS.glow3} />

        {/* Top bar */}
        <View style={heroS.topBar}>
          <View style={{ flex: 1 }}>
            <View style={heroS.badge}>
              <View style={heroS.badgeDot} />
              <Text style={[heroS.badgeTxt, { fontFamily: T.font.sans }]}>SUPER ADMIN</Text>
            </View>
            <Text style={[heroS.title, { fontFamily: T.font.display }]}>
              {user?.firstName ?? "Console"}
            </Text>
            <Text style={[heroS.sub, { fontFamily: T.font.subtitle }]}>
              Direct Transf'air™ · Trésorerie
            </Text>
          </View>
          <View style={heroS.btns}>
            <TouchableOpacity style={heroS.btn} onPress={onRefresh}>
              <Ionicons name="refresh" size={16} color={T.white} />
            </TouchableOpacity>
            <TouchableOpacity style={heroS.btn} onPress={onNotif}>
              <Ionicons name="notifications" size={16} color={T.white} />
              <View style={heroS.notifDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stack cartes compact */}
        <CurrencyStack wallets={wallets} />

        {/* Padding bas avant wave */}
        <View style={{ height: WAVE_H + 6 }} />
      </LinearGradient>

      {/* Wave SVG découpant le bas du hero */}
      <View style={heroS.waveCover} pointerEvents="none">
        <Svg width={SW} height={WAVE_H + 10} viewBox={`0 0 ${SW} ${WAVE_H + 10}`}>
          <Path d={wavePath} fill={T.pageBg} />
        </Svg>
      </View>
    </Animated.View>
  );
}

const heroS = StyleSheet.create({
  outer: {
    zIndex: 10,
    shadowColor: "#0A2FA8",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.38,
    shadowRadius: 32,
    elevation: 22,
    marginBottom: -6,
  },
  gradient: {
    overflow: "hidden",
  },
  glow1: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.07)", top: -60, right: -40,
  },
  glow2: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.05)", bottom: 20, left: -30,
  },
  glow3: {
    position: "absolute", width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(99,179,237,0.12)", top: 40, left: SW * 0.4,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 12 : 14,
    marginBottom: 4,
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4,
    alignSelf: "flex-start", marginBottom: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },
  badgeDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: "#4ADE80" },
  badgeTxt: { color: "rgba(255,255,255,0.92)", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: T.white, fontSize: 24, fontWeight: "700", letterSpacing: -0.3 },
  sub: { color: "rgba(255,255,255,0.62)", fontSize: 11, marginTop: 2 },
  btns: { flexDirection: "row", gap: 8, paddingTop: 2 },
  btn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  notifDot: {
    position: "absolute", top: 8, right: 8,
    width: 7, height: 7, borderRadius: 99,
    backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: "#1240D6",
  },
  waveCover: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
  },
});

// ─── Stat Strip ───────────────────────────────────────────
function StatStrip({ stats }: { stats: { total: number; active: number; inactive: number } }) {
  const items = [
    { label: "Sociétés",  value: stats.total,    color: T.blue,  bg: T.blueLt,  icon: "business-outline" },
    { label: "Actives",   value: stats.active,   color: T.green, bg: T.greenLt, icon: "checkmark-circle-outline" },
    { label: "Inactives", value: stats.inactive, color: T.red,   bg: T.redLt,   icon: "close-circle-outline" },
  ];
  return (
    <View style={ssS.row}>
      {items.map((it, idx) => (
        <View key={idx} style={[ssS.card, { borderLeftColor: it.color }]}>
          <View style={[ssS.iconBox, { backgroundColor: it.bg }]}>
            <Ionicons name={it.icon as any} size={16} color={it.color} />
          </View>
          <Text style={[ssS.val, { color: it.color, fontFamily: T.font.display }]}>{it.value}</Text>
          <Text style={[ssS.lbl, { fontFamily: T.font.sans }]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const ssS = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginTop: 18, marginBottom: 20 },
  card: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: T.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    borderLeftWidth: 3,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: T.border,
    ...T.shadow.soft,
  },
  iconBox: {
    width: 32, height: 32, borderRadius: 9,
    justifyContent: "center", alignItems: "center", marginBottom: 7,
  },
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
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 20 },
  card: {
    width: "48.5%",
    backgroundColor: T.surface,
    borderRadius: T.radius.md,
    padding: 14,
    paddingTop: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T.border,
    overflow: "hidden",
    ...T.shadow.soft,
  },
  bar: { position: "absolute", top: 0, left: 0, right: 0, height: 3, opacity: 0.85 },
  iconBox: { width: 40, height: 40, borderRadius: 11, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 2 },
  sub: { fontSize: 10, color: T.inkSub },
  arrow: { position: "absolute", right: 10, top: 10, width: 22, height: 22, borderRadius: 6, justifyContent: "center", alignItems: "center" },
});

// ─── Client Card ──────────────────────────────────────────
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
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface,
    borderRadius: T.radius.md,
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: T.border,
    gap: 11,
    ...T.shadow.soft,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 11,
    backgroundColor: T.blueLt,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: T.blueMd,
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
    { title: "Trésorerie",     subtitle: "Vue globale",       icon: "wallet-outline",        color: T.blue,   bgColor: T.blueLt,   onPress: () => router.push("/(tabs)/admin/treasury") },
    { title: "Taux & Devises", subtitle: "5 devises",         icon: "trending-up-outline",   color: T.amber,  bgColor: T.amberLt,  onPress: () => router.push("/(tabs)/admin/rates") },
    { title: "Transactions",   subtitle: "Audit temps réel",  icon: "analytics-outline",     color: T.green,  bgColor: T.greenLt,  onPress: () => router.push("/(tabs)/admin/transactions") },
    { title: "Utilisateurs",   subtitle: "Accès & Rôles",     icon: "people-outline",        color: T.purple, bgColor: T.purpleLt, onPress: () => router.push("/(tabs)/admin/users") },
  ], [router]);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={T.blueDeeper} barStyle="light-content" />

      <View style={s.screen}>
        {/* HERO */}
        <DashHero
          animValue={headerAnim}
          user={user}
          wallets={wallets}
          onRefresh={() => void loadData("refresh")}
          onNotif={() => router.push("/(tabs)/admin/notifications")}
        />

        {/* CONTENU SCROLLABLE */}
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

// ─── Styles globaux ───────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: T.pageBg },
  screen: { flex: 1, backgroundColor: T.pageBg },
  list: { paddingHorizontal: LIST_H_PAD, paddingTop: 8 },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface,
    borderRadius: T.radius.md,
    paddingHorizontal: 13, height: 46,
    borderWidth: 1, borderColor: T.border,
    marginBottom: 14, gap: 8,
    ...T.shadow.soft,
  },
  searchInput: { flex: 1, fontSize: 13, color: T.ink },
  clearBtn: {
    width: 24, height: 24, borderRadius: 7,
    backgroundColor: "#F1F5F9",
    justifyContent: "center", alignItems: "center",
  },
  addBtn: {},
  addBtnGrad: {
    width: 30, height: 30, borderRadius: 9,
    justifyContent: "center", alignItems: "center",
  },
  empty: { alignItems: "center", paddingVertical: 44, gap: 8 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: T.blueLt,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.blueMd,
    ...T.shadow.card,
  },
  emptyTitle: { color: T.ink, fontSize: 16, fontWeight: "700" },
  emptySub: { color: T.inkMuted, fontSize: 12, textAlign: "center", lineHeight: 18, paddingHorizontal: 24 },
});