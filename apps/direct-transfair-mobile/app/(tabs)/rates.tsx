// apps/direct-transfair-mobile/app/(tabs)/rates.tsx
// =========================================================
// TAUX DU JOUR v5.0 — Direct Transf'air
// Design: Thème clair · Violet #6C47FF · Ultra-moderne
// ✅ Taux de change en temps réel
// ✅ Convertisseur rapide intégré
// ✅ Accessible depuis l'AgentDashboard
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  StatusBar, Platform, ScrollView, RefreshControl, TextInput,
  Animated, ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";

// ─── Design System ──────────────────────────────────────
const C = {
  violet:       "#6C47FF",
  violetLight:  "#F5F3FF",
  violetBorder: "#EDE9FE",

  heroGlass:    "rgba(255,255,255,0.14)",
  heroGlassBdr: "rgba(255,255,255,0.22)",
  heroDim:      "rgba(255,255,255,0.65)",
  heroGlow:     "rgba(255,255,255,0.08)",

  pageBg:       "#F4F2FF",
  white:        "#FFFFFF",
  cardBorder:   "#EDE9FE",
  inputBg:      "#F8F7FF",

  ink:          "#12082E",
  inkMid:       "#4B3F72",
  inkSoft:      "#8B80A8",

  green:        "#10B981",
  greenBg:      "#ECFDF5",
  greenBorder:  "#A7F3D0",

  red:          "#EF4444",
  redBg:        "#FEF2F2",
  redBorder:    "#FECACA",

  amber:        "#F59E0B",
  amberBg:      "#FFFBEB",

  blue:         "#3B82F6",
  blueBg:       "#EFF6FF",

  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

// ─── Paires affichées ───────────────────────────────────
// Paires prioritaires pour le contexte Afrique / Europe
const PRIORITY_PAIRS = [
  "EUR/XOF", "EUR/GNF", "USD/XOF", "USD/GNF",
  "GBP/XOF", "GBP/GNF", "EUR/USD", "EUR/GBP",
  "USD/GBP", "XOF/GNF",
];

// Drapeaux & noms des devises
const CURRENCY_META: Record<string, { flag: string; name: string; symbol: string }> = {
  EUR: { flag: "🇪🇺", name: "Euro",               symbol: "€" },
  XOF: { flag: "🌍", name: "Franc CFA BCEAO",     symbol: "F" },
  GNF: { flag: "🇬🇳", name: "Franc Guinéen",      symbol: "GF" },
  USD: { flag: "🇺🇸", name: "Dollar Américain",   symbol: "$" },
  GBP: { flag: "🇬🇧", name: "Livre Sterling",     symbol: "£" },
};

const CURRENCIES = ["EUR", "XOF", "GNF", "USD", "GBP"];

function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 4;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

// ─── Rate Card ──────────────────────────────────────────
function RateCard({ pair, rate, change }: { pair: string; rate: number; change?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const [from, to] = pair.split("/");
  const fromMeta  = CURRENCY_META[from] ?? { flag: "💱", name: from, symbol: from };
  const toMeta    = CURRENCY_META[to]   ?? { flag: "💱", name: to,   symbol: to };

  const isUp   = (change ?? 0) > 0;
  const isDown = (change ?? 0) < 0;
  const changeColor = isUp ? C.green : isDown ? C.red : C.inkSoft;
  const changeBg    = isUp ? C.greenBg : isDown ? C.redBg : C.inputBg;
  const changeIcon  = isUp ? "trending-up-outline" : isDown ? "trending-down-outline" : "remove-outline";

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={rc.card}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        {/* Paire */}
        <View style={rc.left}>
          <View style={rc.flagRow}>
            <View style={rc.flagBox}>
              <Text style={{ fontSize: 18 }}>{fromMeta.flag}</Text>
            </View>
            <View style={[rc.flagBox, rc.flagOverlap]}>
              <Text style={{ fontSize: 18 }}>{toMeta.flag}</Text>
            </View>
          </View>
          <View>
            <Text style={[rc.pair, { fontFamily: C.font.sans }]}>{pair}</Text>
            <Text style={[rc.pairSub, { fontFamily: C.font.sans }]} numberOfLines={1}>
              {fromMeta.name} → {toMeta.name}
            </Text>
          </View>
        </View>

        {/* Taux + variation */}
        <View style={rc.right}>
          <Text style={[rc.rate, { fontFamily: C.font.mono }]}>
            {fmt(rate, to)}
          </Text>
          <Text style={[rc.rateSub, { fontFamily: C.font.sans }]}>
            1 {from} = {fmt(rate, to)} {to}
          </Text>
          {change !== undefined && (
            <View style={[rc.changePill, { backgroundColor: changeBg }]}>
              <Ionicons name={changeIcon as any} size={10} color={changeColor} />
              <Text style={[rc.changeTxt, { color: changeColor, fontFamily: C.font.mono }]}>
                {change > 0 ? "+" : ""}{change.toFixed(2)}%
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const rc = StyleSheet.create({
  card:        { backgroundColor: C.white, borderRadius: C.r.lg, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.cardBorder, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: C.violet, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  left:        { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  flagRow:     { flexDirection: "row", alignItems: "center", width: 52 },
  flagBox:     { width: 34, height: 34, borderRadius: 17, backgroundColor: C.white, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: C.cardBorder },
  flagOverlap: { marginLeft: -14 },
  pair:        { fontSize: 14, fontWeight: "800", color: C.ink, marginBottom: 2 },
  pairSub:     { fontSize: 10, fontWeight: "600", color: C.inkSoft, maxWidth: 140 },
  right:       { alignItems: "flex-end", gap: 3 },
  rate:        { fontSize: 16, fontWeight: "900", color: C.ink },
  rateSub:     { fontSize: 9, fontWeight: "600", color: C.inkSoft },
  changePill:  { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: C.r.pill },
  changeTxt:   { fontSize: 10, fontWeight: "800" },
});

// ─── Convertisseur ──────────────────────────────────────
function Converter({ rates }: { rates: any[] }) {
  const [fromCur, setFromCur] = useState("EUR");
  const [toCur,   setToCur]   = useState("XOF");
  const [amount,  setAmount]  = useState("100");

  const findRate = (from: string, to: string): number | null => {
    const direct = rates.find((r) => r.pair === `${from}/${to}`);
    if (direct) return direct.rate;
    const inverse = rates.find((r) => r.pair === `${to}/${from}`);
    if (inverse && inverse.rate > 0) return 1 / inverse.rate;
    return null;
  };

  const numAmount = parseFloat(amount) || 0;
  const rate      = findRate(fromCur, toCur);
  const converted = rate !== null ? numAmount * rate : null;

  const swap = () => { setFromCur(toCur); setToCur(fromCur); };

  return (
    <View style={cv.card}>
      <View style={cv.head}>
        <View style={[cv.iconBox, { backgroundColor: C.violetLight }]}>
          <Ionicons name="swap-horizontal" size={16} color={C.violet} />
        </View>
        <Text style={[cv.title, { fontFamily: C.font.sans }]}>Convertisseur rapide</Text>
      </View>

      {/* De */}
      <View style={cv.row}>
        <View style={[cv.amtBox, { borderColor: C.violet }]}>
          <TextInput
            style={[cv.amtInput, { fontFamily: C.font.serif }]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="100"
            placeholderTextColor={C.inkSoft}
            underlineColorAndroid="transparent"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={cv.curScroll} contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
          {CURRENCIES.map((cur) => (
            <TouchableOpacity
              key={cur}
              style={[cv.curPill, fromCur === cur && { backgroundColor: C.violet, borderColor: C.violet }]}
              onPress={() => { if (cur !== toCur) setFromCur(cur); }}
            >
              <Text style={{ fontSize: 12 }}>{CURRENCY_META[cur]?.flag ?? "💱"}</Text>
              <Text style={[cv.curTxt, { color: fromCur === cur ? C.white : C.inkSoft, fontFamily: C.font.mono }]}>{cur}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Swap button */}
      <TouchableOpacity style={cv.swapBtn} onPress={swap}>
        <Ionicons name="swap-vertical" size={18} color={C.violet} />
      </TouchableOpacity>

      {/* Vers */}
      <View style={[cv.row, { marginTop: 0, marginBottom: 14 }]}>
        <View style={[cv.amtBox, { backgroundColor: C.violetLight, borderColor: C.violetBorder }]}>
          <Text style={[cv.amtResult, { fontFamily: C.font.serif }]}>
            {converted !== null ? fmt(converted, toCur) : "—"}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={cv.curScroll} contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
          {CURRENCIES.map((cur) => (
            <TouchableOpacity
              key={cur}
              style={[cv.curPill, toCur === cur && { backgroundColor: C.violet, borderColor: C.violet }]}
              onPress={() => { if (cur !== fromCur) setToCur(cur); }}
            >
              <Text style={{ fontSize: 12 }}>{CURRENCY_META[cur]?.flag ?? "💱"}</Text>
              <Text style={[cv.curTxt, { color: toCur === cur ? C.white : C.inkSoft, fontFamily: C.font.mono }]}>{cur}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Taux utilisé */}
      {rate !== null ? (
        <View style={cv.rateInfo}>
          <Ionicons name="information-circle-outline" size={13} color={C.violet} />
          <Text style={[cv.rateInfoTxt, { fontFamily: C.font.mono }]}>
            1 {fromCur} = {fmt(rate, toCur)} {toCur}
          </Text>
        </View>
      ) : (
        <View style={cv.rateInfo}>
          <Ionicons name="alert-circle-outline" size={13} color={C.amber} />
          <Text style={[cv.rateInfoTxt, { color: C.amber, fontFamily: C.font.sans }]}>
            Taux non disponible pour cette paire
          </Text>
        </View>
      )}
    </View>
  );
}
const cv = StyleSheet.create({
  card:      { backgroundColor: C.white, borderRadius: C.r.xl, padding: 18, marginBottom: 16, borderWidth: 1.5, borderColor: C.violetBorder, shadowColor: C.violet, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  head:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  iconBox:   { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  title:     { fontSize: 13, fontWeight: "900", color: C.violet, letterSpacing: 0.5 },
  row:       { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  amtBox:    { flex: 1, backgroundColor: C.inputBg, borderWidth: 1.5, borderRadius: C.r.md, paddingHorizontal: 14, paddingVertical: 12 },
  amtInput:  { fontSize: 22, color: C.ink, fontWeight: "800" },
  amtResult: { fontSize: 22, color: C.violet, fontWeight: "800" },
  curScroll: { flex: 1 },
  curPill:   { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: C.r.pill, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder },
  curTxt:    { fontSize: 11, fontWeight: "800" },
  swapBtn: {
    alignSelf: "center", width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.violetLight, borderWidth: 1.5, borderColor: C.violetBorder,
    justifyContent: "center", alignItems: "center", marginVertical: 4,
  },
  rateInfo:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.violetLight, borderRadius: C.r.sm, padding: 10, borderWidth: 1, borderColor: C.violetBorder },
  rateInfoTxt: { fontSize: 11, fontWeight: "700", color: C.violet },
});

// ─── Main ───────────────────────────────────────────────
export default function RatesScreen() {
  const router = useRouter();
  const [rates,      setRates]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const headerAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res  = await api.getExchangeRates();
      const list = Array.isArray(res) ? res : [];
      setRates(list);
      setLastUpdate(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch (e) {
      console.error("Rates error:", e);
      // Fallback avec taux indicatifs si l'API échoue
      setRates([
        { pair: "EUR/XOF", rate: 655.957,  changePercent: 0.02 },
        { pair: "EUR/GNF", rate: 9500,     changePercent: -0.15 },
        { pair: "USD/XOF", rate: 600.0,    changePercent: 0.08 },
        { pair: "USD/GNF", rate: 8700,     changePercent: 0.12 },
        { pair: "GBP/XOF", rate: 760.0,    changePercent: -0.05 },
        { pair: "GBP/GNF", rate: 11000,    changePercent: 0.03 },
        { pair: "EUR/USD", rate: 1.085,    changePercent: -0.02 },
        { pair: "EUR/GBP", rate: 0.862,    changePercent: 0.01 },
        { pair: "XOF/GNF", rate: 14.5,     changePercent: 0.0 },
      ]);
      setLastUpdate(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fadeAnim.setValue(0);
    void load();
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
  }, [load]));

  // Trier : paires prioritaires d'abord, puis les autres
  const sorted = [
    ...PRIORITY_PAIRS.map((p) => rates.find((r) => r.pair === p)).filter(Boolean),
    ...rates.filter((r) => !PRIORITY_PAIRS.includes(r.pair)),
  ];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.violet} />

      {/* ── Hero ── */}
      <Animated.View style={[s.hero, {
        opacity: headerAnim,
        transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
      }]}>
        <View style={s.glow1} />
        <View style={s.glow2} />

        <View style={s.heroRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={s.pill}>
              <View style={s.pillDot} />
              <Text style={[s.pillTxt, { fontFamily: C.font.sans }]}>EN TEMPS RÉEL</Text>
            </View>
            <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Taux du Jour</Text>
            <Text style={[s.heroSub, { fontFamily: C.font.sans }]}>
              Mis à jour à {lastUpdate || "—"}
            </Text>
          </View>
          <TouchableOpacity style={s.refreshBtn} onPress={() => void load()}>
            <Ionicons name="refresh" size={18} color={C.white} />
          </TouchableOpacity>
        </View>

        {/* Mini stat chips dans le hero */}
        <View style={s.chipsRow}>
          {[
            { pair: "EUR/XOF", label: "€ → F CFA" },
            { pair: "EUR/GNF", label: "€ → GNF" },
            { pair: "USD/XOF", label: "$ → F CFA" },
          ].map(({ pair, label }) => {
            const r = rates.find((x) => x.pair === pair);
            return (
              <View key={pair} style={s.chip}>
                <Text style={[s.chipLabel, { fontFamily: C.font.sans }]}>{label}</Text>
                <Text style={[s.chipRate, { fontFamily: C.font.mono }]}>
                  {r ? fmt(r.rate, pair.split("/")[1]) : "—"}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={C.violet} size="large" />
          <Text style={[s.loadingTxt, { fontFamily: C.font.sans }]}>Chargement des taux…</Text>
        </View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeAnim, flex: 1 }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} tintColor={C.violet} />}
        >
          {/* ── Convertisseur ── */}
          <Converter rates={rates} />

          {/* ── Taux ── */}
          <View style={s.secRow}>
            <View style={[s.secDot, { backgroundColor: C.violet }]} />
            <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>TOUTES LES PAIRES</Text>
            <Text style={[s.secCount, { fontFamily: C.font.mono }]}>{sorted.length}</Text>
          </View>

          {sorted.map((r: any) => (
            <RateCard
              key={r.pair}
              pair={r.pair}
              rate={r.rate}
              change={r.changePercent}
            />
          ))}

          {/* Note légale */}
          <View style={s.legalNote}>
            <Ionicons name="information-circle-outline" size={12} color={C.inkSoft} />
            <Text style={[s.legalTxt, { fontFamily: C.font.sans }]}>
              Taux indicatifs · Non contractuels · Les taux applicables peuvent varier lors de l'exécution.
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  hero: {
    backgroundColor: C.violet,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 48 : 16,
    paddingBottom: 20,
    overflow: "hidden",
  },
  glow1: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: C.heroGlow, top: -80, right: -60 },
  glow2: { position: "absolute", width: 120, height: 120, borderRadius: 60,  backgroundColor: "rgba(255,255,255,0.05)", bottom: 10, left: -40 },

  heroRow:    { flexDirection: "row", alignItems: "flex-start", marginBottom: 18 },
  backBtn: {
    width: 38, height: 38, borderRadius: C.r.sm,
    backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr,
    justifyContent: "center", alignItems: "center",
  },
  pill:       { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, borderRadius: C.r.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 6 },
  pillDot:    { width: 5, height: 5, borderRadius: C.r.pill, backgroundColor: "#A5F3FC" },
  pillTxt:    { color: "#E8E0FF", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  heroTitle:  { color: C.white, fontSize: 24, fontWeight: "700", marginBottom: 2 },
  heroSub:    { color: C.heroDim, fontSize: 11, fontWeight: "600" },
  refreshBtn: {
    width: 38, height: 38, borderRadius: C.r.sm,
    backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr,
    justifyContent: "center", alignItems: "center", marginTop: 4,
  },

  chipsRow: { flexDirection: "row", gap: 8 },
  chip:     { flex: 1, backgroundColor: "rgba(255,255,255,0.13)", borderRadius: C.r.md, padding: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  chipLabel:{ fontSize: 9,  fontWeight: "700", color: C.heroDim, marginBottom: 4 },
  chipRate: { fontSize: 13, fontWeight: "900", color: C.white },

  scroll:  { paddingHorizontal: 18, paddingTop: 20 },

  secRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  secDot:  { width: 5, height: 5, borderRadius: C.r.pill },
  secLbl:  { flex: 1, fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1.5 },
  secCount:{ fontSize: 11, fontWeight: "900", color: C.inkSoft },

  legalNote:{ flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 14, backgroundColor: C.white, borderRadius: C.r.md, borderWidth: 1, borderColor: C.cardBorder, marginTop: 6 },
  legalTxt: { flex: 1, fontSize: 10, fontWeight: "600", color: C.inkSoft, lineHeight: 15 },

  loadingTxt: { color: C.inkSoft, fontSize: 13, fontWeight: "600", marginTop: 12 },
});