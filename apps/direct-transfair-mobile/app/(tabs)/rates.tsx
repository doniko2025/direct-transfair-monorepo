// apps/direct-transfair-mobile/app/(tabs)/rates.tsx
// =========================================================
// TAUX DU JOUR v8.3 — Direct Transf'air
// ✅ v7.0 conservé : hero chips, animations
// ✅ v8.0 conservé : Convertisseur redesigné style Wise (modal recherche, 2 lignes FROM/TO, disclaimer marché)
// ✅ v8.1 conservé : suppression de la section "TOUTES LES PAIRES", correction du cadre parasite du champ FROM (outlineStyle en `style`)
// ✅ v8.2 conservé :
//   • Correction du sélecteur de devise FROM qui disparaissait dès qu'un montant
//     était saisi : sur react-native-web, un enfant flexible (`flex:1`) sans
//     `minWidth:0` refuse de rétrécir sous la largeur de son contenu — dès que
//     le texte tapé grandissait, le champ montant "poussait" le sélecteur de
//     devise hors de la zone visible (le conteneur a `overflow:"hidden"`).
//     Fix : `minWidth: 0` ajouté sur `amountInput` et `resultWrap`, et
//     `flexShrink: 0 / flexGrow: 0` verrouillés en dur sur les éléments à
//     largeur fixe (`currencyBtn`, `flagCircle`, `vSep`, `actionBtn`) pour
//     qu'ils ne puissent plus jamais être écrasés par le voisin flexible.
//   • Correction du montant converti tronqué ("FCFA 2…", "GNF 3 3…") côté TO :
//     `adjustsFontSizeToFit` n'a aucun effet sur react-native-web (prop iOS
//     uniquement), donc le texte restait coupé à taille fixe. Remplacé par une
//     fonction `dynamicFontSize()` qui recalcule la taille de police selon la
//     longueur du texte affiché — appliquée au montant saisi (FROM) et au
//     montant converti (TO), de façon identique sur toutes les plateformes.
//   • Tailles et espacements resserrés (padding des sélecteurs de devise,
//     icônes, police de base) pour que tout tienne sur une seule ligne, comme
//     demandé.
// ✅ v8.3 (cette version) :
//   • Suppression du code mort confirmé par toi : le composant RateCard, ses
//     styles `rc`, les constantes PRIORITY / PAIR_COLORS / CURRENCIES / META
//     et la variable `sorted` (tous orphelins depuis la suppression de la
//     section "TOUTES LES PAIRES" en v8.1). `normPair` et `fmt` sont conservés
//     car toujours utilisés (hero chips notamment).
// =========================================================

import React, { useState, useCallback, useRef } from "react";
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

// ✅ v8.2 : `adjustsFontSizeToFit` n'a aucun effet sur react-native-web -> le texte
// (montant saisi ou converti) était tronqué avec "…" au lieu de rétrécir (cf.
// captures). On calcule nous-mêmes une taille de police dégressive selon la
// longueur du texte affiché, valable de façon identique sur toutes les plateformes.
function dynamicFontSize(length: number): number {
  if (length <= 8)  return 20;
  if (length <= 11) return 18;
  if (length <= 14) return 15;
  if (length <= 18) return 13;
  return 11;
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
// ✅ v8.1 — champ de saisie du montant : reset du contour web déplacé dans `style`
// ✅ v8.2 — sélecteur de devise verrouillé (flexShrink:0) + minWidth:0 sur les
//   zones flexibles + taille de police dynamique pour FROM et TO (voir en-tête)
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

  // ✅ v8.2 : taille de police dégressive selon la longueur du texte affiché,
  // recalculée à chaque frappe / conversion (voir `dynamicFontSize` en en-tête)
  const amountFontSize = dynamicFontSize((amount || "0").length);
  const resultText     = converted !== null ? `${toMeta.symbol} ${fmtAmount(converted, toCur)}` : "—";
  const resultFontSize = dynamicFontSize(resultText.length);

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
            <Text style={{ fontSize: 18 }}>{fromMeta.flag}</Text>
          </View>
          <Text style={[cv.currencyCode, { fontFamily: T.font.sans }]}>
            {fromCur}
          </Text>
          <Ionicons name="chevron-down" size={14} color={T.inkSub} />
        </TouchableOpacity>

        {/* Séparateur vertical */}
        <View style={cv.vSep} />

        {/* Montant (saisie) */}
        {/* ✅ v8.1 : le reset "outline" doit être passé dans le tableau `style`, pas en tant que
            prop du composant — react-native-web ignorait `outlineStyle` passé en prop, d'où le
            contour bleu de focus + la bordure grise par défaut du <input> qui polluaient la
            saisie. borderWidth:0 est aussi mis en dur sur amountInput.
            ✅ v8.2 : `minWidth: 0` (dans le style `cv.amountInput`) empêche ce champ de forcer
            la ligne à dépasser sa largeur et de pousser le sélecteur de devise hors champ ; la
            taille de police est désormais dynamique (`amountFontSize`) au lieu d'être fixe. */}
        <TextInput
          style={[
            cv.amountInput,
            { fontFamily: T.font.serif, fontSize: amountFontSize },
            ...(Platform.OS === "web"
              ? [{ outlineStyle: "none", outlineWidth: 0, borderWidth: 0, boxShadow: "none" } as any]
              : []),
          ]}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          selectTextOnFocus
          underlineColorAndroid="transparent"
          placeholder="0"
          placeholderTextColor={T.inkMuted}
        />

        {/* Icône calculatrice */}
        <View style={cv.actionBtn}>
          <Ionicons name="calculator-outline" size={18} color={T.inkSub} />
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
            <Text style={{ fontSize: 18 }}>{toMeta.flag}</Text>
          </View>
          <Text style={[cv.currencyCode, { fontFamily: T.font.sans }]}>
            {toCur}
          </Text>
          <Ionicons name="chevron-down" size={14} color={T.inkSub} />
        </TouchableOpacity>

        {/* Séparateur vertical */}
        <View style={cv.vSep} />

        {/* Résultat + taux */}
        {/* ✅ v8.2 : `adjustsFontSizeToFit` retiré (sans effet sur web, cf. en-tête) et
            remplacé par `resultFontSize`, recalculé selon la longueur du texte affiché,
            pour que le montant complet reste toujours visible sans être coupé. */}
        <View style={cv.resultWrap}>
          <Text
            style={[cv.resultAmount, { fontFamily: T.font.serif, fontSize: resultFontSize }]}
            numberOfLines={1}
          >
            {resultText}
          </Text>
          {rate !== null && (
            <Text style={[cv.rateSmall, { fontFamily: T.font.sans }]}>
              1 {fromCur} = {fmtRate(rate, toCur)} {toCur}
            </Text>
          )}
        </View>

        {/* Bouton swap (⋮ dans Wise → ici swap vertical) */}
        <TouchableOpacity style={cv.actionBtn} onPress={handleSwap}>
          <Ionicons name="swap-vertical-outline" size={18} color={T.inkSub} />
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
  // ✅ v8.2 : flexShrink/flexGrow verrouillés à 0 — cet élément a une largeur fixe
  // et ne doit jamais pouvoir être écrasé par le champ montant voisin (flex:1)
  currencyBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 14,
    flexShrink: 0, flexGrow: 0,
  },
  flagCircle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#F8FAFF",
    borderWidth: 1, borderColor: T.border,
    justifyContent: "center", alignItems: "center",
    overflow: "hidden",
    flexShrink: 0, flexGrow: 0,
  },
  currencyCode: {
    fontSize: 15, fontWeight: "700", color: T.ink,
  },

  // Séparateur vertical
  vSep: {
    width: 1, height: 34, backgroundColor: T.border,
    flexShrink: 0, flexGrow: 0,
  },

  // TextInput montant (FROM)
  // ✅ v8.2 : `minWidth: 0` est la correction clé — sans elle, un enfant `flex:1`
  // refuse de rétrécir sous la largeur de son propre contenu et peut pousser les
  // éléments voisins (le sélecteur de devise) hors de la zone visible dès que du
  // texte est saisi. borderWidth:0 (v8.1) conservé.
  amountInput: {
    flex: 1, minWidth: 0, paddingHorizontal: 12,
    fontWeight: "700", color: T.ink,
    textAlign: "right",
    borderWidth: 0,
    backgroundColor: "transparent",
  },

  // Zone résultat (TO)
  // ✅ v8.2 : minWidth:0 pour la même raison que amountInput ci-dessus
  resultWrap: {
    flex: 1, minWidth: 0, paddingHorizontal: 12,
    alignItems: "flex-end", justifyContent: "center",
    gap: 3, paddingVertical: 12,
  },
  resultAmount: {
    fontWeight: "700", color: T.ink, textAlign: "right",
  },
  rateSmall: {
    fontSize: 10, color: T.inkSub, fontWeight: "500", textAlign: "right",
  },

  // Icône droite (calculatrice ou swap)
  // ✅ v8.2 : flexShrink/flexGrow verrouillés à 0, padding resserré
  actionBtn: {
    paddingHorizontal: 10, paddingVertical: 14,
    flexShrink: 0, flexGrow: 0,
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

// ─── Écran principal ──────────────────────────────────────
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
          {/* ✅ v8.1 : Convertisseur — seule section conservée dans le scroll,
              la liste "TOUTES LES PAIRES" a été retirée à la demande */}
          <Converter rates={rates} />

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