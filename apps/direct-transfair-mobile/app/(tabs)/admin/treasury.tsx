// apps/direct-transfair-mobile/app/(tabs)/admin/treasury.tsx
// =========================================================
// TRÉSORERIE — ROUTEUR PAR RÔLE v2.0
// ✅ SUPER_ADMIN   → TreasurySuperAdmin  (vue globale plateforme)
// ✅ COMPANY_ADMIN → TreasuryCompanyAdmin (vue société uniquement)
// ✅ Rôles strictement séparés — zéro mélange
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Platform, ActivityIndicator,
  RefreshControl, Animated, Dimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

const { width: SW } = Dimensions.get("window");

// ─── Tokens partagés ─────────────────────────────────────
const T = {
  // Super-Admin : violet/bleu
  saHeroA: "#5B5BD6", saHeroB: "#4545C2", saHeroC: "#3232A8",
  saAccent: "#1956F0", saAccentLt: "#EEF2FF", saAccentMd: "#C7D5FF",

  // Company-Admin : bleu ciel
  caHeroA: "#38BDF8", caHeroB: "#0EA5E9", caHeroC: "#0284C7",
  caAccent: "#0284C7", caAccentLt: "#E0F2FE", caAccentMd: "#7DD3FC",

  pageBg:   "#F0F4FF",
  caBg:     "#F2F4F8",
  surface:  "#FFFFFF",
  border:   "#E2E8F0",
  borderLt: "#F1F5F9",
  borderMd: "#D1D9E6",

  ink:      "#0F172A",
  inkSub:   "#6B7280",
  inkMuted: "#9CA3AF",

  green:    "#16A34A", greenLt:  "#DCFCE7", greenMd: "#A7F3D0",
  red:      "#DC2626", redLt:    "#FEE2E2",
  amber:    "#D97706", amberLt:  "#FEF3C7",
  teal:     "#0F766E", tealLt:   "#CCFBF1", tealMd: "#5EEAD4",
  purple:   "#7C3AED", purpleLt: "#EDE9FE", purpleMd: "#C4B5FD",
  white:    "#FFFFFF",

  currencies: {
    XOF: { code: "XOF", symbol: "CFA", flag: "🌍",  color: "#D97706", bg: "#FEF3C7", name: "Franc CFA"     },
    EUR: { code: "EUR", symbol: "€",   flag: "🇪🇺", color: "#1956F0", bg: "#EEF2FF", name: "Euro"          },
    USD: { code: "USD", symbol: "$",   flag: "🇺🇸", color: "#16A34A", bg: "#DCFCE7", name: "Dollar US"     },
    GNF: { code: "GNF", symbol: "FG",  flag: "🇬🇳", color: "#DC2626", bg: "#FEE2E2", name: "Franc Guinéen" },
    GBP: { code: "GBP", symbol: "£",   flag: "🇬🇧", color: "#7C3AED", bg: "#EDE9FE", name: "Livre Sterling"},
  },

  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 },

  font: {
    display: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:    Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sub:     Platform.select({ ios: "Trebuchet MS", android: "sans-serif-light",     default: "Trebuchet MS" }),
    mono:    Platform.select({ ios: "Trebuchet MS", android: "monospace",             default: "monospace"   }),
  },

  shadow: {
    hero: { shadowColor: "#2E2E9A", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 16 },
    card: { shadowColor: "#1240D6", shadowOffset: { width: 0, height: 4  }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5  },
    soft: { shadowColor: "#64748B", shadowOffset: { width: 0, height: 2  }, shadowOpacity: 0.06, shadowRadius: 8,  elevation: 3  },
  },
};

const CURRENCIES_ORDER = ["XOF", "EUR", "USD", "GNF", "GBP"] as const;
// ✅ 2 cartes côte à côte — chacune prend environ la moitié de l'écran
const CARD_W = (SW - 48 - 10) / 2;
const HERO_BR = 28;

// ─── Helpers ─────────────────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}
function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}
function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}Md`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}k`;
  return n.toFixed(0);
}

// ─── Section Label ────────────────────────────────────────
function SL({ dot, label }: { dot: string; label: string }) {
  return (
    <View style={slS.row}>
      <View style={[slS.dot, { backgroundColor: dot }]} />
      <Text style={[slS.txt, { fontFamily: T.font.sans }]}>{label}</Text>
    </View>
  );
}
const slS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
  dot: { width: 6, height: 6, borderRadius: 99 },
  txt: { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.6 },
});

// ─── Carte devise COMPACTE (2 par ligne) ─────────────────
function CurrencyCardCompact({
  currency, balance, reserved, sentToday, receivedToday,
}: {
  currency: keyof typeof T.currencies;
  balance: number; reserved: number;
  sentToday: number; receivedToday: number;
}) {
  const cfg       = T.currencies[currency];
  const available = balance - reserved;
  const pct       = balance > 0 ? Math.min((available / balance) * 100, 100) : 0;

  return (
    <View style={[ccS.card, { width: CARD_W, borderTopColor: cfg.color }]}>
      {/* Header devise */}
      <View style={ccS.top}>
        <View style={[ccS.flagBox, { backgroundColor: cfg.bg }]}>
          <Text style={{ fontSize: 16 }}>{cfg.flag}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ccS.code, { color: cfg.color, fontFamily: T.font.mono }]}>{cfg.code}</Text>
          <Text style={[ccS.name, { fontFamily: T.font.sub }]} numberOfLines={1}>{cfg.name}</Text>
        </View>
      </View>

      {/* Solde */}
      <Text style={[ccS.balLabel, { fontFamily: T.font.sans }]}>SOLDE</Text>
      <Text
        style={[ccS.balance, { color: T.ink, fontFamily: T.font.display }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
      >
        {fmtCompact(balance)}
      </Text>
      <Text style={[ccS.symbol, { color: cfg.color, fontFamily: T.font.mono }]}>{cfg.symbol}</Text>

      {/* Barre dispo */}
      <View style={ccS.progBg}>
        <View style={[ccS.progFill, { width: `${pct}%` as any, backgroundColor: cfg.color }]} />
      </View>
      <View style={ccS.progRow}>
        <Text style={[ccS.progLbl, { fontFamily: T.font.sub }]}>Dispo</Text>
        <Text style={[ccS.progVal, { color: cfg.color, fontFamily: T.font.mono }]}>
          {fmtCompact(available)}
        </Text>
      </View>

      {/* Flux du jour */}
      <View style={ccS.flowRow}>
        <View style={ccS.flowItem}>
          <Ionicons name="arrow-down-outline" size={9} color={T.green} />
          <Text style={[ccS.flowTxt, { color: T.green, fontFamily: T.font.mono }]}>
            +{fmtCompact(receivedToday)}
          </Text>
        </View>
        <View style={ccS.flowItem}>
          <Ionicons name="arrow-up-outline" size={9} color={T.red} />
          <Text style={[ccS.flowTxt, { color: T.red, fontFamily: T.font.mono }]}>
            -{fmtCompact(sentToday)}
          </Text>
        </View>
      </View>
    </View>
  );
}
const ccS = StyleSheet.create({
  card: {
    backgroundColor: T.surface, borderRadius: T.radius.lg,
    borderWidth: 1, borderTopWidth: 3, borderColor: T.border,
    padding: 11, ...T.shadow.soft,
  },
  top:      { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
  flagBox:  { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  code:     { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  name:     { fontSize: 8,  color: T.inkMuted },
  balLabel: { fontSize: 7, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.2, marginBottom: 2 },
  balance:  { fontSize: 22, fontWeight: "800", letterSpacing: -0.5, marginBottom: 1 },
  symbol:   { fontSize: 9,  fontWeight: "800", marginBottom: 8 },
  progBg:   { height: 3, backgroundColor: T.borderLt, borderRadius: 99, overflow: "hidden", marginBottom: 5 },
  progFill: { height: 3, borderRadius: 99 },
  progRow:  { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progLbl:  { fontSize: 8, color: T.inkMuted },
  progVal:  { fontSize: 8, fontWeight: "800" },
  flowRow:  { flexDirection: "row", gap: 8 },
  flowItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: T.borderLt, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 3 },
  flowTxt:  { fontSize: 9, fontWeight: "800" },
});

// ─── KPI Card (grille 2×2) ────────────────────────────────
function KpiCard({ label, value, sub, icon, color, bg }: {
  label: string; value: string; sub?: string;
  icon: string; color: string; bg: string;
}) {
  return (
    <View style={[kpiS.card, { borderTopColor: color, width: (SW - 36 - 10) / 2 }]}>
      <View style={[kpiS.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={[kpiS.val, { color, fontFamily: T.font.mono }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[kpiS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      {sub && <Text style={[kpiS.sub, { fontFamily: T.font.sub }]}>{sub}</Text>}
    </View>
  );
}
const kpiS = StyleSheet.create({
  card: {
    backgroundColor: T.surface, borderRadius: T.radius.md,
    padding: 14, borderTopWidth: 3, borderWidth: 1, borderColor: T.border,
    ...T.shadow.soft,
  },
  iconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  val:     { fontSize: 20, fontWeight: "800", marginBottom: 2 },
  label:   { fontSize: 9, fontWeight: "800", color: T.inkMuted, letterSpacing: 0.8 },
  sub:     { fontSize: 9, color: T.inkSub, marginTop: 3 },
});

// ─── Hero générique ───────────────────────────────────────
function TreasuryHero({
  g1, g2, g3, role, userName, onBack, onRefresh,
}: {
  g1: string; g2: string; g3: string;
  role: string; userName?: string;
  onBack: () => void; onRefresh: () => void;
}) {
  const sbH = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
  return (
    <View style={hS.outer}>
      <LinearGradient
        colors={[g1, g2, g3]}
        start={{ x: 0.05, y: 0 }} end={{ x: 0.95, y: 1 }}
        style={[hS.gradient, { paddingTop: sbH + 10, paddingBottom: 22 }]}
      >
        <View style={hS.deco1} /><View style={hS.deco2} />
        <View style={hS.row}>
          <TouchableOpacity style={hS.backBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={18} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={hS.badge}>
              <View style={hS.badgeDot} />
              <Text style={[hS.badgeTxt, { fontFamily: T.font.sans }]}>{role}</Text>
            </View>
            <Text style={[hS.title, { fontFamily: T.font.display }]}>
              {role === "SUPER ADMIN" ? "Trésorerie Globale" : "Ma Trésorerie"}
            </Text>
            <Text style={[hS.sub, { fontFamily: T.font.sub }]}>
              {userName ? `${userName}  ·  ` : ""}
              {role === "SUPER ADMIN" ? "Vue multi-sociétés" : "Vue de votre société"}
            </Text>
          </View>
          <TouchableOpacity style={hS.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={17} color={T.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
      <View style={[hS.cornerL, { backgroundColor: role === "SUPER ADMIN" ? T.pageBg : T.caBg }]} />
      <View style={[hS.cornerR, { backgroundColor: role === "SUPER ADMIN" ? T.pageBg : T.caBg }]} />
    </View>
  );
}
const hS = StyleSheet.create({
  outer: { zIndex: 10, ...T.shadow.hero },
  gradient: { borderBottomLeftRadius: HERO_BR, borderBottomRightRadius: HERO_BR, overflow: "hidden" },
  deco1: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.06)", top: -55, right: -35 },
  deco2: { position: "absolute", width: 80,  height: 80,  borderRadius: 40, backgroundColor: "rgba(255,255,255,0.04)", bottom: 10, left: 10 },
  row:   { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 20, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.13)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  badge:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  badgeDot:{ width: 5, height: 5, borderRadius: 99, backgroundColor: "#4ADE80" },
  badgeTxt:{ color: "rgba(255,255,255,0.92)", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  title:   { color: T.white, fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  sub:     { color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 1 },
  refreshBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.13)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  cornerL: { position: "absolute", bottom: 0, left:  0, width: HERO_BR, height: HERO_BR, borderTopRightRadius: HERO_BR },
  cornerR: { position: "absolute", bottom: 0, right: 0, width: HERO_BR, height: HERO_BR, borderTopLeftRadius: HERO_BR  },
});

// ══════════════════════════════════════════════════════════
//  SUPER-ADMIN — VUE GLOBALE PLATEFORME
//  Voit : soldes agrégés de TOUTES les sociétés
//  Peut : snapshots, classement sociétés, KPIs globaux
// ══════════════════════════════════════════════════════════
function TreasurySuperAdmin() {
  const router   = useRouter();
  const { user } = useAuth();

  const [overview,   setOverview]   = useState<any[]>([]);
  const [clients,    setClients]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true); else setLoading(true);
    try {
      const ov = await (api as any).getTreasuryOverview?.() ?? [];
      setOverview(Array.isArray(ov) ? ov : []);

      // Classement sociétés (optionnel)
      try {
        const cl = await (api as any).getClients?.() ?? [];
        setClients(Array.isArray(cl) ? cl : []);
      } catch { setClients([]); }

      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { setOverview([]); }
    finally { if (mode === "refresh") setRefreshing(false); else setLoading(false); }
  }, [fadeAnim]);

  useFocusEffect(useCallback(() => { fadeAnim.setValue(0); void load("init"); }, [load]));

  // KPIs globaux calculés depuis l'overview
  const totalTx   = overview.reduce((s, o) => s + toNum(o.transactionCountToday), 0);
  const totalFees = overview.reduce((s, o) => s + toNum(o.totalFeesToday), 0);
  const totalSent = overview.reduce((s, o) => s + toNum(o.totalSentToday), 0);
  const activeClients = clients.filter((c) => c.subscriptionStatus === "ACTIVE").length;

  const kpis = [
    { label: "Transactions",      value: String(totalTx),                    sub: "Aujourd'hui",        icon: "swap-horizontal-outline", color: T.saAccent,  bg: T.saAccentLt  },
    { label: "Sociétés actives",  value: `${activeClients}/${clients.length}`,sub: "abonnements actifs", icon: "business-outline",        color: T.green,     bg: T.greenLt     },
    { label: "Commissions",       value: fmtCompact(totalFees * 0.3),         sub: "total plateforme",   icon: "trending-up-outline",     color: T.amber,     bg: T.amberLt     },
    { label: "Frais totaux",      value: fmtCompact(totalFees),               sub: "toutes devises",     icon: "calculator-outline",      color: T.purple,    bg: T.purpleLt    },
  ];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.pageBg }]}>
      <StatusBar barStyle="light-content" />
      <TreasuryHero
        g1={T.saHeroA} g2={T.saHeroB} g3={T.saHeroC}
        role="SUPER ADMIN"
        userName={user?.firstName ?? ""}
        onBack={() => router.back()}
        onRefresh={() => void load("refresh")}
      />

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={T.saAccent} size="large" /></View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={[s.scroll, { backgroundColor: T.pageBg }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} tintColor={T.saAccent} />}
        >
          {/* ── Soldes globaux 5 devises — 2 cartes côte à côte ── */}
          <SL dot={T.saAccent} label="SOLDES GLOBAUX · 5 DEVISES" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.currencyRow}
            snapToInterval={CARD_W + 10}
            decelerationRate="fast"
          >
            {CURRENCIES_ORDER.map((cur) => {
              const ov = overview.find((o) => o.currency === cur);
              return (
                <CurrencyCardCompact
                  key={cur}
                  currency={cur}
                  balance={toNum(ov?.balance ?? ov?.totalBalance ?? 0)}
                  reserved={toNum(ov?.reservedBalance ?? 0)}
                  sentToday={toNum(ov?.totalSentToday ?? 0)}
                  receivedToday={toNum(ov?.totalReceivedToday ?? 0)}
                />
              );
            })}
          </ScrollView>

          {/* ── KPIs Plateforme — grille 2×2 ── */}
          <SL dot={T.purple} label="KPIs PLATEFORME" />
          <View style={s.kpiGrid}>
            {kpis.map((k, i) => (
              <KpiCard key={i} {...k} />
            ))}
          </View>

          {/* ── Accès rapide Super-Admin ── */}
          <SL dot={T.green} label="ACCÈS RAPIDE" />
          <View style={s.quickGrid}>
            {[
              { label: "Transactions", icon: "analytics-outline",  color: T.saAccent, bg: T.saAccentLt, route: "/(tabs)/admin/transactions" },
              { label: "Supervision",  icon: "shield-outline",     color: T.green,    bg: T.greenLt,    route: "/(tabs)/admin/agencies"     },
              { label: "Utilisateurs", icon: "people-outline",     color: T.purple,   bg: T.purpleLt,   route: "/(tabs)/admin/agencies"     },
              { label: "Sociétés",     icon: "business-outline",   color: T.amber,    bg: T.amberLt,    route: "/(tabs)/admin/agencies"     },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[s.quickCard, { backgroundColor: item.bg, borderColor: `${item.color}30` }]}
                onPress={() => router.push(item.route as any)}
              >
                <Ionicons name={item.icon as any} size={18} color={item.color} />
                <Text style={[s.quickTxt, { color: item.color, fontFamily: T.font.sans }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Top Sociétés ── */}
          <SL dot={T.amber} label={`TOP SOCIÉTÉS · VOLUME`} />
          {clients.length === 0 ? (
            <View style={s.emptyRow}>
              <Ionicons name="business-outline" size={22} color={T.inkMuted} />
              <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucune donnée</Text>
            </View>
          ) : (
            clients.slice(0, 5).map((c, i) => {
              const rankColors = [T.amber, T.inkMuted, "#B45309"];
              const rc = rankColors[i] ?? T.inkMuted;
              return (
                <View key={c.id} style={s.rankCard}>
                  <View style={[s.rankBox, { backgroundColor: rc + "18", borderColor: rc + "30" }]}>
                    <Text style={[s.rankTxt, { color: rc, fontFamily: T.font.mono }]}>#{i + 1}</Text>
                  </View>
                  <View style={[s.rankAvatar, { backgroundColor: T.saAccentLt }]}>
                    <Text style={[s.rankLetter, { fontFamily: T.font.display, color: T.saAccent }]}>
                      {(c.name?.[0] ?? "C").toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rankName, { fontFamily: T.font.sans }]} numberOfLines={1}>{c.name}</Text>
                    <Text style={[s.rankCode, { fontFamily: T.font.mono }]}>{c.code}</Text>
                  </View>
                  <View style={[s.rankStatus, {
                    backgroundColor: c.subscriptionStatus === "ACTIVE" ? T.greenLt : T.redLt,
                    borderColor: c.subscriptionStatus === "ACTIVE" ? T.greenMd : T.red + "35",
                  }]}>
                    <Text style={[s.rankStatusTxt, {
                      color: c.subscriptionStatus === "ACTIVE" ? T.green : T.red,
                      fontFamily: T.font.sans,
                    }]}>
                      {c.subscriptionStatus}
                    </Text>
                  </View>
                </View>
              );
            })
          )}

          <View style={{ height: 80 }} />
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════
//  COMPANY-ADMIN — VUE DE SA SOCIÉTÉ UNIQUEMENT
//  Voit : ses wallets, ses agences, ses KPIs propres
//  Peut : recharger agences, voir ses transactions
//  Ne voit PAS : les autres sociétés, les KPIs globaux
// ══════════════════════════════════════════════════════════
function TreasuryCompanyAdmin() {
  const router   = useRouter();
  const { user } = useAuth();

  const [wallets,    setWallets]    = useState<any[]>([]);
  const [agencies,   setAgencies]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true); else setLoading(true);
    try {
      // Wallets de la société
      const wRes = await api.http.get("/wallets");
      const wList = Array.isArray(wRes.data) ? wRes.data
        : Array.isArray(wRes.data?.data) ? wRes.data.data : [];
      setWallets(wList);

      // Agences de la société
      const aList = await api.getAgencies();
      setAgencies(Array.isArray(aList) ? aList : []);

      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch { setWallets([]); setAgencies([]); }
    finally { if (mode === "refresh") setRefreshing(false); else setLoading(false); }
  }, [fadeAnim]);

  useFocusEffect(useCallback(() => { fadeAnim.setValue(0); void load("init"); }, [load]));

  const activeAgencies = agencies.filter((a) => a.isActive !== false).length;
  const totalBalance   = wallets.reduce((s, w) => s + toNum(w.balance), 0);

  // KPIs propres à la société
  const kpis = [
    { label: "Agences",           value: `${activeAgencies}/${agencies.length}`, sub: "actives",         icon: "storefront-outline",      color: T.caAccent, bg: T.caAccentLt },
    { label: "Wallets actifs",    value: String(wallets.length),                 sub: "5 devises",        icon: "wallet-outline",          color: T.teal,     bg: T.tealLt    },
    { label: "Solde total",       value: fmtCompact(totalBalance),               sub: "toutes devises",   icon: "cash-outline",            color: T.green,    bg: T.greenLt   },
    { label: "Transactions",      value: "—",                                    sub: "Voir historique",  icon: "analytics-outline",       color: T.amber,    bg: T.amberLt   },
  ];

  const FLAG_MAP: Record<string, string> = { GN:"🇬🇳", SN:"🇸🇳", ML:"🇲🇱", CI:"🇨🇮", FR:"🇫🇷", GB:"🇬🇧", US:"🇺🇸", BF:"🇧🇫" };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.caBg }]}>
      <StatusBar barStyle="light-content" />
      <TreasuryHero
        g1={T.caHeroA} g2={T.caHeroB} g3={T.caHeroC}
        role="ADMIN SOCIÉTÉ"
        userName={user?.firstName ?? ""}
        onBack={() => router.back()}
        onRefresh={() => void load("refresh")}
      />

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={T.caAccent} size="large" /></View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={[s.scroll, { backgroundColor: T.caBg }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} tintColor={T.caAccent} />}
        >
          {/* ── Mes wallets — 2 cartes côte à côte ── */}
          <SL dot={T.caAccent} label="MES PORTEFEUILLES · 5 DEVISES" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.currencyRow}
            snapToInterval={CARD_W + 10}
            decelerationRate="fast"
          >
            {CURRENCIES_ORDER.map((cur) => {
              const w = wallets.find((x) => x.currency === cur);
              return (
                <CurrencyCardCompact
                  key={cur}
                  currency={cur}
                  balance={toNum(w?.balance ?? 0)}
                  reserved={toNum(w?.reservedBalance ?? 0)}
                  sentToday={0}
                  receivedToday={0}
                />
              );
            })}
          </ScrollView>

          {/* ── KPIs ma société — grille 2×2 ── */}
          <SL dot={T.teal} label="MES INDICATEURS" />
          <View style={s.kpiGrid}>
            {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
          </View>

          {/* ── Mes agences ── */}
          <SL dot={T.caAccent} label={`MES AGENCES · ${agencies.length}`} />
          {agencies.length === 0 ? (
            <View style={s.emptyRow}>
              <Ionicons name="storefront-outline" size={22} color={T.inkMuted} />
              <Text style={[s.emptyTxt, { fontFamily: T.font.sans }]}>Aucune agence</Text>
            </View>
          ) : (
            agencies.map((agency) => {
              const isActive = agency.isActive !== false;
              const currency = agency.primaryCurrency ?? "XOF";
              const balance  = toNum(agency.balance ?? 0);
              const flag     = agency.country
                ? (FLAG_MAP[agency.country.toUpperCase().substring(0, 2)] ?? "🌍")
                : "🌍";
              const cfg = T.currencies[currency as keyof typeof T.currencies] ?? T.currencies.XOF;

              return (
                <View key={agency.id} style={s.agencyCard}>
                  <View style={[s.agencyBar, { backgroundColor: isActive ? T.teal : T.red }]} />
                  <View style={s.agencyBody}>
                    <View style={s.agencyRow}>
                      <View style={s.agencyFlag}><Text style={{ fontSize: 20 }}>{flag}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.agencyName, { fontFamily: T.font.sans }]} numberOfLines={1}>{agency.name}</Text>
                        <Text style={[s.agencyCity, { fontFamily: T.font.sub }]}>
                          {agency.city ?? "—"} · {agency.country ?? "—"}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[s.agencyBal, { color: cfg.color, fontFamily: T.font.mono }]}>
                          {fmt(balance, currency)}
                        </Text>
                        <Text style={[s.agencyCur, { color: cfg.color, fontFamily: T.font.sans }]}>
                          {cfg.symbol}
                        </Text>
                      </View>
                    </View>
                    <View style={s.agencyFoot}>
                      <View style={[s.agencyStatus, {
                        backgroundColor: isActive ? T.tealLt : T.redLt,
                        borderColor: isActive ? T.tealMd : T.red + "35",
                      }]}>
                        <View style={[s.agencyDot, { backgroundColor: isActive ? T.teal : T.red }]} />
                        <Text style={[s.agencyStatusTxt, { color: isActive ? T.teal : T.red, fontFamily: T.font.sans }]}>
                          {isActive ? "Opérationnelle" : "Suspendue"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[s.agencyBtn, { backgroundColor: T.caAccentLt, borderColor: T.caAccentMd }]}
                        onPress={() => router.push({ pathname: "/(tabs)/admin/agencies/details" as any, params: { id: agency.id } })}
                      >
                        <Ionicons name="eye-outline" size={13} color={T.caAccent} />
                        <Text style={[s.agencyBtnTxt, { color: T.caAccent, fontFamily: T.font.sans }]}>Détails</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}

          {/* ── Actions rapides Admin ── */}
          <SL dot={T.green} label="ACTIONS RAPIDES" />
          <View style={s.quickGrid}>
            {[
              { label: "Transactions",  icon: "analytics-outline",   color: T.caAccent, bg: T.caAccentLt, route: "/(tabs)/admin/transactions" },
              { label: "Agences",       icon: "storefront-outline",   color: T.teal,     bg: T.tealLt,     route: "/(tabs)/admin/agencies"     },
              { label: "Paramètres",    icon: "settings-outline",     color: T.purple,   bg: T.purpleLt,   route: "/(tabs)/admin/settings"     },
              { label: "Taux & Devises",icon: "swap-horizontal-outline", color: T.amber, bg: T.amberLt,    route: "/(tabs)/rates"              },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[s.quickCard, { backgroundColor: item.bg, borderColor: `${item.color}30` }]}
                onPress={() => router.push(item.route as any)}
              >
                <Ionicons name={item.icon as any} size={18} color={item.color} />
                <Text style={[s.quickTxt, { color: item.color, fontFamily: T.font.sans }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 80 }} />
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════
//  ROUTEUR — redirige selon le rôle
// ══════════════════════════════════════════════════════════
export default function TreasuryScreen() {
  const { user } = useAuth();
  if (user?.role === "SUPER_ADMIN")   return <TreasurySuperAdmin />;
  if (user?.role === "COMPANY_ADMIN") return <TreasuryCompanyAdmin />;
  // Fallback (AGENT, USER) — accès refusé
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.caBg, justifyContent: "center", alignItems: "center" }}>
      <Ionicons name="lock-closed-outline" size={48} color={T.inkMuted} />
      <Text style={[{ color: T.ink, fontSize: 16, fontWeight: "700", marginTop: 16 }, { fontFamily: T.font.sans }]}>
        Accès non autorisé
      </Text>
      <TouchableOpacity
        style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: T.caAccentLt, borderRadius: 12 }}
        onPress={() => router.back()}
      >
        <Text style={{ color: T.caAccent, fontWeight: "700" }}>Retour</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Styles partagés ─────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 16 },

  currencyRow: { gap: 10, paddingBottom: 4, marginBottom: 20 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  quickCard: {
    width: (SW - 36 - 10) / 2,
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    borderRadius: T.radius.md, borderWidth: 1,
    ...T.shadow.soft,
  },
  quickTxt: { fontSize: 13, fontWeight: "700" },

  rankCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.surface, borderRadius: T.radius.md,
    padding: 12, marginBottom: 8, gap: 10,
    borderWidth: 1, borderColor: T.border, ...T.shadow.soft,
  },
  rankBox:    { width: 32, height: 32, borderRadius: 9, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  rankTxt:    { fontSize: 11, fontWeight: "900" },
  rankAvatar: { width: 38, height: 38, borderRadius: 11, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: T.saAccentMd },
  rankLetter: { fontSize: 16, fontWeight: "700" },
  rankName:   { fontSize: 12, fontWeight: "700", color: T.ink, marginBottom: 2 },
  rankCode:   { fontSize: 9,  fontWeight: "900", color: T.amber, letterSpacing: 0.8 },
  rankStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, borderWidth: 1 },
  rankStatusTxt: { fontSize: 9, fontWeight: "800" },

  agencyCard: { flexDirection: "row", backgroundColor: T.surface, borderRadius: T.radius.lg, marginBottom: 10, borderWidth: 1, borderColor: T.border, overflow: "hidden", ...T.shadow.soft },
  agencyBar:  { width: 4 },
  agencyBody: { flex: 1, padding: 12 },
  agencyRow:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  agencyFlag: { width: 38, height: 38, borderRadius: 10, backgroundColor: T.borderLt, justifyContent: "center", alignItems: "center" },
  agencyName: { fontSize: 13, fontWeight: "700", color: T.ink, marginBottom: 2 },
  agencyCity: { fontSize: 10, color: T.inkSub },
  agencyBal:  { fontSize: 14, fontWeight: "800" },
  agencyCur:  { fontSize: 8,  fontWeight: "700", marginTop: 1 },
  agencyFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  agencyStatus: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  agencyDot:  { width: 5, height: 5, borderRadius: 99 },
  agencyStatusTxt: { fontSize: 9, fontWeight: "800" },
  agencyBtn:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  agencyBtnTxt: { fontSize: 11, fontWeight: "700" },

  emptyRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, backgroundColor: T.surface, borderRadius: T.radius.md, borderWidth: 1, borderColor: T.border, marginBottom: 16 },
  emptyTxt: { color: T.inkMuted, fontSize: 13, fontWeight: "600" },
});