// apps/direct-transfair-mobile/app/(tabs)/rates.tsx
// =========================================================
// TAUX DU JOUR v7.0 — Direct Transf'air
// ✅ FIX conservé : normPair, findRate (slash ↔ underscore)
// ✅ Fallback, changePercent, animations — tous conservés
// ✅ Design Option A — Lumière (Bleu Indigo #4361EE)
//    • Hero compact gradient clair (#E8EEFF → #F8FAFF)
//    • 5 devises en chips pilules AU-DESSUS des champs
//    • Champs convertisseur CÔTE À CÔTE + swap horizontal
//    • Cards avec accent border gauche colorée par paire
// =========================================================

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView,
  RefreshControl,
  TextInput,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../services/api";

// ─── Palette Option A — Lumière ──────────────────────────
const T = {
  pageBg:   "#F8FAFF",
  surface:  "#FFFFFF",
  border:   "#DDE4FF",
  borderLt: "#E4EDFF",
  ink:      "#0F172A",
  inkSub:   "#64748B",
  inkMuted: "#94A3B8",
  accent:   "#4361EE",
  accentLt: "#EEF2FF",
  accentMd: "#DDE4FF",
  green:    "#22C55E",
  greenBg:  "#DCFCE7",
  greenBdr: "#86EFAC",
  greenDark:"#15803D",
  red:      "#EF4444",
  redBg:    "#FEE2E2",
  redBdr:   "#FECACA",
  redDark:  "#B91C1C",
  amber:    "#F59E0B",
  amberBg:  "#FFFBEB",
  amberBdr: "#FDE68A",
  white:    "#FFFFFF",
  r: { xs: 6, sm: 10, md: 14, lg: 18, xl: 22, pill: 99 },
  font: {
    serif:   Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif"  }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",          default: "monospace"   }),
  },
} as const;

// ─── Meta devises ─────────────────────────────────────────
const META: Record<string, { flag: string; name: string }> = {
  EUR: { flag: "🇪🇺", name: "Euro" },
  XOF: { flag: "🌍",  name: "Franc CFA" },
  GNF: { flag: "🇬🇳", name: "Franc Guinéen" },
  USD: { flag: "🇺🇸", name: "Dollar" },
  GBP: { flag: "🇬🇧", name: "Livre Sterling" },
};
const CURRENCIES = ["EUR", "XOF", "GNF", "USD", "GBP"];

// Ordre d'affichage des paires
const PRIORITY: string[] = [
  "EUR/XOF", "EUR/GNF", "USD/XOF", "USD/GNF",
  "GBP/XOF", "GBP/GNF", "EUR/USD", "EUR/GBP", "GBP/USD", "XOF/GNF",
];

// Couleur accent par paire
const PAIR_COLORS: Record<string, string> = {
  "EUR/XOF": "#4361EE", "EUR/GNF": "#4361EE", "EUR/USD": "#0F766E", "EUR/GBP": "#7C3AED",
  "USD/XOF": "#16A34A", "USD/GNF": "#16A34A",
  "GBP/XOF": "#7C3AED", "GBP/GNF": "#7C3AED", "GBP/USD": "#DC2626",
  "XOF/GNF": "#D97706",
};

// ─── Helpers (conservés de v6.0) ─────────────────────────

// ✅ FIX v6.0 : normalise underscore → slash
function normPair(p: string): string {
  return p.replace("_", "/");
}

function fmt(n: number, cur = "XOF"): string {
  if (!isFinite(n)) return "—";
  const d = cur === "GNF" || cur === "XOF" ? 0 : 4;
  try {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(n);
  } catch {
    return n.toFixed(d);
  }
}

// ✅ FIX v6.0 : cherche slash ET underscore pour compatibilité DB
function findRate(rates: any[], from: string, to: string): number | null {
  if (from === to) return 1;
  const direct = rates.find(r =>
    normPair(r.pair) === `${from}/${to}` || r.pair === `${from}_${to}`
  );
  if (direct?.rate > 0) return Number(direct.rate);
  const inverse = rates.find(r =>
    normPair(r.pair) === `${to}/${from}` || r.pair === `${to}_${from}`
  );
  if (inverse?.rate > 0) return 1 / Number(inverse.rate);
  return null;
}

// ─── Composant HeroChip ───────────────────────────────────
function HeroChip({
  label,
  value,
  anim,
}: {
  label: string;
  value: string;
  anim: Animated.Value;
}) {
  return (
    <Animated.View
      style={[
        hc.chip,
        {
          opacity:   anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange:  [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={[hc.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <Text style={[hc.value, { fontFamily: T.font.serif }]}>{value}</Text>
    </Animated.View>
  );
}

const hc = StyleSheet.create({
  chip: {
    flex: 1,
    backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.border,
    borderRadius: T.r.md,
    paddingVertical: 10, paddingHorizontal: 6,
    alignItems: "center", gap: 3,
    shadowColor: "#4361EE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  label: {
    fontSize: 8, fontWeight: "700",
    color: T.inkMuted, letterSpacing: 0.5,
  },
  value: {
    fontSize: 17, fontWeight: "900",
    color: T.accent, lineHeight: 20,
  },
});

// ─── Composant Converter ──────────────────────────────────
function Converter({ rates }: { rates: any[] }) {
  const [fromCur, setFromCur] = useState("EUR");
  const [toCur,   setToCur]   = useState("XOF");
  const [amount,  setAmount]  = useState("100");
  const swapAnim = useRef(new Animated.Value(0)).current;

  const rate      = findRate(rates, fromCur, toCur);
  const numAmount = parseFloat(String(amount).replace(",", ".")) || 0;
  const converted = rate !== null ? numAmount * rate : null;

  // Sélection d'une devise :
  // • chip FROM  → rien
  // • chip TO    → swap (TO↔FROM)
  // • autre chip → devient FROM
  const handleChip = (code: string) => {
    if (code === fromCur) return;
    if (code === toCur) {
      const prev = fromCur;
      setFromCur(code);
      setToCur(prev);
    } else {
      setFromCur(code);
    }
  };

  const handleSwap = () => {
    Animated.sequence([
      Animated.timing(swapAnim, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.timing(swapAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
    ]).start();
    const prev = fromCur;
    setFromCur(toCur);
    setToCur(prev);
  };

  const spin = swapAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View style={cv.card}>
      {/* Titre */}
      <View style={cv.head}>
        <View style={cv.headIcon}>
          <Ionicons name="swap-horizontal" size={14} color={T.accent} />
        </View>
        <Text style={[cv.headTitle, { fontFamily: T.font.sans }]}>
          Convertisseur rapide
        </Text>
      </View>

      {/* 5 devises — pilules au-dessus des champs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 12 }}
        contentContainerStyle={{ gap: 6, paddingRight: 4 }}
      >
        {CURRENCIES.map(code => {
          const isFrom = code === fromCur;
          const isTo   = code === toCur;
          return (
            <TouchableOpacity
              key={code}
              style={[
                cv.chip,
                isFrom && cv.chipFrom,
                isTo   && cv.chipTo,
              ]}
              onPress={() => handleChip(code)}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 12 }}>{META[code]?.flag ?? "💱"}</Text>
              <Text
                style={[
                  cv.chipTxt,
                  { fontFamily: T.font.mono },
                  isFrom && { color: T.accent },
                  isTo   && { color: T.inkSub },
                ]}
              >
                {code}
              </Text>
              {/* Indicateur FROM */}
              {isFrom && <View style={cv.chipDot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Champs côte à côte */}
      <View style={cv.fieldsRow}>

        {/* Champ FROM (saisie) */}
        <View style={cv.fieldFrom}>
          <Text style={[cv.fieldLabel, { color: T.accent, fontFamily: T.font.sans }]}>
            {META[fromCur]?.flag ?? "💱"}  {fromCur}
          </Text>
          <TextInput
            style={[cv.fieldInput, { fontFamily: T.font.serif, color: T.ink }]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="100"
            placeholderTextColor={T.inkMuted}
            underlineColorAndroid="transparent"
            selectTextOnFocus
          />
        </View>

        {/* Bouton swap */}
        <TouchableOpacity style={cv.swapBtn} onPress={handleSwap} activeOpacity={0.8}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="swap-horizontal" size={15} color={T.white} />
          </Animated.View>
        </TouchableOpacity>

        {/* Champ TO (lecture seule) */}
        <View style={cv.fieldTo}>
          <Text style={[cv.fieldLabel, { color: T.inkSub, fontFamily: T.font.sans }]}>
            {META[toCur]?.flag ?? "💱"}  {toCur}
          </Text>
          <Text
            style={[
              cv.fieldResult,
              {
                fontFamily: T.font.serif,
                color: converted !== null ? T.accent : T.inkMuted,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {converted !== null ? fmt(converted, toCur) : "—"}
          </Text>
        </View>
      </View>

      {/* Barre taux / indisponible */}
      {rate !== null ? (
        <View style={cv.rateBar}>
          <Ionicons name="information-circle-outline" size={12} color={T.inkMuted} />
          <Text style={[cv.rateBarTxt, { fontFamily: T.font.mono, color: T.accent }]}>
            1 {fromCur} = {fmt(rate, toCur)} {toCur}
          </Text>
        </View>
      ) : (
        <View style={[cv.rateBar, { backgroundColor: T.amberBg, borderColor: T.amberBdr }]}>
          <Ionicons name="alert-circle-outline" size={12} color={T.amber} />
          <Text style={[cv.rateBarTxt, { fontFamily: T.font.sans, color: T.amber }]}>
            Taux non disponible pour cette paire
          </Text>
        </View>
      )}
    </View>
  );
}

const cv = StyleSheet.create({
  card: {
    backgroundColor: T.surface, borderRadius: T.r.xl,
    padding: 16, marginBottom: 16,
    borderWidth: 1.5, borderColor: T.borderLt,
    shadowColor: "#4361EE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 16, elevation: 5,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  headIcon: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: T.accentLt,
    justifyContent: "center", alignItems: "center",
  },
  headTitle: { fontSize: 13, fontWeight: "900", color: T.ink },

  // Chips devises
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: T.r.pill, borderWidth: 1.5, borderColor: T.borderLt,
    backgroundColor: T.surface,
  },
  chipFrom: { borderColor: T.accent, backgroundColor: T.accentLt },
  chipTo:   { borderColor: T.inkMuted, backgroundColor: "#F1F5F9" },
  chipTxt:  { fontSize: 10, fontWeight: "800", color: T.inkMuted },
  chipDot:  {
    width: 4, height: 4, borderRadius: 99,
    backgroundColor: T.accent, marginLeft: 1,
  },

  // Champs côte à côte
  fieldsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  fieldFrom: {
    flex: 1, borderRadius: T.r.md, padding: 11,
    backgroundColor: T.accentLt, borderWidth: 1.5, borderColor: T.accent,
  },
  fieldTo: {
    flex: 1, borderRadius: T.r.md, padding: 11,
    backgroundColor: T.pageBg, borderWidth: 1.5, borderColor: T.border,
  },
  fieldLabel:  { fontSize: 9, fontWeight: "800", marginBottom: 4 },
  fieldInput:  { fontSize: 24, fontWeight: "800", padding: 0, margin: 0 },
  fieldResult: { fontSize: 24, fontWeight: "800" },

  swapBtn: {
    width: 34, height: 34, borderRadius: T.r.sm,
    backgroundColor: T.accent,
    justifyContent: "center", alignItems: "center",
    flexShrink: 0,
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.40, shadowRadius: 8, elevation: 4,
  },

  // Barre taux
  rateBar: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: T.pageBg, borderRadius: T.r.xs,
    padding: 9, borderWidth: 1, borderColor: T.borderLt,
  },
  rateBarTxt: { fontSize: 11, fontWeight: "800" },
});

// ─── Composant RateCard ───────────────────────────────────
function RateCard({ item, index }: { item: any; index: number }) {
  const anim  = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const pair     = normPair(item.pair);
  const [from, to] = pair.split("/");
  const fromM    = META[from] ?? { flag: "💱", name: from };
  const toM      = META[to]   ?? { flag: "💱", name: to };
  const pairColor = PAIR_COLORS[pair] ?? T.accent;

  const change  = Number(item.changePercent ?? 0);
  const isUp    = change > 0;
  const isDown  = change < 0;
  const chColor = isUp ? T.greenDark : isDown ? T.redDark : T.inkMuted;
  const chBg    = isUp ? T.greenBg   : isDown ? T.redBg   : T.accentLt;
  const chBdr   = isUp ? T.greenBdr  : isDown ? T.redBdr  : T.borderLt;
  const chIcon  = isUp ? "trending-up" : isDown ? "trending-down" : "remove";

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1, useNativeDriver: true,
      speed: 14, bounciness: 4,
      delay: index * 35,
    }).start();
  }, []);

  const rate = Number(item.rate ?? 0);

  return (
    <Animated.View
      style={{
        opacity:   anim,
        transform: [
          { scale },
          {
            translateX: anim.interpolate({
              inputRange:  [0, 1],
              outputRange: [16, 0],
            }),
          },
        ],
        marginBottom: 8,
      }}
    >
      <TouchableOpacity
        style={[rc.card, { borderLeftColor: pairColor }]}
        activeOpacity={1}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.975, useNativeDriver: true, speed: 60,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1, useNativeDriver: true, speed: 30,
          }).start()
        }
      >
        {/* Drapeaux empilés */}
        <View style={rc.iconStack}>
          <View style={rc.iconWrap}>
            <Text style={{ fontSize: 18 }}>{fromM.flag}</Text>
          </View>
          <View style={[rc.iconWrap, rc.iconOverlap]}>
            <Text style={{ fontSize: 18 }}>{toM.flag}</Text>
          </View>
        </View>

        {/* Infos paire */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[rc.pair, { fontFamily: T.font.sans }]}>{pair}</Text>
          <Text
            style={[rc.pairSub, { fontFamily: T.font.sans }]}
            numberOfLines={1}
          >
            {fromM.name} → {toM.name}
          </Text>
        </View>

        {/* Taux + badge variation */}
        <View style={{ alignItems: "flex-end", gap: 5 }}>
          <Text style={[rc.rate, { fontFamily: T.font.serif }]}>
            {rate > 0 ? fmt(rate, to) : "—"}
          </Text>
          <View
            style={[
              rc.changePill,
              { backgroundColor: chBg, borderColor: chBdr },
            ]}
          >
            <Ionicons name={chIcon as any} size={10} color={chColor} />
            <Text
              style={[rc.changeTxt, { color: chColor, fontFamily: T.font.mono }]}
            >
              {change !== 0
                ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%`
                : "0.00%"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const rc = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.surface, borderRadius: T.r.lg,
    padding: 14,
    borderWidth: 1, borderColor: T.borderLt,
    borderLeftWidth: 4,
    shadowColor: "#4361EE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    overflow: "hidden",
  },
  iconStack:   { width: 50, flexDirection: "row", alignItems: "center" },
  iconWrap:    {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: T.surface,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: T.borderLt,
  },
  iconOverlap: { marginLeft: -10 },
  pair:        { fontSize: 13, fontWeight: "800", color: T.ink, marginBottom: 2 },
  pairSub:     { fontSize: 10, fontWeight: "600", color: T.inkSub, maxWidth: 140 },
  rate:        { fontSize: 18, fontWeight: "900", color: T.ink },
  changePill:  {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: T.r.pill, borderWidth: 1,
  },
  changeTxt: { fontSize: 9, fontWeight: "900" },
});

// ─── ÉCRAN PRINCIPAL ──────────────────────────────────────
export default function RatesScreen() {
  const router = useRouter();

  const [rates,      setRates]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");

  // Animations (conservées de v6.0)
  const headerAnim = useRef(new Animated.Value(0)).current;
  const chip1Anim  = useRef(new Animated.Value(0)).current;
  const chip2Anim  = useRef(new Animated.Value(0)).current;
  const chip3Anim  = useRef(new Animated.Value(0)).current;
  const listAnim   = useRef(new Animated.Value(0)).current;

  const animateIn = () => {
    [chip1Anim, chip2Anim, chip3Anim].forEach(a => a.setValue(0));
    listAnim.setValue(0);
    Animated.stagger(70, [
      Animated.spring(chip1Anim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 5 }),
      Animated.spring(chip2Anim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 5 }),
      Animated.spring(chip3Anim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 5 }),
      Animated.spring(listAnim,  { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 3 }),
    ]).start();
  };

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res  = await api.getExchangeRates();
      const list = Array.isArray(res) ? res : [];
      // ✅ FIX conservé : normalise toutes les paires au format slash
      const normalized = list.map((r: any) => ({ ...r, pair: normPair(r.pair) }));
      setRates(normalized);
      setLastUpdate(
        new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      );
      animateIn();
    } catch {
      // Taux de secours si l'API est inaccessible
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
      setLastUpdate(
        new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      );
      animateIn();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      [headerAnim, chip1Anim, chip2Anim, chip3Anim, listAnim].forEach(a =>
        a.setValue(0)
      );
      void load();
      Animated.spring(headerAnim, {
        toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4,
      }).start();
    }, [load])
  );

  // Paires triées par priorité (conservé de v6.0)
  const sorted = [
    ...PRIORITY.map(p => rates.find(r => r.pair === p)).filter(Boolean),
    ...rates.filter(r => !PRIORITY.includes(r.pair)),
  ];

  // Taux pour les 3 chips héros
  const eurXof = findRate(rates, "EUR", "XOF");
  const eurGnf = findRate(rates, "EUR", "GNF");
  const usdXof = findRate(rates, "USD", "XOF");

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={T.pageBg} />

      {/* ── HÉRO COMPACT ── */}
      <Animated.View
        style={{
          opacity:   headerAnim,
          transform: [
            {
              scale: headerAnim.interpolate({
                inputRange:  [0, 1],
                outputRange: [0.97, 1],
              }),
            },
          ],
        }}
      >
        <LinearGradient
          colors={["#E8EEFF", "#F0F4FF", "#F8FAFF"]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.hero}
        >
          {/* Nav */}
          <View style={s.heroNav}>
            <TouchableOpacity
              style={s.navBtn}
              onPress={() => router.back()}
              hitSlop={12}
            >
              <Ionicons name="arrow-back" size={20} color={T.ink} />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={[s.heroTitle, { fontFamily: T.font.serif }]}>
                Taux du Jour
              </Text>
              <View style={s.liveBadge}>
                <View style={s.liveDot} />
                <Text style={[s.liveTxt, { fontFamily: T.font.sans }]}>
                  {lastUpdate
                    ? `MIS À JOUR À ${lastUpdate}`
                    : "EN TEMPS RÉEL"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[s.navBtn, { borderColor: T.accentMd }]}
              onPress={() => void load()}
              hitSlop={12}
            >
              <Ionicons name="refresh" size={19} color={T.accent} />
            </TouchableOpacity>
          </View>

          {/* 3 chips taux clés */}
          <View style={s.chipsRow}>
            <HeroChip
              label="€ → CFA"
              value={eurXof ? fmt(eurXof, "XOF") : "—"}
              anim={chip1Anim}
            />
            <HeroChip
              label="€ → GNF"
              value={eurGnf ? fmt(eurGnf, "GNF") : "—"}
              anim={chip2Anim}
            />
            <HeroChip
              label="$ → CFA"
              value={usdXof ? fmt(usdXof, "XOF") : "—"}
              anim={chip3Anim}
            />
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ── CONTENU ── */}
      {loading ? (
        <View style={s.loadBox}>
          <ActivityIndicator color={T.accent} size="large" />
          <Text style={[s.loadTxt, { fontFamily: T.font.sans }]}>
            Chargement des taux…
          </Text>
        </View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: listAnim, flex: 1 }}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load()}
              tintColor={T.accent}
              colors={[T.accent]}
            />
          }
        >
          {/* Convertisseur */}
          <Converter rates={rates} />

          {/* En-tête section paires */}
          <View style={s.secRow}>
            <View style={s.secDot} />
            <Text style={[s.secTitle, { fontFamily: T.font.sans }]}>
              TOUTES LES PAIRES
            </Text>
            <View style={s.secBadge}>
              <Text style={[s.secCount, { fontFamily: T.font.mono }]}>
                {sorted.length}
              </Text>
            </View>
          </View>

          {/* Cards de taux */}
          {sorted.map((item: any, i: number) => (
            <RateCard key={item.pair} item={item} index={i} />
          ))}

          {/* Mention légale */}
          <View style={s.legal}>
            <Ionicons
              name="information-circle-outline"
              size={12}
              color={T.inkMuted}
            />
            <Text style={[s.legalTxt, { fontFamily: T.font.sans }]}>
              Taux indicatifs, non contractuels. Les taux réels peuvent légèrement
              varier au moment de l'exécution.
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles principaux ────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.pageBg },

  // Héros
  hero: {
    paddingTop:        Platform.OS === "android" ? 46 : 14,
    paddingBottom:     18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  heroNav:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  navBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#4361EE",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  heroTitle:  { fontSize: 22, fontWeight: "800", color: T.ink, lineHeight: 26 },
  liveBadge:  { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  liveDot:    { width: 6, height: 6, borderRadius: 99, backgroundColor: T.green },
  liveTxt:    { fontSize: 9, color: T.green, fontWeight: "800", letterSpacing: 0.5 },
  chipsRow:   { flexDirection: "row", gap: 8 },

  // Loader
  loadBox: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  loadTxt: { fontSize: 13, color: T.inkSub, fontWeight: "600" },

  // Scroll
  scroll: { paddingHorizontal: 16, paddingTop: 18 },

  // Section paires
  secRow:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  secDot:   { width: 5, height: 5, borderRadius: 99, backgroundColor: T.accent },
  secTitle: { flex: 1, fontSize: 10, fontWeight: "800", color: T.inkSub, letterSpacing: 1 },
  secBadge: {
    backgroundColor: T.accentLt, borderRadius: 7,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: T.accentMd,
  },
  secCount: { fontSize: 10, fontWeight: "800", color: T.accent },

  // Mention légale
  legal: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: T.surface, borderRadius: T.r.md,
    padding: 12, borderWidth: 1, borderColor: T.borderLt,
    marginTop: 6,
  },
  legalTxt: {
    flex: 1, fontSize: 10, fontWeight: "600",
    color: T.inkMuted, lineHeight: 16,
  },
});