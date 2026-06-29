// apps/direct-transfair-mobile/app/(tabs)/rates.tsx
// =========================================================
// TAUX DU JOUR v8.0 — Direct Transf'air
// ✅ v7.0 conservé : hero chips, rate cards, animations
// ✅ v8.0 : Convertisseur entièrement redesigné — style Wise
//   • Modal plein écran avec barre de recherche
//   • 2 lignes FROM / TO empilées verticalement
//   • Sélecteur devise : drapeau rond + code + chevron
//   • Taux affiché sous la ligne TO ("1 GNF = 0,0001 GBP")
//   • Disclaimer "Taux de change moyen du marché ⓘ"
//   • 5 devises uniquement : EUR, USD, GBP, XOF, GNF
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
  Modal,
  FlatList,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../services/api";

// ─── Palette ─────────────────────────────────────────────
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
    serif:   Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"     }),
    sans:    Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:    Platform.select({ ios: "Courier New", android: "monospace",          default: "monospace"  }),
  },
} as const;

// ─── 5 devises de l'application ──────────────────────────
// ✅ v8.0 : seules ces devises apparaissent dans le picker
const APP_CURRENCIES = [
  { code: "EUR", name: "Euro",             flag: "🇪🇺", symbol: "€"    },
  { code: "USD", name: "Dollar américain", flag: "🇺🇸", symbol: "$"    },
  { code: "GBP", name: "Livre sterling",   flag: "🇬🇧", symbol: "£"    },
  { code: "XOF", name: "Franc CFA BCEAO", flag: "🌍",  symbol: "FCFA" },
  { code: "GNF", name: "Franc guinéen",    flag: "🇬🇳", symbol: "GNF"  },
] as const;

function getCurrencyMeta(code: string) {
  return APP_CURRENCIES.find(c => c.code === code) ?? APP_CURRENCIES[0];
}

// ─── Meta pour hero chips et rate cards ──────────────────
const META: Record<string, { flag: string; name: string }> = {
  EUR: { flag: "🇪🇺", name: "Euro" },
  XOF: { flag: "🌍",  name: "Franc CFA" },
  GNF: { flag: "🇬🇳", name: "Franc Guinéen" },
  USD: { flag: "🇺🇸", name: "Dollar" },
  GBP: { flag: "🇬🇧", name: "Livre Sterling" },
};
const CURRENCIES = ["EUR", "XOF", "GNF", "USD", "GBP"];

const PRIORITY: string[] = [
  "EUR/XOF", "EUR/GNF", "USD/XOF", "USD/GNF",
  "GBP/XOF", "GBP/GNF", "EUR/USD", "EUR/GBP", "GBP/USD", "XOF/GNF",
];

const PAIR_COLORS: Record<string, string> = {
  "EUR/XOF": "#4361EE", "EUR/GNF": "#4361EE", "EUR/USD": "#0F766E", "EUR/GBP": "#7C3AED",
  "USD/XOF": "#16A34A", "USD/GNF": "#16A34A",
  "GBP/XOF": "#7C3AED", "GBP/GNF": "#7C3AED", "GBP/USD": "#DC2626",
  "XOF/GNF": "#D97706",
};

// ─── Helpers ─────────────────────────────────────────────
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

// Formatage pour les montants du convertisseur (2 décimales max, 0 pour GNF/XOF)
function fmtAmount(n: number, cur: string): string {
  if (!isFinite(n)) return "—";
  const d = cur === "GNF" || cur === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(n);
  } catch {
    return n.toFixed(d);
  }
}

// Formatage du taux (plus de décimales pour les petits nombres)
function fmtRate(rate: number, toCur: string): string {
  if (!isFinite(rate)) return "—";
  if (rate < 0.001) {
    try {
      return new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6,
      }).format(rate);
    } catch { return rate.toFixed(6); }
  }
  const d = toCur === "GNF" || toCur === "XOF" ? 2 : 4;
  try {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(rate);
  } catch { return rate.toFixed(d); }
}

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

// ─── Hero Chip (inchangé) ─────────────────────────────────
function HeroChip({ label, value, anim }: { label: string; value: string; anim: Animated.Value }) {
  return (
    <Animated.View style={[hc.chip, {
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [10,0] }) }],
    }]}>
      <Text style={[hc.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <Text style={[hc.value, { fontFamily: T.font.serif }]}>{value}</Text>
    </Animated.View>
  );
}
const hc = StyleSheet.create({
  chip: {
    flex: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: T.r.md, paddingVertical: 10, paddingHorizontal: 6, alignItems: "center", gap: 3,
    shadowColor: "#4361EE", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  label: { fontSize: 8, fontWeight: "700", color: T.inkMuted, letterSpacing: 0.5 },
  value: { fontSize: 17, fontWeight: "900", color: T.accent, lineHeight: 20 },
});

// =========================================================
// ✅ v8.0 — MODAL SÉLECTEUR DE DEVISE
// Style : plein écran, X en haut à gauche, liste avec drapeaux
// =========================================================
function CurrencyPickerModal({
  visible,
  selectedCode,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedCode: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<TextInput>(null);

  const filtered = search.trim()
    ? APP_CURRENCIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : [...APP_CURRENCIES];

  const handleSelect = (code: string) => {
    onSelect(code);
    setSearch("");
    onClose();
  };

  const handleClose = () => {
    setSearch("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <SafeAreaView style={pm.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* ── Bouton fermer ── */}
        <View style={pm.headerRow}>
          <TouchableOpacity style={pm.closeBtn} onPress={handleClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={T.ink} />
          </TouchableOpacity>
        </View>

        {/* ── Titre ── */}
        <Text style={[pm.title, { fontFamily: T.font.serif }]}>
          Sélectionnez une devise
        </Text>

        {/* ── Barre de recherche ── */}
        <View style={pm.searchBar}>
          <Ionicons name="search" size={18} color={T.inkMuted} />
          <TextInput
            ref={searchRef}
            style={[pm.searchInput, { fontFamily: T.font.sans }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher"
            placeholderTextColor={T.inkMuted}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={T.inkMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Liste des 5 devises ── */}
        <FlatList
          data={filtered}
          keyExtractor={item => item.code}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSelected = item.code === selectedCode;
            return (
              <TouchableOpacity
                style={[pm.item, isSelected && pm.itemActive]}
                onPress={() => handleSelect(item.code)}
                activeOpacity={0.6}
              >
                {/* Drapeau en cercle */}
                <View style={pm.flagCircle}>
                  <Text style={{ fontSize: 28 }}>{item.flag}</Text>
                </View>

                {/* Nom et code */}
                <Text style={[pm.itemLabel, { fontFamily: T.font.sans }]}>
                  {item.name}
                  {"  "}
                  <Text style={pm.itemCode}>-  {item.code}</Text>
                </Text>

                {/* Coche si sélectionné */}
                {isSelected && (
                  <Ionicons name="checkmark" size={24} color="#1D4ED8" />
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={pm.empty}>
              <Ionicons name="search-outline" size={36} color={T.inkMuted} />
              <Text style={[pm.emptyTxt, { fontFamily: T.font.sans }]}>
                Aucune devise trouvée
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const pm = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: "#FFFFFF" },
  headerRow: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 16 : 12,
    paddingBottom: 4,
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#F1F5F9",
    justifyContent: "center", alignItems: "center",
  },
  title: {
    fontSize: 26, fontWeight: "700", color: T.ink,
    paddingHorizontal: 20, marginTop: 18, marginBottom: 22,
    lineHeight: 32,
  },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#F1F5F9", borderRadius: 14,
    paddingHorizontal: 16, height: 52,
    marginHorizontal: 20, marginBottom: 8,
  },
  searchInput: {
    flex: 1, fontSize: 16, color: T.ink, fontWeight: "500",
  },
  item: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 20,
    borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
  },
  itemActive: { backgroundColor: "#EFF6FF" },
  flagCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#F8FAFF",
    borderWidth: 1, borderColor: "#E2E8F0",
    justifyContent: "center", alignItems: "center",
    marginRight: 16, overflow: "hidden",
  },
  itemLabel: {
    flex: 1, fontSize: 15, fontWeight: "500", color: T.ink,
  },
  itemCode:  { color: T.inkSub, fontWeight: "600" },
  empty: {
    alignItems: "center", paddingTop: 48, gap: 12,
  },
  emptyTxt:  { fontSize: 14, color: T.inkMuted, fontWeight: "600" },
});

// =========================================================
// ✅ v8.0 — CONVERTISSEUR REDESIGNÉ — style Wise
// 2 lignes FROM/TO empilées, sélecteur devise avec modal
// =========================================================
function Converter({ rates }: { rates: any[] }) {
  const [fromCur, setFromCur] = useState("EUR");
  const [toCur,   setToCur]   = useState("XOF");
  const [amount,  setAmount]  = useState("100");
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker,   setShowToPicker]   = useState(false);

  const rate      = findRate(rates, fromCur, toCur);
  const numAmount = parseFloat(String(amount).replace(/\s/g, "").replace(",", ".")) || 0;
  const converted = rate !== null ? numAmount * rate : null;

  const fromMeta = getCurrencyMeta(fromCur);
  const toMeta   = getCurrencyMeta(toCur);

  // Sélection FROM : si l'utilisateur choisit la devise TO → on swap
  const handleSelectFrom = (code: string) => {
    if (code === toCur) { setToCur(fromCur); }
    setFromCur(code);
  };

  // Sélection TO : si l'utilisateur choisit la devise FROM → on swap
  const handleSelectTo = (code: string) => {
    if (code === fromCur) { setFromCur(toCur); }
    setToCur(code);
  };

  const handleSwap = () => {
    const prevFrom = fromCur;
    setFromCur(toCur);
    setToCur(prevFrom);
    if (converted !== null) {
      setAmount(fmtAmount(converted, toCur).replace(/\s/g, ""));
    }
  };

  return (
    <View style={cv.card}>

      {/* ══ Ligne FROM — bordure bleue active ══ */}
      <View style={cv.fromRow}>

        {/* Sélecteur devise FROM */}
        <TouchableOpacity
          style={cv.currencyBtn}
          onPress={() => setShowFromPicker(true)}
          activeOpacity={0.7}
        >
          <View style={cv.flagCircle}>
            <Text style={{ fontSize: 20 }}>{fromMeta.flag}</Text>
          </View>
          <Text style={[cv.currencyCode, { fontFamily: T.font.sans }]}>
            {fromCur}
          </Text>
          <Ionicons name="chevron-down" size={15} color={T.inkSub} />
        </TouchableOpacity>

        {/* Séparateur vertical */}
        <View style={cv.vSep} />

        {/* Montant (saisie) */}
        <TextInput
          style={[cv.amountInput, { fontFamily: T.font.serif }]}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          selectTextOnFocus
          underlineColorAndroid="transparent"
          placeholder="0"
          placeholderTextColor={T.inkMuted}
          {...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {})}
        />

        {/* Icône calculatrice */}
        <View style={cv.actionBtn}>
          <Ionicons name="calculator-outline" size={20} color={T.inkSub} />
        </View>
      </View>

      {/* ══ Ligne TO — bordure grise inactive ══ */}
      <View style={cv.toRow}>

        {/* Sélecteur devise TO */}
        <TouchableOpacity
          style={cv.currencyBtn}
          onPress={() => setShowToPicker(true)}
          activeOpacity={0.7}
        >
          <View style={cv.flagCircle}>
            <Text style={{ fontSize: 20 }}>{toMeta.flag}</Text>
          </View>
          <Text style={[cv.currencyCode, { fontFamily: T.font.sans }]}>
            {toCur}
          </Text>
          <Ionicons name="chevron-down" size={15} color={T.inkSub} />
        </TouchableOpacity>

        {/* Séparateur vertical */}
        <View style={cv.vSep} />

        {/* Résultat + taux */}
        <View style={cv.resultWrap}>
          <Text
            style={[cv.resultAmount, { fontFamily: T.font.serif }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {converted !== null
              ? `${toMeta.symbol} ${fmtAmount(converted, toCur)}`
              : "—"
            }
          </Text>
          {rate !== null && (
            <Text style={[cv.rateSmall, { fontFamily: T.font.sans }]}>
              1 {fromCur} = {fmtRate(rate, toCur)} {toCur}
            </Text>
          )}
        </View>

        {/* Bouton swap (⋮ dans Wise → ici swap vertical) */}
        <TouchableOpacity style={cv.actionBtn} onPress={handleSwap}>
          <Ionicons name="swap-vertical-outline" size={20} color={T.inkSub} />
        </TouchableOpacity>
      </View>

      {/* ══ Barre inférieure ══ */}
      <View style={cv.bottomBar}>
        {/* Bouton inverser */}
        <TouchableOpacity style={cv.invertBtn} onPress={handleSwap}>
          <Ionicons name="swap-horizontal" size={14} color={T.accent} />
          <Text style={[cv.invertTxt, { fontFamily: T.font.sans }]}>
            Inverser
          </Text>
        </TouchableOpacity>

        {/* Disclaimer marché */}
        <View style={cv.marketWrap}>
          <Text style={[cv.marketTxt, { fontFamily: T.font.sans }]}>
            Taux de change moyen du marché
          </Text>
          <Ionicons
            name="information-circle-outline"
            size={14}
            color={T.inkMuted}
          />
        </View>
      </View>

      {/* ── Modals sélecteur ── */}
      <CurrencyPickerModal
        visible={showFromPicker}
        selectedCode={fromCur}
        onSelect={handleSelectFrom}
        onClose={() => setShowFromPicker(false)}
      />
      <CurrencyPickerModal
        visible={showToPicker}
        selectedCode={toCur}
        onSelect={handleSelectTo}
        onClose={() => setShowToPicker(false)}
      />
    </View>
  );
}

const cv = StyleSheet.create({
  card: {
    backgroundColor: T.surface, borderRadius: T.r.xl,
    marginBottom: 16, overflow: "hidden",
    shadowColor: "#4361EE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 16, elevation: 5,
    borderWidth: 1, borderColor: T.borderLt,
  },

  // ── FROM row : bordure bleue active ──
  fromRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 2, borderColor: "#1D4ED8",
    borderRadius: T.r.lg, margin: 12, marginBottom: 6,
    overflow: "hidden", backgroundColor: "#FAFBFF",
  },

  // ── TO row : bordure grise inactive ──
  toRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: T.border,
    borderRadius: T.r.lg, marginHorizontal: 12, marginBottom: 6,
    overflow: "hidden", backgroundColor: T.surface,
  },

  // Sélecteur devise (flag + code + chevron)
  currencyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 16,
  },
  flagCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#F8FAFF",
    borderWidth: 1, borderColor: T.border,
    justifyContent: "center", alignItems: "center",
    overflow: "hidden",
  },
  currencyCode: {
    fontSize: 16, fontWeight: "700", color: T.ink,
  },

  // Séparateur vertical
  vSep: {
    width: 1, height: 38, backgroundColor: T.border,
  },

  // TextInput montant (FROM)
  amountInput: {
    flex: 1, paddingHorizontal: 14,
    fontSize: 22, fontWeight: "700", color: T.ink,
    textAlign: "right",
  },

  // Zone résultat (TO)
  resultWrap: {
    flex: 1, paddingHorizontal: 14,
    alignItems: "flex-end", justifyContent: "center",
    gap: 4, paddingVertical: 12,
  },
  resultAmount: {
    fontSize: 22, fontWeight: "700", color: T.ink, textAlign: "right",
  },
  rateSmall: {
    fontSize: 11, color: T.inkSub, fontWeight: "500", textAlign: "right",
  },

  // Icône droite (calculatrice ou swap)
  actionBtn: {
    paddingHorizontal: 14, paddingVertical: 16,
  },

  // Barre inférieure
  bottomBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 13,
    borderTopWidth: 1, borderTopColor: T.borderLt,
    gap: 8,
  },
  invertBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  invertTxt: {
    fontSize: 13, fontWeight: "700", color: T.accent,
  },
  marketWrap: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "flex-end", gap: 5,
  },
  marketTxt: {
    fontSize: 11, color: T.inkMuted, fontWeight: "500", textAlign: "right",
    flexShrink: 1,
  },
});

// ─── Rate Card (inchangé) ─────────────────────────────────
function RateCard({ item, index }: { item: any; index: number }) {
  const anim  = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const pair      = normPair(item.pair);
  const [from, to] = pair.split("/");
  const fromM     = META[from] ?? { flag: "💱", name: from };
  const toM       = META[to]   ?? { flag: "💱", name: to };
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
      toValue: 1, useNativeDriver: true, speed: 14, bounciness: 4, delay: index * 35,
    }).start();
  }, []);

  const rate = Number(item.rate ?? 0);

  return (
    <Animated.View style={{
      opacity: anim,
      transform: [
        { scale },
        { translateX: anim.interpolate({ inputRange: [0,1], outputRange: [16,0] }) },
      ],
      marginBottom: 8,
    }}>
      <TouchableOpacity
        style={[rc.card, { borderLeftColor: pairColor }]}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.975, useNativeDriver: true, speed: 60 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={rc.iconStack}>
          <View style={rc.iconWrap}><Text style={{ fontSize: 18 }}>{fromM.flag}</Text></View>
          <View style={[rc.iconWrap, rc.iconOverlap]}><Text style={{ fontSize: 18 }}>{toM.flag}</Text></View>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[rc.pair, { fontFamily: T.font.sans }]}>{pair}</Text>
          <Text style={[rc.pairSub, { fontFamily: T.font.sans }]} numberOfLines={1}>
            {fromM.name} → {toM.name}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", gap: 5 }}>
          <Text style={[rc.rate, { fontFamily: T.font.serif }]}>
            {rate > 0 ? fmt(rate, to) : "—"}
          </Text>
          <View style={[rc.changePill, { backgroundColor: chBg, borderColor: chBdr }]}>
            <Ionicons name={chIcon as any} size={10} color={chColor} />
            <Text style={[rc.changeTxt, { color: chColor, fontFamily: T.font.mono }]}>
              {change !== 0 ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%` : "0.00%"}
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
    backgroundColor: T.surface, borderRadius: T.r.lg, padding: 14,
    borderWidth: 1, borderColor: T.borderLt, borderLeftWidth: 4,
    shadowColor: "#4361EE", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, overflow: "hidden",
  },
  iconStack: { width: 50, flexDirection: "row", alignItems: "center" },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: T.surface,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: T.borderLt,
  },
  iconOverlap:  { marginLeft: -10 },
  pair:         { fontSize: 13, fontWeight: "800", color: T.ink, marginBottom: 2 },
  pairSub:      { fontSize: 10, fontWeight: "600", color: T.inkSub, maxWidth: 140 },
  rate:         { fontSize: 18, fontWeight: "900", color: T.ink },
  changePill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: T.r.pill, borderWidth: 1,
  },
  changeTxt: { fontSize: 9, fontWeight: "900" },
});

// ─── Écran principal (structure inchangée) ────────────────
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
      const normalized = list.map((r: any) => ({ ...r, pair: normPair(r.pair) }));
      setRates(normalized);
      setLastUpdate(
        new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      );
      animateIn();
    } catch {
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
      [headerAnim, chip1Anim, chip2Anim, chip3Anim, listAnim].forEach(a => a.setValue(0));
      void load();
      Animated.spring(headerAnim, {
        toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4,
      }).start();
    }, [load])
  );

  const sorted = [
    ...PRIORITY.map(p => rates.find(r => r.pair === p)).filter(Boolean),
    ...rates.filter(r => !PRIORITY.includes(r.pair)),
  ];

  const eurXof = findRate(rates, "EUR", "XOF");
  const eurGnf = findRate(rates, "EUR", "GNF");
  const usdXof = findRate(rates, "USD", "XOF");

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={T.pageBg} />

      {/* ── Héro compact ── */}
      <Animated.View style={{
        opacity: headerAnim,
        transform: [{ scale: headerAnim.interpolate({ inputRange: [0,1], outputRange: [0.97,1] }) }],
      }}>
        <LinearGradient
          colors={["#E8EEFF", "#F0F4FF", "#F8FAFF"]}
          start={{ x: 0.2, y: 0 }} end={{ x: 0, y: 1 }}
          style={s.hero}
        >
          <View style={s.heroNav}>
            <TouchableOpacity style={s.navBtn} onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="arrow-back" size={20} color={T.ink} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroTitle, { fontFamily: T.font.serif }]}>Taux du Jour</Text>
              <View style={s.liveBadge}>
                <View style={s.liveDot} />
                <Text style={[s.liveTxt, { fontFamily: T.font.sans }]}>
                  {lastUpdate ? `MIS À JOUR À ${lastUpdate}` : "EN TEMPS RÉEL"}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={[s.navBtn, { borderColor: T.accentMd }]} onPress={() => void load()} hitSlop={12}>
              <Ionicons name="refresh" size={19} color={T.accent} />
            </TouchableOpacity>
          </View>

          <View style={s.chipsRow}>
            <HeroChip label="€ → CFA" value={eurXof ? fmt(eurXof, "XOF") : "—"} anim={chip1Anim} />
            <HeroChip label="€ → GNF" value={eurGnf ? fmt(eurGnf, "GNF") : "—"} anim={chip2Anim} />
            <HeroChip label="$ → CFA" value={usdXof ? fmt(usdXof, "XOF") : "—"} anim={chip3Anim} />
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ── Contenu ── */}
      {loading ? (
        <View style={s.loadBox}>
          <ActivityIndicator color={T.accent} size="large" />
          <Text style={[s.loadTxt, { fontFamily: T.font.sans }]}>Chargement des taux…</Text>
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
          {/* ✅ v8.0 : Convertisseur redesigné */}
          <Converter rates={rates} />

          {/* En-tête section paires */}
          <View style={s.secRow}>
            <View style={s.secDot} />
            <Text style={[s.secTitle, { fontFamily: T.font.sans }]}>TOUTES LES PAIRES</Text>
            <View style={s.secBadge}>
              <Text style={[s.secCount, { fontFamily: T.font.mono }]}>{sorted.length}</Text>
            </View>
          </View>

          {sorted.map((item: any, i: number) => (
            <RateCard key={item.pair} item={item} index={i} />
          ))}

          <View style={s.legal}>
            <Ionicons name="information-circle-outline" size={12} color={T.inkMuted} />
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

  hero: {
    paddingTop:        Platform.OS === "android" ? 46 : 14,
    paddingBottom:     18, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  heroNav:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  navBtn: {
    width: 36, height: 36, borderRadius: 11, backgroundColor: T.surface,
    borderWidth: 1, borderColor: T.border, justifyContent: "center", alignItems: "center",
    shadowColor: "#4361EE", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  heroTitle: { fontSize: 22, fontWeight: "800", color: T.ink, lineHeight: 26 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  liveDot:   { width: 6, height: 6, borderRadius: 99, backgroundColor: T.green },
  liveTxt:   { fontSize: 9, color: T.green, fontWeight: "800", letterSpacing: 0.5 },
  chipsRow:  { flexDirection: "row", gap: 8 },

  loadBox: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  loadTxt: { fontSize: 13, color: T.inkSub, fontWeight: "600" },

  scroll: { paddingHorizontal: 16, paddingTop: 18 },

  secRow:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  secDot:   { width: 5, height: 5, borderRadius: 99, backgroundColor: T.accent },
  secTitle: { flex: 1, fontSize: 10, fontWeight: "800", color: T.inkSub, letterSpacing: 1 },
  secBadge: {
    backgroundColor: T.accentLt, borderRadius: 7,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: T.accentMd,
  },
  secCount: { fontSize: 10, fontWeight: "800", color: T.accent },

  legal: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: T.surface, borderRadius: T.r.md, padding: 12,
    borderWidth: 1, borderColor: T.borderLt, marginTop: 6,
  },
  legalTxt: { flex: 1, fontSize: 10, fontWeight: "600", color: T.inkMuted, lineHeight: 16 },
});