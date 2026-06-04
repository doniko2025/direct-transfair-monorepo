// apps/direct-transfair-mobile/app/(tabs)/rates.tsx
// =========================================================
// TAUX DU JOUR v6.0 — Direct Transf'air
// ✅ FIX : normalisation pair slug (slash ↔ underscore)
//    → les chips et le convertisseur affichent maintenant les vrais taux
// ✅ Redesign complet : hero animé, convertisseur Wise-style, cards premium
// =========================================================

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  StatusBar, Platform, ScrollView, RefreshControl, TextInput,
  Animated, ActivityIndicator, FlatList,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";

// ─── Design System ──────────────────────────────────────
const C = {
  violet:       "#6C47FF",
  violetDark:   "#4F35CC",
  violetLight:  "#F5F3FF",
  violetBorder: "#DDD6FE",
  violetPale:   "#EDE9FE",

  heroGlass:    "rgba(255,255,255,0.13)",
  heroGlassBdr: "rgba(255,255,255,0.20)",
  heroDim:      "rgba(255,255,255,0.60)",

  pageBg:       "#F4F2FF",
  white:        "#FFFFFF",
  cardBorder:   "#E8E3FF",

  ink:          "#1A0A3C",
  inkMid:       "#4B3F72",
  inkSoft:      "#8B80A8",
  inkMuted:     "#B8AECF",

  green:        "#10B981",
  greenBg:      "#ECFDF5",
  greenBorder:  "#A7F3D0",
  greenDark:    "#065F46",

  red:          "#EF4444",
  redBg:        "#FEF2F2",
  redBorder:    "#FECACA",

  amber:        "#F59E0B",
  amberBg:      "#FFFBEB",
  amberBorder:  "#FDE68A",

  r: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia",     android: "serif",            default: "serif"      }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

// ─── Meta devises ────────────────────────────────────────
const META: Record<string, { flag: string; name: string; short: string }> = {
  EUR: { flag: "🇪🇺", name: "Euro",           short: "EUR" },
  XOF: { flag: "🌍", name: "Franc CFA",       short: "CFA" },
  GNF: { flag: "🇬🇳", name: "Franc Guinéen",  short: "GNF" },
  USD: { flag: "🇺🇸", name: "Dollar",         short: "USD" },
  GBP: { flag: "🇬🇧", name: "Livre Sterling", short: "GBP" },
};
const CURRENCIES = ["EUR", "XOF", "GNF", "USD", "GBP"];

// Paires à afficher en priorité
const PRIORITY: string[] = [
  "EUR/XOF", "EUR/GNF", "USD/XOF", "USD/GNF",
  "GBP/XOF", "GBP/GNF", "EUR/USD", "EUR/GBP", "GBP/USD", "XOF/GNF",
];

// ─── Helpers ─────────────────────────────────────────────
// ✅ FIX : normalise underscore → slash pour l'affichage
function normPair(p: string): string { return p.replace("_", "/"); }

function fmt(n: number, cur = "XOF"): string {
  if (!isFinite(n)) return "—";
  const d = cur === "GNF" || cur === "XOF" ? 0 : 4;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

function findRate(rates: any[], from: string, to: string): number | null {
  if (from === to) return 1;
  // ✅ cherche slash ET underscore pour compatibilité DB
  const direct = rates.find((r) =>
    normPair(r.pair) === `${from}/${to}` || r.pair === `${from}_${to}`
  );
  if (direct?.rate > 0) return Number(direct.rate);
  const inverse = rates.find((r) =>
    normPair(r.pair) === `${to}/${from}` || r.pair === `${to}_${from}`
  );
  if (inverse?.rate > 0) return 1 / Number(inverse.rate);
  return null;
}

// ─── HERO CHIP ───────────────────────────────────────────
function HeroChip({
  label, value, currency, anim,
}: { label: string; value: string; currency: string; anim: Animated.Value }) {
  return (
    <Animated.View style={[hc.chip, {
      opacity:   anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
    }]}>
      <Text style={[hc.label, { fontFamily: C.font.sans }]}>{label}</Text>
      <Text style={[hc.value, { fontFamily: C.font.serif }]}>{value}</Text>
      <Text style={[hc.cur, { fontFamily: C.font.mono }]}>{currency}</Text>
    </Animated.View>
  );
}
const hc = StyleSheet.create({
  chip:  { flex: 1, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, borderRadius: C.r.lg, paddingVertical: 12, paddingHorizontal: 10, alignItems: "center", gap: 3 },
  label: { fontSize: 9, fontWeight: "800", color: C.heroDim, letterSpacing: 1, textTransform: "uppercase" },
  value: { fontSize: 18, fontWeight: "900", color: C.white, letterSpacing: -0.3 },
  cur:   { fontSize: 8, fontWeight: "900", color: "rgba(255,255,255,0.5)", letterSpacing: 1 },
});

// ─── CONVERTER ───────────────────────────────────────────
function Converter({ rates }: { rates: any[] }) {
  const [fromCur, setFromCur] = useState("EUR");
  const [toCur,   setToCur]   = useState("XOF");
  const [amount,  setAmount]  = useState("100");
  const swapAnim = useRef(new Animated.Value(0)).current;

  const rate      = findRate(rates, fromCur, toCur);
  const numAmount = parseFloat(amount) || 0;
  const converted = rate !== null ? numAmount * rate : null;

  const swap = () => {
    Animated.sequence([
      Animated.timing(swapAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(swapAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
    const prevFrom = fromCur;
    setFromCur(toCur);
    setToCur(prevFrom);
  };

  const spin = swapAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  return (
    <View style={cv.card}>
      {/* Title */}
      <View style={cv.head}>
        <View style={cv.headIcon}>
          <Ionicons name="swap-horizontal" size={15} color={C.violet} />
        </View>
        <Text style={[cv.headTitle, { fontFamily: C.font.sans }]}>Convertisseur rapide</Text>
      </View>

      {/* From row */}
      <View style={cv.row}>
        <View style={[cv.amtWrap, { borderColor: C.violet }]}>
          <TextInput
            style={[cv.amtInput, { fontFamily: C.font.serif, color: C.ink }]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="100"
            placeholderTextColor={C.inkMuted}
            underlineColorAndroid="transparent"
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={cv.pills}
        >
          {CURRENCIES.map((cur) => {
            const active = fromCur === cur;
            return (
              <TouchableOpacity
                key={cur}
                style={[cv.pill, active && { backgroundColor: C.violet, borderColor: C.violet }]}
                onPress={() => { if (cur !== toCur) setFromCur(cur); }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13 }}>{META[cur]?.flag ?? "💱"}</Text>
                <Text style={[cv.pillTxt, { color: active ? C.white : C.inkSoft, fontFamily: C.font.mono }]}>
                  {cur}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Swap button */}
      <View style={cv.swapWrap}>
        <View style={cv.swapLine} />
        <TouchableOpacity style={cv.swapBtn} onPress={swap} activeOpacity={0.8}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="swap-vertical" size={18} color={C.violet} />
          </Animated.View>
        </TouchableOpacity>
        <View style={cv.swapLine} />
      </View>

      {/* To row */}
      <View style={cv.row}>
        <View style={[cv.amtWrap, { backgroundColor: C.violetLight, borderColor: C.violetBorder }]}>
          <Text style={[cv.amtResult, {
            fontFamily: C.font.serif,
            color: converted !== null ? C.violet : C.inkMuted,
          }]}>
            {converted !== null ? fmt(converted, toCur) : "—"}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={cv.pills}
        >
          {CURRENCIES.map((cur) => {
            const active = toCur === cur;
            return (
              <TouchableOpacity
                key={cur}
                style={[cv.pill, active && { backgroundColor: C.violet, borderColor: C.violet }]}
                onPress={() => { if (cur !== fromCur) setToCur(cur); }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13 }}>{META[cur]?.flag ?? "💱"}</Text>
                <Text style={[cv.pillTxt, { color: active ? C.white : C.inkSoft, fontFamily: C.font.mono }]}>
                  {cur}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Rate info / unavailable */}
      {rate !== null ? (
        <View style={cv.rateBar}>
          <Ionicons name="information-circle-outline" size={13} color={C.violet} />
          <Text style={[cv.rateBarTxt, { fontFamily: C.font.mono, color: C.violet }]}>
            1 {fromCur} = {fmt(rate, toCur)} {toCur}
          </Text>
        </View>
      ) : (
        <View style={[cv.rateBar, { backgroundColor: C.amberBg, borderColor: C.amberBorder }]}>
          <Ionicons name="alert-circle-outline" size={13} color={C.amber} />
          <Text style={[cv.rateBarTxt, { fontFamily: C.font.sans, color: C.amber }]}>
            Taux non disponible pour cette paire
          </Text>
        </View>
      )}
    </View>
  );
}
const cv = StyleSheet.create({
  card:     { backgroundColor: C.white, borderRadius: C.r.xl, padding: 18, marginBottom: 16, borderWidth: 1.5, borderColor: C.violetBorder, shadowColor: C.violet, shadowOpacity: 0.10, shadowRadius: 14, elevation: 6 },
  head:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  headIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: C.violetLight, justifyContent: "center", alignItems: "center" },
  headTitle:{ fontSize: 13, fontWeight: "900", color: C.violet, letterSpacing: 0.3 },
  row:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  amtWrap:  { width: 130, backgroundColor: "#FBFAFF", borderWidth: 2, borderRadius: C.r.md, paddingHorizontal: 14, paddingVertical: 13, justifyContent: "center" },
  amtInput: { fontSize: 24, fontWeight: "800" },
  amtResult:{ fontSize: 24, fontWeight: "800" },
  pills:    { gap: 6, alignItems: "center", paddingVertical: 2 },
  pill:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: C.r.pill, backgroundColor: "#FBFAFF", borderWidth: 1.5, borderColor: C.cardBorder },
  pillTxt:  { fontSize: 11, fontWeight: "800" },
  swapWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 6 },
  swapLine: { flex: 1, height: 1, backgroundColor: C.cardBorder },
  swapBtn:  { width: 38, height: 38, borderRadius: 19, backgroundColor: C.violetLight, borderWidth: 1.5, borderColor: C.violetBorder, justifyContent: "center", alignItems: "center" },
  rateBar:  { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: C.violetLight, borderRadius: C.r.sm, padding: 10, borderWidth: 1, borderColor: C.violetBorder, marginTop: 6 },
  rateBarTxt:{ fontSize: 11, fontWeight: "800" },
});

// ─── RATE CARD ───────────────────────────────────────────
function RateCard({ item, index }: { item: any; index: number }) {
  const anim  = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const pair  = normPair(item.pair);
  const [from, to] = pair.split("/");
  const fromM = META[from] ?? { flag: "💱", name: from, short: from };
  const toM   = META[to]   ?? { flag: "💱", name: to,   short: to   };

  const change   = Number(item.changePercent ?? 0);
  const isUp     = change > 0;
  const isDown   = change < 0;
  const chColor  = isUp ? C.green  : isDown ? C.red  : C.inkMuted;
  const chBg     = isUp ? C.greenBg: isDown ? C.redBg: "#F4F2FF";
  const chBorder = isUp ? C.greenBorder: isDown ? C.redBorder: C.cardBorder;
  const chIcon   = isUp ? "trending-up" : isDown ? "trending-down" : "remove";

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1, useNativeDriver: true,
      speed: 14, bounciness: 4,
      delay: index * 35,
    }).start();
  }, []);

  const rate = Number(item.rate ?? 0);

  return (
    <Animated.View style={{
      opacity:   anim,
      transform: [
        { scale },
        { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
      ],
      marginBottom: 10,
    }}>
      <TouchableOpacity
        style={rCard.card}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.975, useNativeDriver: true, speed: 60 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,     useNativeDriver: true, speed: 30 }).start()}
      >
        {/* Avatars empilés */}
        <View style={rCard.avatarStack}>
          <View style={rCard.avatar}>
            <Text style={{ fontSize: 20 }}>{fromM.flag}</Text>
          </View>
          <View style={[rCard.avatar, rCard.avatarOverlap]}>
            <Text style={{ fontSize: 20 }}>{toM.flag}</Text>
          </View>
        </View>

        {/* Pair info */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[rCard.pair, { fontFamily: C.font.sans }]}>{pair}</Text>
          <Text style={[rCard.pairSub, { fontFamily: C.font.sans }]} numberOfLines={1}>
            {fromM.name} → {toM.name}
          </Text>
        </View>

        {/* Rate + change */}
        <View style={{ alignItems: "flex-end", gap: 5 }}>
          <Text style={[rCard.rate, { fontFamily: C.font.serif }]}>
            {rate > 0 ? fmt(rate, to) : "—"}
          </Text>
          <View style={[rCard.changePill, { backgroundColor: chBg, borderColor: chBorder }]}>
            <Ionicons name={chIcon as any} size={10} color={chColor} />
            <Text style={[rCard.changeTxt, { color: chColor, fontFamily: C.font.mono }]}>
              {change !== 0 ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%` : "0.00%"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const rCard = StyleSheet.create({
  card:         { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: C.white, borderRadius: C.r.lg, padding: 15, borderWidth: 1, borderColor: C.cardBorder, shadowColor: C.violet, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  avatarStack:  { width: 52, flexDirection: "row", alignItems: "center" },
  avatar:       { width: 34, height: 34, borderRadius: 17, backgroundColor: C.white, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: C.cardBorder },
  avatarOverlap:{ marginLeft: -12 },
  pair:         { fontSize: 14, fontWeight: "800", color: C.ink, marginBottom: 3 },
  pairSub:      { fontSize: 10, fontWeight: "600", color: C.inkSoft, maxWidth: 150 },
  rate:         { fontSize: 18, fontWeight: "900", color: C.ink },
  changePill:   { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: C.r.pill, borderWidth: 1 },
  changeTxt:    { fontSize: 9, fontWeight: "900" },
});

// ─── MAIN ────────────────────────────────────────────────
export default function RatesScreen() {
  const router = useRouter();
  const [rates,      setRates]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");

  const headerAnim = useRef(new Animated.Value(0)).current;
  const chip1Anim  = useRef(new Animated.Value(0)).current;
  const chip2Anim  = useRef(new Animated.Value(0)).current;
  const chip3Anim  = useRef(new Animated.Value(0)).current;
  const listAnim   = useRef(new Animated.Value(0)).current;

  const animateIn = (data: any[]) => {
    const anims = [chip1Anim, chip2Anim, chip3Anim];
    anims.forEach((a) => a.setValue(0));
    listAnim.setValue(0);
    Animated.stagger(80, [
      ...anims.map((a) => Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 5 })),
      Animated.spring(listAnim, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 3 }),
    ]).start();
  };

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res  = await api.getExchangeRates();
      const list = Array.isArray(res) ? res : [];
      // ✅ Normalise toutes les paires au format slash pour l'affichage
      const normalized = list.map((r: any) => ({ ...r, pair: normPair(r.pair) }));
      setRates(normalized);
      setLastUpdate(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
      animateIn(normalized);
    } catch {
      // Taux indicatifs de secours
      const fallback = [
        { pair: "EUR/XOF", rate: 655.957, changePercent:  0.02 },
        { pair: "EUR/GNF", rate: 9500,    changePercent: -0.15 },
        { pair: "USD/XOF", rate: 600.0,   changePercent:  0.08 },
        { pair: "USD/GNF", rate: 8700,    changePercent:  0.12 },
        { pair: "GBP/XOF", rate: 760.0,   changePercent: -0.05 },
        { pair: "GBP/GNF", rate: 11000,   changePercent:  0.03 },
        { pair: "EUR/USD", rate: 1.085,   changePercent: -0.02 },
        { pair: "EUR/GBP", rate: 0.862,   changePercent:  0.01 },
        { pair: "XOF/GNF", rate: 14.5,    changePercent:  0.00 },
      ];
      setRates(fallback);
      setLastUpdate(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
      animateIn(fallback);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    [headerAnim, chip1Anim, chip2Anim, chip3Anim, listAnim].forEach((a) => a.setValue(0));
    void load();
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
  }, [load]));

  // Taux prioritaires en premier
  const sorted = [
    ...PRIORITY.map((p) => rates.find((r) => r.pair === p)).filter(Boolean),
    ...rates.filter((r) => !PRIORITY.includes(r.pair)),
  ];

  // Valeurs pour les chips hero
  const eurXof = findRate(rates, "EUR", "XOF");
  const eurGnf = findRate(rates, "EUR", "GNF");
  const usdXof = findRate(rates, "USD", "XOF");
  const chipAnims = [chip1Anim, chip2Anim, chip3Anim];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.violet} />

      {/* ── HERO ── */}
      <Animated.View style={[s.hero, {
        opacity:   headerAnim,
        transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
      }]}>
        {/* Glows décoratifs */}
        <View style={s.glow1} />
        <View style={s.glow2} />
        <View style={s.glow3} />

        {/* Nav */}
        <View style={s.heroNav}>
          <TouchableOpacity style={s.navBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <View style={s.livePill}>
              <View style={s.liveDot} />
              <Text style={[s.liveTxt, { fontFamily: C.font.sans }]}>EN TEMPS RÉEL</Text>
            </View>
          </View>
          <TouchableOpacity style={s.navBtn} onPress={() => void load()}>
            <Ionicons name="refresh" size={18} color={C.white} />
          </TouchableOpacity>
        </View>

        {/* Titre */}
        <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Taux du Jour</Text>
        <Text style={[s.heroSub, { fontFamily: C.font.sans }]}>
          Mis à jour à {lastUpdate || "—"}
        </Text>

        {/* 3 chips principaux */}
        <View style={s.chipsRow}>
          {[
            { label: "€ → F CFA", value: eurXof ? fmt(eurXof, "XOF") : "—", currency: "XOF", anim: chip1Anim },
            { label: "€ → GNF",   value: eurGnf ? fmt(eurGnf, "GNF") : "—", currency: "GNF", anim: chip2Anim },
            { label: "$ → F CFA", value: usdXof ? fmt(usdXof, "XOF") : "—", currency: "XOF", anim: chip3Anim },
          ].map((chip) => (
            <HeroChip key={chip.label} {...chip} />
          ))}
        </View>
      </Animated.View>

      {loading ? (
        <View style={s.loadingBox}>
          <View style={s.loadingCard}>
            <ActivityIndicator color={C.violet} size="large" />
            <Text style={[s.loadingTxt, { fontFamily: C.font.sans }]}>Chargement des taux…</Text>
          </View>
        </View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: listAnim, flex: 1 }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load()}
              tintColor={C.violet}
            />
          }
        >
          {/* ── Convertisseur ── */}
          <Converter rates={rates} />

          {/* ── Section header ── */}
          <View style={s.secHeader}>
            <View style={s.secDot} />
            <Text style={[s.secTitle, { fontFamily: C.font.sans }]}>TOUTES LES PAIRES</Text>
            <View style={s.secBadge}>
              <Text style={[s.secCount, { fontFamily: C.font.mono }]}>{sorted.length}</Text>
            </View>
          </View>

          {/* ── Cartes taux ── */}
          {sorted.map((item: any, i: number) => (
            <RateCard key={item.pair} item={item} index={i} />
          ))}

          {/* Note légale */}
          <View style={s.legalBox}>
            <Ionicons name="information-circle-outline" size={12} color={C.inkMuted} />
            <Text style={[s.legalTxt, { fontFamily: C.font.sans }]}>
              Taux indicatifs, non contractuels. Les taux réels peuvent légèrement varier au moment de l'exécution.
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

  // ── Hero ──
  hero: {
    backgroundColor: C.violet,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 46 : 14,
    paddingBottom: 22,
    overflow: "hidden",
  },
  glow1: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: "rgba(255,255,255,0.07)", top: -100, right: -80 },
  glow2: { position: "absolute", width: 140, height: 140, borderRadius: 70,  backgroundColor: "rgba(255,255,255,0.05)", bottom: -30, left:  -40 },
  glow3: { position: "absolute", width: 80,  height: 80,  borderRadius: 40,  backgroundColor: "rgba(160,130,255,0.15)", top: 30, right: 50 },

  heroNav: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  navBtn: {
    width: 38, height: 38, borderRadius: C.r.sm,
    backgroundColor: "rgba(255,255,255,0.13)", borderWidth: 1, borderColor: "rgba(255,255,255,0.20)",
    justifyContent: "center", alignItems: "center",
  },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.13)", borderRadius: C.r.pill, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.20)" },
  liveDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ADE80" },
  liveTxt:  { fontSize: 9, fontWeight: "900", color: "rgba(255,255,255,0.85)", letterSpacing: 1.5 },

  heroTitle: { color: C.white, fontSize: 28, fontWeight: "800", marginBottom: 3, letterSpacing: -0.3 },
  heroSub:   { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "600", marginBottom: 20 },

  chipsRow: { flexDirection: "row", gap: 8 },

  // ── Loading ──
  loadingBox:  { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingCard: { alignItems: "center", gap: 12 },
  loadingTxt:  { color: C.inkSoft, fontSize: 13, fontWeight: "600", marginTop: 4 },

  // ── Content ──
  scroll: { paddingHorizontal: 18, paddingTop: 20 },

  secHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  secDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: C.violet },
  secTitle:  { fontSize: 11, fontWeight: "900", color: C.inkMid, letterSpacing: 1.5, flex: 1 },
  secBadge:  { backgroundColor: C.violetPale, borderRadius: C.r.pill, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: C.violetBorder },
  secCount:  { fontSize: 11, fontWeight: "900", color: C.violet },

  // ── Legal ──
  legalBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: C.white, borderRadius: C.r.md, padding: 12, borderWidth: 1, borderColor: C.cardBorder, marginTop: 6 },
  legalTxt: { flex: 1, fontSize: 10, fontWeight: "600", color: C.inkMuted, lineHeight: 16 },
});