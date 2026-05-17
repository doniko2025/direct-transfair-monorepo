// apps/direct-transfair-mobile/app/(tabs)/admin/treasury.tsx
// =========================================================
// SUPER ADMIN — TRÉSORERIE GLOBALE v1.0
// ✅ Vision multi-sociétés (pas par agence)
// ✅ Snapshots quotidiens par devise
// ✅ Flux entrants/sortants globaux
// ✅ Classement sociétés par volume
// ✅ KPIs plateforme : commissions, frais, transactions
// ✅ Thème violet/bleu SuperAdmin
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Platform, ActivityIndicator,
  RefreshControl, Animated, Dimensions, FlatList,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

const { width: SW } = Dimensions.get("window");

// ─── Design Tokens ────────────────────────────────────────
const T = {
  heroA: "#5B5BD6",
  heroB: "#4545C2",
  heroC: "#3232A8",

  blue:     "#1956F0",
  blueDark: "#1240D6",
  blueLt:   "#EEF2FF",
  blueMd:   "#C7D5FF",

  pageBg:   "#F0F4FF",
  surface:  "#FFFFFF",
  border:   "#E2E8F0",
  borderLt: "#F1F5F9",
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
  teal:     "#0F766E",
  tealLt:   "#CCFBF1",

  white: "#FFFFFF",

  currencies: {
    XOF: { code: "XOF", symbol: "CFA", flag: "🌍",  color: "#D97706", colorDark: "#B45309", bg: "#FEF3C7", name: "Franc CFA"      },
    EUR: { code: "EUR", symbol: "€",   flag: "🇪🇺", color: "#1956F0", colorDark: "#1240D6", bg: "#EEF2FF", name: "Euro"           },
    USD: { code: "USD", symbol: "$",   flag: "🇺🇸", color: "#16A34A", colorDark: "#15803D", bg: "#DCFCE7", name: "Dollar US"      },
    GNF: { code: "GNF", symbol: "FG",  flag: "🇬🇳", color: "#DC2626", colorDark: "#B91C1C", bg: "#FEE2E2", name: "Franc Guinéen"  },
    GBP: { code: "GBP", symbol: "£",   flag: "🇬🇧", color: "#7C3AED", colorDark: "#6D28D9", bg: "#EDE9FE", name: "Livre Sterling" },
  },

  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 },

  font: {
    display:  Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:     Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    subtitle: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light",     default: "Trebuchet MS" }),
    mono:     Platform.select({ ios: "Trebuchet MS", android: "monospace",             default: "Trebuchet MS" }),
  },

  shadow: {
    hero: {
      shadowColor: "#2E2E9A",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 22,
      elevation: 18,
    },
    card: {
      shadowColor: "#1240D6",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 12,
      elevation: 6,
    },
    soft: {
      shadowColor: "#1240D6",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 3,
    },
  },
};

const CURRENCIES_ORDER = ["XOF", "EUR", "USD", "GNF", "GBP"] as const;
const CARD_W = SW - 48;
const HERO_BR = 28;

// ─── Helpers ──────────────────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(n);
  } catch { return n.toFixed(d); }
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}Md`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}k`;
  return n.toFixed(0);
}

// ─── Hero ─────────────────────────────────────────────────
function TreasuryHero({
  anim, userName, onBack, onRefresh,
}: {
  anim: Animated.Value;
  userName?: string;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const sbH = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
  return (
    <Animated.View style={[
      hS.outer,
      {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
      },
    ]}>
      <LinearGradient
        colors={[T.heroA, T.heroB, T.heroC]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={[hS.gradient, { paddingTop: sbH + 10, paddingBottom: 22 }]}
      >
        <View style={hS.deco1} />
        <View style={hS.deco2} />
        <View style={hS.row}>
          <TouchableOpacity style={hS.backBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={18} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={hS.badge}>
              <View style={hS.badgeDot} />
              <Text style={[hS.badgeTxt, { fontFamily: T.font.sans }]}>SUPER ADMIN</Text>
            </View>
            <Text style={[hS.title, { fontFamily: T.font.display }]}>Trésorerie Globale</Text>
            <Text style={[hS.sub, { fontFamily: T.font.subtitle }]}>
              {userName ? `${userName}  ·  ` : ""}Vue multi-sociétés
            </Text>
          </View>
          <TouchableOpacity style={hS.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={17} color={T.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
      <View style={hS.cornerL} />
      <View style={hS.cornerR} />
    </Animated.View>
  );
}

const hS = StyleSheet.create({
  outer: { zIndex: 10, ...T.shadow.hero },
  gradient: {
    borderBottomLeftRadius: HERO_BR,
    borderBottomRightRadius: HERO_BR,
    overflow: "hidden",
  },
  deco1: {
    position: "absolute", width: 180, height: 180, borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.06)", top: -55, right: -35,
  },
  deco2: {
    position: "absolute", width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.04)", bottom: 10, left: 10,
  },
  row: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 20, gap: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.20)",
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: "flex-start", marginBottom: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  badgeDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: "#4ADE80" },
  badgeTxt: { color: "rgba(255,255,255,0.92)", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: T.white, fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  sub:   { color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 1 },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.20)",
    justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  cornerL: {
    position: "absolute", bottom: 0, left: 0,
    width: HERO_BR, height: HERO_BR,
    backgroundColor: T.pageBg, borderTopRightRadius: HERO_BR,
  },
  cornerR: {
    position: "absolute", bottom: 0, right: 0,
    width: HERO_BR, height: HERO_BR,
    backgroundColor: T.pageBg, borderTopLeftRadius: HERO_BR,
  },
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
  row:   { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
  dot:   { width: 6, height: 6, borderRadius: 99 },
  label: { flex: 1, fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.6 },
});

// ─── Carte devise horizontale (carousel) ──────────────────
// Différente de l'admin société : affiche volume global plateforme
// = somme de tous les wallets de toutes les sociétés
function GlobalCurrencyCard({
  currency, totalBalance, totalReserved, totalSent, totalReceived, txCount,
}: {
  currency: keyof typeof T.currencies;
  totalBalance: number;
  totalReserved: number;
  totalSent: number;
  totalReceived: number;
  txCount: number;
}) {
  const cfg       = T.currencies[currency];
  const available = totalBalance - totalReserved;
  const pct       = totalBalance > 0 ? Math.min((available / totalBalance) * 100, 100) : 0;

  return (
    <LinearGradient
      colors={["#FFFFFF", "#F8FAFF"]}
      style={[gccS.card, { width: CARD_W, borderTopColor: cfg.color }]}
    >
      <View style={[gccS.topBar, { backgroundColor: cfg.color }]} />

      {/* En-tête devise */}
      <View style={gccS.topRow}>
        <View style={[gccS.flagBox, { backgroundColor: cfg.bg, borderColor: `${cfg.color}30` }]}>
          <Text style={{ fontSize: 22 }}>{cfg.flag}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[gccS.code, { color: cfg.color, fontFamily: T.font.mono }]}>{cfg.code}</Text>
          <Text style={[gccS.curName, { fontFamily: T.font.subtitle }]}>{cfg.name}</Text>
        </View>
        <View style={[gccS.txPill, { backgroundColor: cfg.bg }]}>
          <Ionicons name="swap-horizontal-outline" size={11} color={cfg.color} />
          <Text style={[gccS.txCount, { color: cfg.color, fontFamily: T.font.mono }]}>
            {txCount} tx
          </Text>
        </View>
      </View>

      {/* Solde global plateforme */}
      <Text style={[gccS.label, { fontFamily: T.font.sans }]}>SOLDE GLOBAL PLATEFORME</Text>
      <Text
        style={[gccS.amount, { color: T.ink, fontFamily: T.font.display }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {fmt(totalBalance, cfg.code)}
      </Text>
      <Text style={[gccS.symbol, { color: cfg.color, fontFamily: T.font.sans }]}>
        {cfg.symbol} · {cfg.code}
      </Text>

      {/* Barre disponible/réservé */}
      <View style={gccS.divider} />
      <View style={gccS.progRow}>
        <Text style={[gccS.progLabel, { fontFamily: T.font.subtitle }]}>Disponible</Text>
        <Text style={[gccS.progVal, { color: cfg.color, fontFamily: T.font.mono }]}>
          {fmt(available, cfg.code)} {cfg.symbol}
        </Text>
      </View>
      <View style={gccS.progBg}>
        <View style={[gccS.progFill, { width: `${pct}%` as any, backgroundColor: cfg.color }]} />
      </View>
      <View style={gccS.progRow}>
        <Text style={[gccS.progLabel, { fontFamily: T.font.subtitle }]}>Réservé</Text>
        <Text style={[gccS.progVal, { color: T.inkMuted, fontFamily: T.font.mono }]}>
          {fmt(totalReserved, cfg.code)} {cfg.symbol}
        </Text>
      </View>

      {/* Flux entrants / sortants */}
      <View style={gccS.divider} />
      <View style={gccS.flowRow}>
        <View style={[gccS.flowBox, { backgroundColor: T.greenLt }]}>
          <Ionicons name="arrow-down-circle-outline" size={13} color={T.green} />
          <View>
            <Text style={[gccS.flowLabel, { fontFamily: T.font.sans }]}>Reçus (j)</Text>
            <Text style={[gccS.flowVal, { color: T.green, fontFamily: T.font.mono }]}>
              +{fmtCompact(totalReceived)}
            </Text>
          </View>
        </View>
        <View style={[gccS.flowBox, { backgroundColor: T.redLt }]}>
          <Ionicons name="arrow-up-circle-outline" size={13} color={T.red} />
          <View>
            <Text style={[gccS.flowLabel, { fontFamily: T.font.sans }]}>Envoyés (j)</Text>
            <Text style={[gccS.flowVal, { color: T.red, fontFamily: T.font.mono }]}>
              -{fmtCompact(totalSent)}
            </Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const gccS = StyleSheet.create({
  card: {
    borderRadius: T.radius.xl, marginRight: 16,
    borderWidth: 1, borderTopWidth: 4, borderColor: T.border,
    overflow: "hidden",
    shadowColor: "#1956F0", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
  },
  topBar:  { position: "absolute", top: 0, left: 0, right: 0, height: 50, opacity: 0.05 },
  topRow:  { flexDirection: "row", alignItems: "center", padding: 18, paddingBottom: 0, gap: 12 },
  flagBox: { width: 46, height: 46, borderRadius: 13, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  code:    { fontSize: 12, fontWeight: "900", letterSpacing: 2, marginBottom: 2 },
  curName: { fontSize: 11, color: T.inkMuted },
  txPill:  { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  txCount: { fontSize: 10, fontWeight: "800" },
  label:   { marginHorizontal: 18, marginTop: 16, fontSize: 9, fontWeight: "800", color: T.inkMuted, letterSpacing: 1.6, marginBottom: 4 },
  amount:  { marginHorizontal: 18, fontSize: 34, fontWeight: "700", letterSpacing: -0.5, marginBottom: 3, color: T.ink },
  symbol:  { marginHorizontal: 18, fontSize: 12, fontWeight: "700", letterSpacing: 0.3, marginBottom: 16 },
  divider: { height: 1, backgroundColor: T.border, marginHorizontal: 18, marginBottom: 12 },
  progRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, marginBottom: 4 },
  progLabel: { color: T.inkMuted, fontSize: 10 },
  progVal:   { fontSize: 10, fontWeight: "800" },
  progBg: {
    height: 5, backgroundColor: "#EEF2F8",
    marginHorizontal: 18, borderRadius: 99, overflow: "hidden",
    marginBottom: 10, marginTop: 2,
  },
  progFill: { height: 5, borderRadius: 99 },
  flowRow:  { flexDirection: "row", gap: 10, marginHorizontal: 18, marginBottom: 18 },
  flowBox:  { flex: 1, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9 },
  flowLabel:{ fontSize: 9, color: T.inkSub, fontWeight: "700", marginBottom: 2 },
  flowVal:  { fontSize: 12, fontWeight: "800" },
});

// ─── Dots pagination carousel ─────────────────────────────
function CurrencyDots({ active }: { active: number }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 12, marginBottom: 22 }}>
      {CURRENCIES_ORDER.map((cur, i) => {
        const cfg = T.currencies[cur];
        const isActive = i === active;
        return (
          <View
            key={cur}
            style={{
              width: isActive ? 20 : 5, height: 5,
              borderRadius: 99,
              backgroundColor: isActive ? cfg.color : T.borderMd,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── KPI Quad ─────────────────────────────────────────────
function KpiQuad({ kpis }: {
  kpis: { label: string; value: string; sub?: string; icon: string; color: string; bg: string }[];
}) {
  return (
    <View style={kqS.grid}>
      {kpis.map((k, i) => (
        <View key={i} style={[kqS.card, { borderTopColor: k.color }]}>
          <View style={[kqS.iconBox, { backgroundColor: k.bg }]}>
            <Ionicons name={k.icon as any} size={16} color={k.color} />
          </View>
          <Text style={[kqS.val, { color: k.color, fontFamily: T.font.mono }]}>{k.value}</Text>
          <Text style={[kqS.label, { fontFamily: T.font.sans }]}>{k.label}</Text>
          {k.sub && <Text style={[kqS.sub, { fontFamily: T.font.subtitle }]}>{k.sub}</Text>}
        </View>
      ))}
    </View>
  );
}
const kqS = StyleSheet.create({
  grid:    { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 22 },
  card: {
    width: (SW - 36 - 10) / 2,
    backgroundColor: T.surface, borderRadius: T.radius.md,
    padding: 14, borderTopWidth: 3, borderWidth: 1, borderColor: T.border,
    ...T.shadow.soft,
  },
  iconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  val:     { fontSize: 20, fontWeight: "800", marginBottom: 2 },
  label:   { fontSize: 9, fontWeight: "800", color: T.inkMuted, letterSpacing: 0.8 },
  sub:     { fontSize: 9, color: T.inkSub, marginTop: 3 },
});

// ─── Société Rank Card ────────────────────────────────────
function ClientRankCard({
  item, rank,
}: {
  item: any;
  rank: number;
}) {
  const rankColors = ["#D97706", "#64748B", "#B45309"];
  const rankColor  = rankColors[rank - 1] ?? T.inkMuted;
  const statusColor =
    item.subscriptionStatus?.toUpperCase() === "ACTIVE" ? T.green :
    item.subscriptionStatus?.toUpperCase() === "TRIAL"  ? T.purple : T.red;

  const txCount   = toNum(item._count?.transactions ?? item.transactionCount ?? 0);
  const txVolume  = toNum(item.totalVolume ?? 0);
  const currency  = item.defaultCurrency ?? "XOF";
  const cfg       = T.currencies[currency as keyof typeof T.currencies] ?? T.currencies.XOF;

  return (
    <View style={rcS.card}>
      {/* Rang */}
      <View style={[rcS.rankBox, { backgroundColor: rankColor + "18", borderColor: rankColor + "30" }]}>
        <Text style={[rcS.rankTxt, { color: rankColor, fontFamily: T.font.mono }]}>#{rank}</Text>
      </View>

      {/* Avatar + infos */}
      <View style={[rcS.avatar, { backgroundColor: T.blueLt }]}>
        <Text style={[rcS.avatarLetter, { fontFamily: T.font.display }]}>
          {(item.name?.[0] ?? "C").toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[rcS.name, { fontFamily: T.font.sans }]} numberOfLines={1}>{item.name}</Text>
        <View style={rcS.metaRow}>
          <Text style={[rcS.code, { fontFamily: T.font.mono }]}>{item.code}</Text>
          <View style={[rcS.statusDot, { backgroundColor: statusColor }]} />
        </View>
      </View>

      {/* Volume + tx */}
      <View style={{ alignItems: "flex-end" }}>
        {txVolume > 0 && (
          <Text style={[rcS.volume, { color: cfg.color, fontFamily: T.font.mono }]}>
            {fmtCompact(txVolume)}
          </Text>
        )}
        <Text style={[rcS.txCount, { fontFamily: T.font.sans }]}>{txCount} tx</Text>
      </View>
    </View>
  );
}
const rcS = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface, borderRadius: T.radius.md,
    padding: 12, marginBottom: 8, gap: 10,
    borderWidth: 1, borderColor: T.border, ...T.shadow.soft,
  },
  rankBox: { width: 32, height: 32, borderRadius: 9, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  rankTxt: { fontSize: 11, fontWeight: "900" },
  avatar:  { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: T.blueMd },
  avatarLetter: { fontSize: 16, fontWeight: "700", color: T.blue },
  name:    { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  code:    { fontSize: 9, fontWeight: "900", color: T.amber, letterSpacing: 0.8 },
  statusDot: { width: 6, height: 6, borderRadius: 99 },
  volume:  { fontSize: 13, fontWeight: "800", marginBottom: 2 },
  txCount: { fontSize: 9, color: T.inkSub, fontWeight: "700" },
});

// ─── Commission Row ───────────────────────────────────────
function CommissionRow({ label, value, currency, color }: {
  label: string; value: number; currency: string; color: string;
}) {
  return (
    <View style={comS.row}>
      <View style={[comS.dot, { backgroundColor: color }]} />
      <Text style={[comS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <Text style={[comS.value, { color, fontFamily: T.font.mono }]}>
        {fmt(value, currency)} {currency === "XOF" ? "CFA" : currency}
      </Text>
    </View>
  );
}
const comS = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.borderLt },
  dot:   { width: 8, height: 8, borderRadius: 99 },
  label: { flex: 1, fontSize: 12, color: T.inkMid, fontWeight: "600" },
  value: { fontSize: 13, fontWeight: "800" },
});

// ─── Accès rapide ─────────────────────────────────────────
function QuickBtn({ icon, label, color, bg, onPress }: {
  icon: string; label: string; color: string; bg: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[qbS.btn, { backgroundColor: bg, borderColor: color + "25" }]} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={[qbS.label, { color, fontFamily: T.font.sans }]}>{label}</Text>
    </TouchableOpacity>
  );
}
const qbS = StyleSheet.create({
  btn:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 14, borderRadius: T.radius.md, borderWidth: 1 },
  label: { fontSize: 11, fontWeight: "800" },
});

// ─── Main Screen ──────────────────────────────────────────
export default function SuperAdminTreasuryScreen() {
  const router   = useRouter();
  const { user } = useAuth();

  // ── État ──────────────────────────────────────────────
  const [wallets,      setWallets]      = useState<any[]>([]);
  const [snapshots,    setSnapshots]    = useState<any[]>([]);
  const [clients,      setClients]      = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [activeCard,   setActiveCard]   = useState(0);

  const heroAnim    = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const carouselRef = useRef<FlatList>(null);

  const runEntrance = useCallback(() => {
    Animated.stagger(100, [
      Animated.spring(heroAnim,    { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }),
      Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 2 }),
    ]).start();
  }, []);

  const loadData = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    try {
      const [rawWallets, rawSnapshots, rawClients, rawTx] = await Promise.all([
        // Wallets du super admin (réutilise getMyWallets qui existe dans l'API)
        api.getMyWallets?.().catch(() => []) ?? Promise.resolve([]),
        // Snapshots trésorerie journaliers (optionnel — graceful fallback)
        api.getTreasurySnapshots?.().catch(() => []) ?? Promise.resolve([]),
        // Liste des sociétés avec leurs volumes
        api.getClients().catch(() => []),
        // Transactions récentes pour calcul des flux
        api.adminGetTransactions().catch(() => []),
      ]);

      setWallets(Array.isArray(rawWallets) ? rawWallets : []);
      setSnapshots(Array.isArray(rawSnapshots) ? rawSnapshots : (rawSnapshots as any)?.data ?? []);

      const cls = Array.isArray(rawClients) ? rawClients : (rawClients as any)?.data ?? [];
      setClients(cls);

      const txList = Array.isArray(rawTx) ? rawTx : [];
      setTransactions(txList);

    } catch (e) {
      console.error("SuperAdmin Treasury load error", e);
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

  // ── Calculs globaux plateforme ─────────────────────────

  // Solde global par devise (agrégation de tous les wallets)
  const globalByCurrency = CURRENCIES_ORDER.map((cur) => {
    const curWallets   = wallets.filter((w) => w.currency === cur);
    const totalBalance  = curWallets.reduce((s, w) => s + toNum(w.balance), 0);
    const totalReserved = curWallets.reduce((s, w) => s + toNum(w.reservedBalance), 0);

    // Flux du jour depuis les snapshots
    const snap        = snapshots.find((s) => s.currency === cur && !s.clientId);
    const totalSent   = toNum(snap?.totalSent ?? 0);
    const totalRecv   = toNum(snap?.totalReceived ?? 0);
    const txCount     = toNum(snap?.transactionCount ?? 0);

    return { currency: cur, totalBalance, totalReserved, totalSent, totalReceived: totalRecv, txCount };
  });

  // KPIs globaux
  const totalTx         = transactions.length;
  const pendingTx       = transactions.filter((t) => t.status === "PENDING").length;
  const totalClients    = clients.length;
  const activeClients   = clients.filter((c) => c.subscriptionStatus?.toUpperCase() === "ACTIVE").length;

  // Commissions plateforme (somme sur toutes les transactions)
  const platformCommission = transactions.reduce((s, t) => s + toNum(t.platformCommission), 0);
  const totalFees          = transactions.reduce((s, t) => s + toNum(t.fees), 0);

  // Volume total du jour (devise principale XOF)
  const todaySnap  = snapshots.find((s) => s.currency === "XOF" && !s.clientId);
  const todayVolume = toNum(todaySnap?.totalSent ?? 0) + toNum(todaySnap?.totalReceived ?? 0);

  const kpis = [
    {
      label:  "Transactions",
      value:  String(totalTx),
      sub:    `${pendingTx} en attente`,
      icon:   "swap-horizontal-outline",
      color:  T.blue,
      bg:     T.blueLt,
    },
    {
      label:  "Sociétés actives",
      value:  `${activeClients}/${totalClients}`,
      sub:    "abonnements actifs",
      icon:   "business-outline",
      color:  T.green,
      bg:     T.greenLt,
    },
    {
      label:  "Commissions",
      value:  fmtCompact(platformCommission),
      sub:    "total plateforme",
      icon:   "trending-up-outline",
      color:  T.amber,
      bg:     T.amberLt,
    },
    {
      label:  "Frais totaux",
      value:  fmtCompact(totalFees),
      sub:    "toutes devises",
      icon:   "calculator-outline",
      color:  T.purple,
      bg:     T.purpleLt,
    },
  ];

  // Top 5 sociétés par nombre de transactions
  const topClients = [...clients]
    .sort((a, b) =>
      toNum(b._count?.transactions ?? b.transactionCount ?? 0) -
      toNum(a._count?.transactions ?? a.transactionCount ?? 0)
    )
    .slice(0, 5);

  // Commissions par devise principale
  const commissionsByCur = CURRENCIES_ORDER.map((cur) => {
    const total = transactions
      .filter((t) => t.currency === cur)
      .reduce((s, t) => s + toNum(t.platformCommission), 0);
    return { currency: cur, total };
  }).filter((c) => c.total > 0);

  const T_borderMd = "#D1D9E6";

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={T.heroC} barStyle="light-content" />

      <TreasuryHero
        anim={heroAnim}
        userName={user?.firstName}
        onBack={() => router.back()}
        onRefresh={() => void loadData("refresh")}
      />

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={T.blue} size="large" />
        </View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: contentAnim }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadData("refresh")}
              tintColor={T.blue}
            />
          }
        >
          {/* ── Carousel soldes par devise ── */}
          <SH dot={T.blue} label="SOLDES GLOBAUX · 5 DEVISES" />
          <FlatList
            ref={carouselRef}
            horizontal
            data={globalByCurrency}
            keyExtractor={(item) => item.currency}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 2, paddingRight: 18 }}
            snapToInterval={CARD_W + 16}
            decelerationRate="fast"
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + 16));
              setActiveCard(idx);
            }}
            renderItem={({ item }) => (
              <GlobalCurrencyCard
                currency={item.currency as keyof typeof T.currencies}
                totalBalance={item.totalBalance}
                totalReserved={item.totalReserved}
                totalSent={item.totalSent}
                totalReceived={item.totalReceived}
                txCount={item.txCount}
              />
            )}
          />
          <CurrencyDots active={activeCard} />

          {/* ── KPIs globaux ── */}
          <SH dot={T.purple} label="KPIs PLATEFORME" />
          <KpiQuad kpis={kpis} />

          {/* ── Accès rapide ── */}
          <SH dot={T.teal} label="ACCÈS RAPIDE" />
          <View style={s.quickRow}>
            <QuickBtn
              icon="analytics-outline"
              label="Transactions"
              color={T.blue}
              bg={T.blueLt}
              onPress={() => router.push("/(tabs)/admin/transactions-history")}
            />
            <QuickBtn
              icon="shield-checkmark-outline"
              label="Supervision"
              color={T.teal}
              bg={T.tealLt}
              onPress={() => router.push("/(tabs)/admin/supervision")}
            />
          </View>
          <View style={[s.quickRow, { marginTop: 8 }]}>
            <QuickBtn
              icon="people-outline"
              label="Utilisateurs"
              color={T.purple}
              bg={T.purpleLt}
              onPress={() => router.push("/(tabs)/admin/users")}
            />
            <QuickBtn
              icon="business-outline"
              label="Sociétés"
              color={T.amber}
              bg={T.amberLt}
              onPress={() => router.push("/(tabs)/admin/clients")}
            />
          </View>

          {/* ── Top sociétés ── */}
          <View style={{ marginTop: 22 }}>
            <SH dot={T.green} label="TOP SOCIÉTÉS · VOLUME" />
            {topClients.length === 0 ? (
              <View style={s.emptyBlock}>
                <Ionicons name="business-outline" size={22} color={T.inkMuted} />
                <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucune donnée</Text>
              </View>
            ) : (
              topClients.map((c, i) => (
                <ClientRankCard key={c.id} item={c} rank={i + 1} />
              ))
            )}
          </View>

          {/* ── Commissions par devise ── */}
          {commissionsByCur.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <SH dot={T.amber} label="COMMISSIONS PLATEFORME · PAR DEVISE" />
              <View style={s.commCard}>
                {commissionsByCur.map((c) => {
                  const cfg = T.currencies[c.currency as keyof typeof T.currencies] ?? T.currencies.XOF;
                  return (
                    <CommissionRow
                      key={c.currency}
                      label={`${cfg.flag}  ${cfg.name}`}
                      value={c.total}
                      currency={c.currency}
                      color={cfg.color}
                    />
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Volume du jour ── */}
          {todayVolume > 0 && (
            <View style={{ marginTop: 14 }}>
              <SH dot={T.teal} label="VOLUME DU JOUR · XOF" />
              <View style={s.volumeCard}>
                <View style={[s.volumeIconBox, { backgroundColor: T.tealLt }]}>
                  <Ionicons name="pulse-outline" size={22} color={T.teal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.volumeVal, { fontFamily: T.font.mono, color: T.teal }]}>
                    {fmt(todayVolume, "XOF")} CFA
                  </Text>
                  <Text style={[s.volumeSub, { fontFamily: T.font.subtitle }]}>
                    Flux total entrant + sortant aujourd'hui
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: T.pageBg },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { paddingHorizontal: 18, paddingTop: 22 },

  quickRow: { flexDirection: "row", gap: 10, marginBottom: 0 },

  commCard: {
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, marginBottom: 4,
    ...T.shadow.soft,
  },

  volumeCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    borderWidth: 1, borderColor: T.border,
    padding: 16, marginBottom: 4,
    ...T.shadow.soft,
  },
  volumeIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  volumeVal:     { fontSize: 18, fontWeight: "800", marginBottom: 3 },
  volumeSub:     { fontSize: 10, color: T.inkSub },

  emptyBlock: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 16 },
  emptyTxt:   { fontSize: 12, color: T.inkMuted, fontWeight: "600" },
});