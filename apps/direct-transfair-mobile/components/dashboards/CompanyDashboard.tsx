// apps/direct-transfair-mobile/components/dashboards/CompanyDashboard.tsx
// =========================================================
// COMPANY ADMIN DASHBOARD v9.2 — Direct Transf'air
// ✅ v9.2 : 🚨 FIX — avertissement "ScrollView doesn't take rejection
//    well - scrolls anyway" sur web (voir échange du 19/07/2026).
//
//   CAUSE : deux ScrollView horizontaux (WalletCarousel + le
//   sélecteur de devise juste en dessous) étaient imbriqués
//   directement dans le ScrollView vertical principal de l'écran. Sur
//   react-native-web, les deux ScrollView se disputent le geste de
//   défilement au niveau du système de responder tactile de React
//   Native — d'où l'avertissement (bénin, "scrolls anyway", mais
//   intrusif dans l'overlay LogBox en dev sur web).
//
//   CORRECTIF — nouveau composant HScroller (défini juste avant
//   WalletCarousel) :
//     - Sur NATIF (iOS/Android) : rend un vrai <ScrollView horizontal>,
//       AUCUN changement de comportement (mêmes props snapToInterval /
//       decelerationRate / onScroll / ref.scrollTo qu'avant).
//     - Sur WEB uniquement : rend un simple <View> avec overflow-x en
//       CSS. Le navigateur route alors nativement le scroll horizontal
//       vs vertical sans jamais passer par le système de responder de
//       RN — plus aucun conflit possible, donc plus d'avertissement.
//   Compromis assumé sur web : l'effet magnétique "snap" du carrousel
//   de wallets (qui s'arrête pile sur une carte) devient un défilement
//   libre. Le reste du comportement (points qui suivent la position de
//   scroll, tap sur un point pour sauter à ce wallet) est identique.
//
//   WalletCarousel et le sélecteur de devise inline utilisent
//   désormais HScroller à la place de ScrollView — c'est le SEUL
//   changement fonctionnel de cette version. CurrencyChipSelector
//   (utilisé uniquement dans les modales, donc jamais imbriqué dans le
//   ScrollView principal) n'a pas été touché, il n'était pas concerné.
// ✅ v8.1 : Carte "Clients Wallet" dans la grille
// ✅ v9.0 :
//    - Héro rectangulaire bleu (LinearGradient #2563EB → #1D4ED8)
//      + bordure basse arrondie (borderBottomRadius 28)
//      + ombre portée bleue profonde
//      + glows décoratifs semi-transparents
//      + tout le texte du héro en blanc
//    - Fond global : blanc pur (#FFFFFF)
//    - Boutons "Alimenter" & "Déclarer B2B" :
//      fond blanc, ombre colorée accentuée (effet "flottant")
//      → Alimenter : ombre verte (#059669)
//      → Déclarer B2B : ombre indigo (#4F46E5)
// ✅ v9.1 : NOUVELLE ActionCard "Retrait Agence" dans "PILOTAGE
//    SOCIÉTÉ" — lien vers /(tabs)/admin/agency-withdrawal (écran
//    indépendant, voir agency-withdrawal.tsx). PUREMENT ADDITIF :
//    les 6 ActionCard existantes (Transactions, Agences, Trésorerie,
//    Frais & Commissions, Paramètres, Clients Wallet) ne sont ni
//    déplacées ni modifiées — la nouvelle carte s'ajoute en 7ème
//    position dans la même grille flex-wrap.
// =========================================================

import React, { useMemo, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  ScrollView, Modal, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Animated, SafeAreaView,
  StatusBar, Dimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Rect } from "react-native-svg";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const { width: SW } = Dimensions.get("window");
const CARD_W = (SW - 48 - 8) / 2;

// ─── Héro ─────────────────────────────────────────────────
// v9.0 : gradient bleu rectangulaire (plus de HERO_BG gris-indigo)
const HERO_FROM   = "#2563EB";
const HERO_TO     = "#1D4ED8";
const CONCAVE_H   = 70; // conservé pour HeroConcave (non rendu)

const CURRENCIES_ORDER = ["XOF", "EUR", "USD", "GNF", "GBP"] as const;
type CurrencyCode = (typeof CURRENCIES_ORDER)[number];

const CURRENCIES: Record<CurrencyCode, {
  code: CurrencyCode; symbol: string; flag: string;
  color: string; bg: string; name: string;
}> = {
  XOF: { code: "XOF", symbol: "CFA", flag: "🌍", color: "#D97706", bg: "#FEF3C7", name: "Franc CFA"      },
  EUR: { code: "EUR", symbol: "€",   flag: "🇪🇺", color: "#2563EB", bg: "#EFF6FF", name: "Euro"           },
  USD: { code: "USD", symbol: "$",   flag: "🇺🇸", color: "#059669", bg: "#ECFDF5", name: "Dollar US"      },
  GNF: { code: "GNF", symbol: "FG",  flag: "🇬🇳", color: "#DC2626", bg: "#FEF2F2", name: "Franc Guinéen"  },
  GBP: { code: "GBP", symbol: "£",   flag: "🇬🇧", color: "#7C3AED", bg: "#F5F3FF", name: "Livre Sterling" },
};

// ─── Design tokens v9 ────────────────────────────────────
const T = {
  // v9.0 : fond blanc pur
  pageBg:        "#FFFFFF",
  surface:       "#FFFFFF",
  border:        "#E8EDF5",
  borderSoft:    "#F0F4FB",

  primary:       "#4F46E5",
  primaryDark:   "#3730A3",
  primaryPale:   "#EEF2FF",
  primaryBorder: "#C7D2FE",

  success:       "#059669",
  successSoft:   "#F0FDF4",
  successBorder: "#A7F3D0",
  successDark:   "#047857",

  warning:       "#D97706",
  warningSoft:   "#FFFBEB",
  warningBorder: "#FDE68A",

  danger:        "#DC2626",
  dangerSoft:    "#FEF2F2",
  dangerBorder:  "#FECACA",

  text:          "#1E293B",
  textSoft:      "#64748B",
  textMuted:     "#94A3B8",

  r: { sm: 8, md: 12, lg: 14, xl: 20, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}
function fmt(n: number, currency: string): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

// ─── Wallet Card ──────────────────────────────────────────
function WalletCard({ currency, balance }: { currency: CurrencyCode; balance: number }) {
  const cfg = CURRENCIES[currency];
  return (
    <View style={[wc.card, { width: CARD_W }]}>
      <View style={[wc.topBar, { backgroundColor: cfg.color }]} />
      <View style={wc.header}>
        <View style={[wc.flag, { backgroundColor: cfg.bg }]}>
          <Text style={{ fontSize: 14 }}>{cfg.flag}</Text>
        </View>
        <View>
          <Text style={[wc.code, { color: cfg.color, fontFamily: T.font.mono }]}>{cfg.code}</Text>
          <Text style={[wc.name, { fontFamily: T.font.sans }]}>{cfg.name}</Text>
        </View>
      </View>
      <Text style={[wc.lbl, { fontFamily: T.font.sans }]}>SOLDE TOTAL</Text>
      <Text style={[wc.amount, { fontFamily: T.font.serif }]} numberOfLines={1} adjustsFontSizeToFit>
        {fmt(balance, cfg.code)}
      </Text>
      <Text style={[wc.sym, { color: cfg.color, fontFamily: T.font.mono }]}>
        {cfg.symbol} · {cfg.code}
      </Text>
    </View>
  );
}
const wc = StyleSheet.create({
  card:   { backgroundColor: T.surface, borderRadius: T.r.lg, borderWidth: 1, borderColor: T.border, overflow: "hidden", paddingBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  topBar: { height: 3, width: "100%", marginBottom: 9 },
  header: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, marginBottom: 8 },
  flag:   { width: 24, height: 24, borderRadius: 7, justifyContent: "center", alignItems: "center" },
  code:   { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  name:   { fontSize: 8, color: T.textSoft, fontWeight: "400", marginTop: 1 },
  lbl:    { fontSize: 7, fontWeight: "700", color: T.textMuted, letterSpacing: 1.2, marginBottom: 2, paddingHorizontal: 10 },
  amount: { fontSize: 16, fontWeight: "700", color: T.text, lineHeight: 19, paddingHorizontal: 10, marginBottom: 2 },
  sym:    { fontSize: 9, fontWeight: "700", paddingHorizontal: 10, marginTop: 2 },
});

// ─── Horizontal Scroller — ✅ v9.2 (voir changelog en tête de fichier) ──
// Cross-platform : natif → vrai ScrollView (inchangé) ; web → View avec
// overflow-x CSS (le navigateur gère alors le scroll horizontal/vertical
// nativement, sans passer par le système de responder tactile de RN).
type HScrollerHandle = { scrollTo: (opts: { x: number; animated?: boolean }) => void };

const HScroller = React.forwardRef<HScrollerHandle, {
  children: React.ReactNode;
  contentContainerStyle?: any;
  onScrollX?: (x: number) => void;
  snapInterval?: number;
  style?: any;
}>(function HScroller({ children, contentContainerStyle, onScrollX, snapInterval, style }, ref) {
  const webRef    = useRef<any>(null);
  const nativeRef = useRef<ScrollView>(null);

  React.useImperativeHandle(ref, () => ({
    scrollTo: ({ x, animated = true }) => {
      if (Platform.OS === "web") {
        webRef.current?.scrollTo?.({ left: x, behavior: animated ? "smooth" : "auto" });
      } else {
        nativeRef.current?.scrollTo({ x, animated });
      }
    },
  }));

  if (Platform.OS === "web") {
    return (
      <View
        ref={webRef}
        style={[style, hs.webTrack]}
        {...({ onScroll: (e: any) => onScrollX?.(e.target?.scrollLeft ?? 0) } as any)}
      >
        <View style={[hs.webContent, contentContainerStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      ref={nativeRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={contentContainerStyle}
      scrollEventThrottle={16}
      onScroll={(e) => onScrollX?.(e.nativeEvent.contentOffset.x)}
      {...(snapInterval
        ? { snapToInterval: snapInterval, snapToAlignment: "start" as const, decelerationRate: "fast" as const }
        : {})}
    >
      {children}
    </ScrollView>
  );
});
const hs = {
  webTrack:   { flexDirection: "row", overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch" } as any,
  webContent: { flexDirection: "row" } as any,
};

// ─── Wallet Carousel ──────────────────────────────────────
function WalletCarousel({ wallets, activeCur, setActiveCur }: {
  wallets: any[]; activeCur: number; setActiveCur: (i: number) => void;
}) {
  const scrollRef = useRef<HScrollerHandle>(null);
  const [dotIdx, setDotIdx] = useState(0);

  const getBalance = useCallback((c: string) => {
    const w = wallets.find((x) => x.currency === c);
    return toNum(w?.balance ?? w?.availableBalance ?? 0);
  }, [wallets]);

  // ✅ v9.2 — logique de calcul de l'index strictement identique à avant
  // (Math.round(x / (CARD_W + 8))), seule la source de x change selon la
  // plateforme (gérée en interne par HScroller).
  const handleScrollX = (x: number) => {
    const idx     = Math.round(x / (CARD_W + 8));
    const clamped = Math.max(0, Math.min(idx, CURRENCIES_ORDER.length - 1));
    setDotIdx(clamped);
    if (clamped !== activeCur) setActiveCur(clamped);
  };

  return (
    <View style={{ marginBottom: 10 }}>
      <HScroller
        ref={scrollRef}
        snapInterval={CARD_W + 8}
        contentContainerStyle={{ paddingRight: 16 }}
        onScrollX={handleScrollX}
      >
        {CURRENCIES_ORDER.map((c) => (
          <View key={c} style={{ marginRight: 8 }}>
            <WalletCard currency={c} balance={getBalance(c)} />
          </View>
        ))}
      </HScroller>
      <View style={car.dots}>
        {CURRENCIES_ORDER.map((c, i) => {
          const cfg      = CURRENCIES[c];
          const isActive = i === dotIdx;
          return (
            <TouchableOpacity
              key={c} hitSlop={8}
              onPress={() => { setDotIdx(i); setActiveCur(i); scrollRef.current?.scrollTo({ x: i * (CARD_W + 8), animated: true }); }}
            >
              <View style={[car.dot, { width: isActive ? 16 : 4, backgroundColor: isActive ? cfg.color : T.border }]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
const car = StyleSheet.create({
  dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 8, marginBottom: 4 },
  dot:  { height: 4, borderRadius: 99 },
});

// ─── Action Card ──────────────────────────────────────────
function ActionCard({ title, subtitle, icon, color, bg, onPress, badge }: {
  title: string; subtitle: string; icon: string; color: string;
  bg: string; onPress: () => void; badge?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ width: "48%", marginBottom: 10, transform: [{ scale }] }}>
      <TouchableOpacity
        style={ac.card} onPress={onPress} activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30 }).start()}
      >
        <View style={ac.top}>
          <View style={[ac.icon, { backgroundColor: bg }]}>
            <Ionicons name={icon as any} size={17} color={color} />
          </View>
          {badge && (
            <View style={[ac.badge, { backgroundColor: bg }]}>
              <Text style={[ac.badgeTxt, { color, fontFamily: T.font.sans }]}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={[ac.title, { fontFamily: T.font.sans }]}>{title}</Text>
        <Text style={[ac.sub,   { fontFamily: T.font.sans }]} numberOfLines={2}>{subtitle}</Text>
        <View style={[ac.arrow, { backgroundColor: bg }]}>
          <Ionicons name="arrow-forward" size={10} color={color} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const ac = StyleSheet.create({
  card:     { backgroundColor: T.surface, borderRadius: T.r.xl, padding: 14, borderWidth: 1, borderColor: T.border, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 4 },
  top:      { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 },
  icon:     { width: 36, height: 36, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  badge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeTxt: { fontSize: 8, fontWeight: "700" },
  title:    { fontSize: 12, fontWeight: "700", color: T.text, marginBottom: 4 },
  sub:      { fontSize: 10, color: T.textSoft, fontWeight: "400", lineHeight: 15, paddingBottom: 14 },
  arrow:    { position: "absolute", right: 12, bottom: 12, width: 20, height: 20, borderRadius: 7, justifyContent: "center", alignItems: "center" },
});

// ─── Agency Card ──────────────────────────────────────────
function AgencyCard({ agency, onRefill }: { agency: any; onRefill: () => void }) {
  const isActive = agency.isActive !== false;
  const wallets  = Array.isArray(agency.wallets) ? agency.wallets : [];
  const primary  = wallets.find((w: any) => w.isDefault) ?? wallets[0];
  const balance  = toNum(primary?.balance ?? agency.balance ?? 0);
  const currency = primary?.currency ?? agency.primaryCurrency ?? "XOF";
  const cfg      = CURRENCIES[currency as CurrencyCode] ?? CURRENCIES.XOF;
  const flagMap: Record<string, string> = {
    GN:"🇬🇳", SN:"🇸🇳", ML:"🇲🇱", CI:"🇨🇮",
    FR:"🇫🇷", GB:"🇬🇧", US:"🇺🇸", BF:"🇧🇫", NE:"🇳🇪", TG:"🇹🇬",
  };
  const flag = agency.country ? (flagMap[agency.country.toUpperCase().substring(0, 2)] ?? "🌍") : "🌍";

  return (
    <View style={ag.card}>
      <View style={[ag.bar, { backgroundColor: isActive ? T.success : T.danger }]} />
      <View style={ag.inner}>
        <View style={ag.row}>
          <View style={ag.flag}><Text style={{ fontSize: 20 }}>{flag}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[ag.name, { fontFamily: T.font.sans }]} numberOfLines={1}>{agency.name}</Text>
            <Text style={[ag.city, { fontFamily: T.font.sans }]}>{agency.city || "—"} · {agency.country || "—"}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[ag.balLbl, { fontFamily: T.font.sans }]}>SOLDE</Text>
            <Text style={[ag.bal, { color: cfg.color, fontFamily: T.font.serif }]}>{fmt(balance, currency)}</Text>
            <Text style={[ag.cur, { color: cfg.color, fontFamily: T.font.mono }]}>{cfg.symbol}</Text>
          </View>
        </View>
        <View style={ag.divider} />
        <View style={ag.foot}>
          <View style={[ag.status, {
            backgroundColor: isActive ? T.successSoft : T.dangerSoft,
            borderColor:     isActive ? T.successBorder : T.dangerBorder,
          }]}>
            <View style={[ag.dot, { backgroundColor: isActive ? T.success : T.danger }]} />
            <Text style={[ag.statusTxt, { color: isActive ? T.success : T.danger, fontFamily: T.font.sans }]}>
              {isActive ? "Opérationnelle" : "Suspendue"}
            </Text>
          </View>
          <TouchableOpacity style={ag.refillBtn} onPress={onRefill} activeOpacity={0.8}>
            <LinearGradient colors={[T.primary, T.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ag.refillGrad}>
              <Ionicons name="paper-plane-outline" size={11} color="#fff" />
              <Text style={[ag.refillTxt, { fontFamily: T.font.sans }]}>Recharger</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
const ag = StyleSheet.create({
  card:      { backgroundColor: T.surface, borderRadius: T.r.xl, marginBottom: 10, borderWidth: 1, borderColor: T.border, flexDirection: "row", overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  bar:       { width: 3 },
  inner:     { flex: 1, padding: 12 },
  row:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  flag:      { width: 36, height: 36, borderRadius: 10, backgroundColor: T.pageBg, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  name:      { color: T.text, fontSize: 13, fontWeight: "600", marginBottom: 2 },
  city:      { color: T.textSoft, fontSize: 10, fontWeight: "400" },
  balLbl:    { fontSize: 8, fontWeight: "700", color: T.textMuted, letterSpacing: 0.8, marginBottom: 2 },
  bal:       { fontSize: 14, fontWeight: "700" },
  cur:       { fontSize: 9, fontWeight: "700", marginTop: 1 },
  divider:   { height: 1, backgroundColor: T.borderSoft, marginBottom: 8 },
  foot:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  status:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, borderWidth: 1 },
  dot:       { width: 4, height: 4, borderRadius: 99 },
  statusTxt: { fontSize: 9, fontWeight: "700" },
  refillBtn: { borderRadius: 8, overflow: "hidden" },
  refillGrad:{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6 },
  refillTxt: { fontSize: 11, fontWeight: "700", color: "#fff" },
});

// ─── Modal Sheet ──────────────────────────────────────────
function ModalSheet({ visible, onClose, title, subtitle, gradColors, children }: {
  visible: boolean; onClose: () => void; title: string; subtitle: string;
  gradColors: [string, string]; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mo.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <View style={mo.sheet}>
            <View style={mo.handle} />
            <LinearGradient colors={gradColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={mo.head}>
              <View style={mo.iconBox}><Ionicons name="wallet-outline" size={20} color="#fff" /></View>
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <Text style={[mo.title, { fontFamily: T.font.serif }]}>{title}</Text>
                <Text style={[mo.sub,   { fontFamily: T.font.sans  }]}>{subtitle}</Text>
              </View>
              <TouchableOpacity style={mo.close} onPress={onClose}>
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
            <View style={mo.body}>{children}</View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
const mo = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet:   { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  handle:  { width: 36, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginTop: 12 },
  head:    { flexDirection: "row", alignItems: "center", padding: 18, margin: 16, marginTop: 12, borderRadius: T.r.xl },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", justifyContent: "center", alignItems: "center" },
  title:   { color: "#fff", fontSize: 15, fontWeight: "700" },
  sub:     { color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "500", marginTop: 1 },
  close:   { width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  body:    { padding: 20 },
});

// ─── Amount Input ─────────────────────────────────────────
function AmountInput({ value, onChange, currency, accentColor, accentBg }: {
  value: string; onChange: (v: string) => void;
  currency: string; accentColor: string; accentBg: string;
}) {
  return (
    <View style={[ai.row, { borderColor: T.border }]}>
      <TextInput style={[ai.input, { fontFamily: T.font.serif }]} value={value} onChangeText={onChange} keyboardType="numeric" placeholder="0" placeholderTextColor={T.textMuted} autoFocus underlineColorAndroid="transparent" />
      <View style={[ai.suffix, { backgroundColor: accentBg }]}>
        <Text style={[ai.suffixTxt, { color: accentColor, fontFamily: T.font.mono }]}>{currency}</Text>
      </View>
    </View>
  );
}
const ai = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: T.r.md, overflow: "hidden", marginBottom: 14, backgroundColor: "#F8FAFF" },
  input:     { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 22, color: T.text, fontWeight: "700" },
  suffix:    { paddingHorizontal: 12, paddingVertical: 12, borderLeftWidth: 1, borderLeftColor: T.border },
  suffixTxt: { fontSize: 11, fontWeight: "900" },
});

// ─── Quick Amounts ────────────────────────────────────────
function QuickAmounts({ amounts, selected, onSelect, color }: {
  amounts: number[]; selected: string; onSelect: (v: string) => void; color: string;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
      {amounts.map((v) => {
        const sel = selected === String(v);
        return (
          <TouchableOpacity
            key={v}
            style={[qa.btn, { backgroundColor: sel ? `${color}12` : "#F8FAFF", borderColor: sel ? `${color}40` : T.border }]}
            onPress={() => onSelect(String(v))} activeOpacity={0.8}
          >
            <Text style={[qa.txt, { color: sel ? color : T.textSoft, fontFamily: T.font.mono }]}>
              {new Intl.NumberFormat("fr-FR").format(v)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const qa = StyleSheet.create({
  btn: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, borderWidth: 1 },
  txt: { fontSize: 12, fontWeight: "700" },
});

// ─── Confirm Button ───────────────────────────────────────
function ConfirmBtn({ label, color, loading, onPress }: {
  label: string; color: string; loading: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[cb.btn, { shadowColor: color }, loading && { opacity: 0.65 }]} onPress={onPress} disabled={loading} activeOpacity={0.88}>
      <LinearGradient colors={[color, color + "CC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cb.grad}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={[cb.txt, { fontFamily: T.font.sans }]}>{label}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );
}
const cb = StyleSheet.create({
  btn:  { borderRadius: T.r.md, overflow: "hidden", marginBottom: 6, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 4 },
  grad: { paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  txt:  { color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 0.8 },
});

// ─── Currency Chip Selector ───────────────────────────────
// ⚠️ Non touché par le fix v9.2 : ce composant n'est utilisé QUE dans
// ModalSheet (une <Modal> RN — rendu dans une couche/portail séparée
// du ScrollView vertical principal), il ne peut donc pas entrer en
// conflit de responder avec lui. Le conserver en ScrollView natif ici
// ne pose aucun problème.
function CurrencyChipSelector({ selected, onSelect }: {
  selected: CurrencyCode; onSelect: (c: CurrencyCode) => void;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[{ fontSize: 9, fontWeight: "900" as const, color: T.textMuted, letterSpacing: 1.5, marginBottom: 8 }, { fontFamily: T.font.sans }]}>
        DEVISE DU VIREMENT
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {CURRENCIES_ORDER.map((cur) => {
          const cfg = CURRENCIES[cur];
          const sel = selected === cur;
          return (
            <TouchableOpacity key={cur} onPress={() => onSelect(cur)} activeOpacity={0.8}
              style={[ccs.chip, { backgroundColor: sel ? cfg.bg : T.surface, borderColor: sel ? cfg.color : T.border }]}>
              <Text style={{ fontSize: 14 }}>{cfg.flag}</Text>
              <Text style={[ccs.code, { color: sel ? cfg.color : T.textSoft, fontFamily: T.font.sans }]}>{cfg.code}</Text>
              {sel && <View style={[ccs.dot, { backgroundColor: cfg.color }]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
const ccs = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, borderWidth: 1.5 },
  code: { fontSize: 11, fontWeight: "800" },
  dot:  { width: 5, height: 5, borderRadius: 99 },
});

// ─── HeroConcave (conservé mais non rendu en v9.0) ────────
function HeroConcave() {
  const d  = `M 0 0 L 0 ${CONCAVE_H} Q ${SW / 2} 0 ${SW} ${CONCAVE_H} L ${SW} 0 Z`;
  const bd = `M 0 ${CONCAVE_H} Q ${SW / 2} 0 ${SW} ${CONCAVE_H}`;
  return (
    <Svg width={SW} height={CONCAVE_H} style={{ marginTop: -1 }}>
      <Rect x={0} y={0} width={SW} height={CONCAVE_H} fill="#FFFFFF" />
      <Path d={d} fill="#2563EB" />
      <Path d={bd} fill="none" stroke="rgba(37,99,235,0.20)" strokeWidth={1.5} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────
export default function CompanyDashboard() {
  const router   = useRouter();
  const { user } = useAuth();

  const [wallets,    setWallets]    = useState<any[]>([]);
  const [agencies,   setAgencies]   = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCur,  setActiveCur]  = useState(0);

  const [modalFill,   setModalFill]   = useState(false);
  const [modalB2B,    setModalB2B]    = useState(false);
  const [modalAgency, setModalAgency] = useState(false);

  const [fillCur,     setFillCur]     = useState<CurrencyCode>("XOF");
  const [fillAmount,  setFillAmount]  = useState("");
  const [loadingFill, setLoadingFill] = useState(false);

  const [amountB2B,  setAmountB2B]  = useState("");
  const [refB2B,     setRefB2B]     = useState("");
  const [loadingB2B, setLoadingB2B] = useState(false);
  const [b2bCur,     setB2bCur]     = useState<CurrencyCode>("XOF");

  const [agencyAmount,  setAgencyAmount]  = useState("");
  const [loadingAgency, setLoadingAgency] = useState(false);
  const targetAgencyRef = useRef<any>(null);
  const [targetAgency,  setTargetAgency]  = useState<any>(null);

  const headerAnim = useRef(new Animated.Value(0)).current;

  const clientName     = user?.client?.name ?? user?.firstName ?? "Ma Société";
  const totalAgencies  = agencies.length;
  const activeAgencies = agencies.filter((a) => a.isActive !== false).length;

  const today = useMemo(() => new Date().toLocaleDateString("fr-FR", {
    weekday: "short", day: "numeric", month: "long",
  }), []);

  const loadData = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "refresh") setRefreshing(true);
    try {
      const [wRes, aRes] = await Promise.allSettled([api.getMyWallets(), api.getAgencies()]);
      if (wRes.status === "fulfilled") setWallets(Array.isArray(wRes.value) ? wRes.value : []);
      if (aRes.status === "fulfilled") setAgencies(Array.isArray(aRes.value) ? aRes.value : []);
    } catch { /* noop */ }
    finally { setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadData("init");
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
  }, [loadData]));

  const openAgencyModal = useCallback((agency: any) => {
    targetAgencyRef.current = agency;
    setTargetAgency(agency);
    setAgencyAmount("");
    setModalAgency(true);
  }, []);

  const handleFill = async () => {
    const n = Number(fillAmount.replace(/\s/g, "").replace(",", "."));
    if (!n || n <= 0) { Alert.alert("Montant invalide", "Saisissez un montant supérieur à 0."); return; }
    setLoadingFill(true);
    try {
      await api.adminFundSelf(n, fillCur);
      setModalFill(false); setFillAmount("");
      Alert.alert("✅ Alimenté", `${fmt(n, fillCur)} ${CURRENCIES[fillCur].symbol} ajoutés à votre caisse.`);
      await loadData();
    } catch (e: any) {
      Alert.alert("Erreur", Array.isArray(e?.response?.data?.message) ? e.response.data.message[0] : (e?.response?.data?.message || "Erreur technique"));
    } finally { setLoadingFill(false); }
  };

  const handleB2B = async () => {
    const n = Number(amountB2B.replace(/\s/g, "").replace(",", "."));
    if (!n || n <= 0) { Alert.alert("Montant invalide", "Saisissez un montant supérieur à 0."); return; }
    setLoadingB2B(true);
    const resetB2B = () => { setModalB2B(false); setAmountB2B(""); setRefB2B(""); setB2bCur("XOF"); };
    try {
      await api.declareBankTransfer(n, refB2B.trim() || undefined, b2bCur);
      resetB2B();
      Alert.alert("✅ Virement déclaré", `${fmt(n, b2bCur)} ${CURRENCIES[b2bCur].symbol} envoyé pour validation Super Admin.`);
    } catch (e: any) {
      const httpStatus: number | undefined = e?.response?.status;
      const isTimeout = e?.code === "ECONNABORTED" || String(e?.message ?? "").toLowerCase().includes("timeout");
      const is2xx     = httpStatus !== undefined && httpStatus >= 200 && httpStatus < 300;
      if (isTimeout || is2xx) { resetB2B(); Alert.alert("✅ Virement déclaré", "Transaction créée avec succès."); return; }
      Alert.alert("Erreur", Array.isArray(e?.response?.data?.message) ? e.response.data.message[0] : (e?.response?.data?.message || e?.message || "Erreur réseau"));
    } finally { setLoadingB2B(false); }
  };

  const handleAgencyRefill = async () => {
    const agency = targetAgencyRef.current;
    if (!agency) return;
    const n = Number(agencyAmount.replace(/\s/g, "").replace(",", "."));
    if (!n || n <= 0) { Alert.alert("Montant invalide", "Saisissez un montant supérieur à 0."); return; }
    const agencyWallets = Array.isArray(agency.wallets) ? agency.wallets : [];
    const primaryWallet = agencyWallets.find((w: any) => w.isDefault) ?? agencyWallets[0];
    const currency: string = primaryWallet?.currency ?? agency.primaryCurrency ?? "XOF";
    setLoadingAgency(true);
    try {
      await api.adminRefillAgency(agency.id, n, currency);
      setModalAgency(false); setAgencyAmount(""); targetAgencyRef.current = null;
      Alert.alert("✅ Rechargé", `${agency.name} crédité de ${fmt(n, currency)} ${(CURRENCIES[currency as CurrencyCode] ?? CURRENCIES.XOF).symbol}.`);
      await loadData();
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.message || "Erreur technique");
    } finally { setLoadingAgency(false); }
  };

  const agencyCurrency = (() => {
    const a = targetAgencyRef.current;
    if (!a) return "XOF";
    const ws = Array.isArray(a.wallets) ? a.wallets : [];
    const pw = ws.find((w: any) => w.isDefault) ?? ws[0];
    return pw?.currency ?? a.primaryCurrency ?? "XOF";
  })();

  const fillCfg = CURRENCIES[fillCur];

  return (
    <SafeAreaView style={s.safe}>
      {/* ✅ v9.0 : StatusBar blanc sur fond héro bleu */}
      <StatusBar barStyle="light-content" backgroundColor={HERO_FROM} />

      {/* ══════════ HÉRO BLEU RECTANGULAIRE ══════════ */}
      <Animated.View style={{
        opacity:   headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
      }}>
        {/* ✅ v9.0 : LinearGradient bleu + borderRadius bas + ombre portée */}
        <LinearGradient
          colors={[HERO_FROM, HERO_TO]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          {/* Glows décoratifs semi-transparents */}
          <View style={s.heroGlow1} />
          <View style={s.heroGlow2} />

          {/* ── Ligne société ── */}
          <View style={s.heroRow}>
            <View style={s.avatar}>
              <Text style={[s.avatarTxt, { fontFamily: T.font.serif }]}>
                {(clientName[0] ?? "E").toUpperCase()}
              </Text>
              <View style={s.avatarOnline} />
            </View>

            <View style={{ flex: 1, paddingLeft: 10 }}>
              <View style={s.heroBadge}>
                <View style={s.heroBadgeDot} />
                <Text style={[s.heroBadgeTxt, { fontFamily: T.font.sans }]}>ADMIN SOCIÉTÉ</Text>
              </View>
              <Text style={[s.heroTitle, { fontFamily: T.font.serif }]} numberOfLines={1}>
                {clientName}
              </Text>
            </View>

            <View style={s.heroActions}>
              <TouchableOpacity style={s.heroBtn} onPress={() => void loadData("refresh")}>
                <Ionicons name="refresh" size={15} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={s.heroBtn} onPress={() => router.push("/(tabs)/notifications")}>
                <Ionicons name="notifications-outline" size={15} color="#fff" />
                <View style={s.notifDot} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Welcome + date ── */}
          <View style={s.heroWelcome}>
            <Text style={[s.heroWelcomeTxt, { fontFamily: T.font.sans }]}>
              Bonjour,{" "}
              <Text style={{ fontWeight: "700", color: "#fff" }}>
                {user?.firstName || "Admin"} 👋
              </Text>
            </Text>
            <View style={s.datePill}>
              <Ionicons name="calendar-outline" size={10} color="rgba(255,255,255,0.8)" />
              <Text style={[s.dateTxt, { fontFamily: T.font.sans }]}>{today}</Text>
            </View>
          </View>
        </LinearGradient>
        {/* ✅ v9.0 : HeroConcave supprimé → forme rectangulaire */}
      </Animated.View>

      {/* ══════════ SCROLL CONTENT ══════════ */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadData("refresh")} tintColor={T.primary} />
        }
      >
        {/* ── Carte stats ── */}
        <View style={s.statsCard}>
          <View style={s.statsItem}>
            <Text style={[s.statsVal, { fontFamily: T.font.serif }]}>{totalAgencies}</Text>
            <Text style={[s.statsLbl, { fontFamily: T.font.sans }]}>AGENCES</Text>
          </View>
          <View style={s.statsSep} />
          <View style={s.statsItem}>
            <Text style={[s.statsVal, { fontFamily: T.font.serif }]}>{activeAgencies}</Text>
            <Text style={[s.statsLbl, { fontFamily: T.font.sans }]}>ACTIVES</Text>
          </View>
          <View style={s.statsSep} />
          <View style={s.statsItem}>
            <Text style={[s.statsVal, { fontFamily: T.font.serif }]}>{CURRENCIES_ORDER.length}</Text>
            <Text style={[s.statsLbl, { fontFamily: T.font.sans }]}>DEVISES</Text>
          </View>
        </View>

        {/* Trésorerie */}
        <View style={s.secRow}>
          <View style={[s.secDot, { backgroundColor: T.warning }]} />
          <Text style={[s.secLbl, { fontFamily: T.font.sans }]}>TRÉSORERIE · 5 DEVISES</Text>
        </View>

        <WalletCarousel wallets={wallets} activeCur={activeCur} setActiveCur={setActiveCur} />

        {/* Sélecteur devise — ✅ v9.2 : HScroller (voir changelog) au lieu
            d'un ScrollView imbriqué directement dans le ScrollView vertical
            principal ci-dessus. */}
        <HScroller contentContainerStyle={{ gap: 6, paddingRight: 4, marginBottom: 12 }}>
          {CURRENCIES_ORDER.map((cur) => {
            const cfg = CURRENCIES[cur];
            const sel = fillCur === cur;
            return (
              <TouchableOpacity key={cur} onPress={() => setFillCur(cur)} activeOpacity={0.8}
                style={[s.chip, { backgroundColor: sel ? cfg.bg : T.surface, borderColor: sel ? cfg.color : T.border }]}>
                <Text style={{ fontSize: 12 }}>{cfg.flag}</Text>
                <Text style={[s.chipTxt, { color: sel ? T.text : T.textSoft, fontFamily: T.font.sans }]}>{cfg.code}</Text>
                {sel && <View style={[s.chipDot, { backgroundColor: cfg.color }]} />}
              </TouchableOpacity>
            );
          })}
        </HScroller>

        {/* ✅ v9.0 — BOUTON ALIMENTER : blanc + ombre verte accentuée */}
        <TouchableOpacity
          style={[s.actionStrip, s.actionStripGreen]}
          onPress={() => setModalFill(true)}
          activeOpacity={0.92}
        >
          <View style={[s.actionStripIcon, { backgroundColor: T.successSoft }]}>
            <Ionicons name="add-circle-outline" size={22} color={T.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.actionStripTitle, { color: T.successDark, fontFamily: T.font.sans }]}>
              Alimenter en {fillCur}
            </Text>
            <Text style={[s.actionStripSub, { color: T.textSoft, fontFamily: T.font.sans }]}>
              Injection directe · {fillCfg.name}
            </Text>
          </View>
          <View style={[s.actionStripArrow, { backgroundColor: T.successSoft }]}>
            <Ionicons name="arrow-forward" size={14} color={T.success} />
          </View>
        </TouchableOpacity>

        {/* ✅ v9.0 — BOUTON B2B : blanc + ombre indigo accentuée */}
        <TouchableOpacity
          style={[s.actionStrip, s.actionStripBlue]}
          onPress={() => setModalB2B(true)}
          activeOpacity={0.92}
        >
          <View style={[s.actionStripIcon, { backgroundColor: T.primaryPale }]}>
            <Ionicons name="swap-horizontal-outline" size={22} color={T.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.actionStripTitle, { color: T.primaryDark, fontFamily: T.font.sans }]}>
              Déclarer un Virement B2B
            </Text>
            <Text style={[s.actionStripSub, { color: T.textSoft, fontFamily: T.font.sans }]}>
              En attente de validation Super Admin
            </Text>
          </View>
          <View style={[s.actionStripArrow, { backgroundColor: T.primaryPale }]}>
            <Ionicons name="arrow-forward" size={14} color={T.primary} />
          </View>
        </TouchableOpacity>

        {/* ── Pilotage société ── */}
        <View style={[s.secRow, { marginTop: 8 }]}>
          <View style={[s.secDot, { backgroundColor: T.primary }]} />
          <Text style={[s.secLbl, { fontFamily: T.font.sans }]}>PILOTAGE SOCIÉTÉ</Text>
        </View>
        <View style={s.grid}>
          <ActionCard title="Transactions"        subtitle="Historique & suivi"   icon="list-outline"       color={T.primary}  bg={T.primaryPale}   onPress={() => router.push("/(tabs)/admin/transactions")} />
          <ActionCard title="Agences"             subtitle="Réseau & gestion"     icon="storefront-outline" color={T.success}  bg={T.successSoft}   onPress={() => router.push("/(tabs)/admin/agencies")} badge="Réseau" />
          <ActionCard title="Trésorerie"          subtitle="Vue détaillée"        icon="wallet-outline"     color={T.warning}  bg={T.warningSoft}   onPress={() => router.push("/(tabs)/admin/treasury")} />
          <ActionCard title="Frais & Commissions" subtitle="Taux par méthode"     icon="pricetag-outline"   color="#D97706"    bg="#FEF3C7"          onPress={() => router.push("/(tabs)/admin/fees")} />
          <ActionCard title="Paramètres"          subtitle="Compte & société"     icon="settings-outline"   color="#7C3AED"    bg="#F5F3FF"          onPress={() => router.push("/(tabs)/admin/settings")} />
          {/* ✅ v8.1 : Clients Wallet */}
          <ActionCard title="Clients Wallet"      subtitle="Gestion des comptes"  icon="people-outline"     color="#F97316"    bg="#FFF7ED"          onPress={() => router.push("/(tabs)/admin/wallet-clients" as any)} />
          {/* ✅ v9.1 — NOUVEAU : Retrait Agence (fonds agence → société) */}
          <ActionCard title="Retrait Agence"      subtitle="Fonds agence → société" icon="arrow-down-circle-outline" color="#DC2626" bg="#FEF2F2" onPress={() => router.push("/(tabs)/admin/agency-withdrawal" as any)} />
        </View>

        {/* Agences */}
        {agencies.length > 0 && (
          <>
            <View style={s.secRow}>
              <View style={[s.secDot, { backgroundColor: T.success }]} />
              <Text style={[s.secLbl, { fontFamily: T.font.sans }]}>AGENCES DU RÉSEAU · {totalAgencies}</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/admin/agencies")} style={{ marginLeft: "auto" }}>
                <Text style={[s.seeAll, { fontFamily: T.font.sans }]}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            {agencies.slice(0, 5).map((a) => (
              <AgencyCard key={a.id} agency={a} onRefill={() => openAgencyModal(a)} />
            ))}
            {agencies.length > 5 && (
              <TouchableOpacity style={s.moreBtn} onPress={() => router.push("/(tabs)/admin/agencies")} activeOpacity={0.8}>
                <Text style={[s.moreTxt, { fontFamily: T.font.sans }]}>
                  Voir les {agencies.length - 5} autres agences
                </Text>
                <Ionicons name="chevron-forward" size={13} color={T.primary} />
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ── Modal Alimenter ── */}
      <ModalSheet visible={modalFill} onClose={() => { setModalFill(false); setFillAmount(""); }} title="Alimenter ma Caisse" subtitle={`Injection directe · ${fillCur}`} gradColors={[T.success, T.successDark]}>
        <AmountInput value={fillAmount} onChange={setFillAmount} currency={fillCur} accentColor={T.success} accentBg={T.successSoft} />
        <QuickAmounts amounts={[100000, 500000, 1000000, 5000000]} selected={fillAmount} onSelect={setFillAmount} color={T.success} />
        <ConfirmBtn label={`INJECTER ${fillAmount ? fmt(Number(fillAmount), fillCur) : "—"} ${fillCur}`} color={T.success} loading={loadingFill} onPress={handleFill} />
        <TouchableOpacity onPress={() => { setModalFill(false); setFillAmount(""); }} style={{ alignItems: "center", paddingVertical: 14 }}>
          <Text style={[{ color: T.textSoft, fontWeight: "600", fontSize: 13 }, { fontFamily: T.font.sans }]}>Annuler</Text>
        </TouchableOpacity>
      </ModalSheet>

      {/* ── Modal B2B ── */}
      <ModalSheet visible={modalB2B} onClose={() => { setModalB2B(false); setAmountB2B(""); setRefB2B(""); setB2bCur("XOF"); }} title="Déclarer un Virement" subtitle="Alimentation B2B · en attente validation" gradColors={[T.primary, T.primaryDark]}>
        <CurrencyChipSelector selected={b2bCur} onSelect={setB2bCur} />
        <AmountInput value={amountB2B} onChange={setAmountB2B} currency={b2bCur} accentColor={CURRENCIES[b2bCur].color} accentBg={CURRENCIES[b2bCur].bg} />
        <Text style={[{ fontSize: 9, fontWeight: "900" as const, color: T.textMuted, letterSpacing: 1.5, marginBottom: 8 }, { fontFamily: T.font.sans }]}>RÉFÉRENCE BANCAIRE</Text>
        <TextInput
          style={[{ backgroundColor: "#F8FAFF", borderWidth: 1.5, borderColor: T.border, borderRadius: T.r.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.text, marginBottom: 16, fontFamily: T.font.mono }]}
          value={refB2B} onChangeText={setRefB2B} placeholder="REF-VIREMENT-XXXX" placeholderTextColor={T.textMuted} autoCapitalize="characters" underlineColorAndroid="transparent"
        />
        <ConfirmBtn label={`ENVOYER ${amountB2B ? fmt(Number(amountB2B), b2bCur) : "—"} ${b2bCur}`} color={CURRENCIES[b2bCur].color} loading={loadingB2B} onPress={handleB2B} />
        <TouchableOpacity onPress={() => { setModalB2B(false); setAmountB2B(""); setRefB2B(""); setB2bCur("XOF"); }} style={{ alignItems: "center", paddingVertical: 14 }}>
          <Text style={[{ color: T.textSoft, fontWeight: "600", fontSize: 13 }, { fontFamily: T.font.sans }]}>Annuler</Text>
        </TouchableOpacity>
      </ModalSheet>

      {/* ── Modal Recharge Agence ── */}
      <ModalSheet visible={modalAgency} onClose={() => { setModalAgency(false); setAgencyAmount(""); targetAgencyRef.current = null; }} title="Recharger l'Agence" subtitle={targetAgency?.name || "—"} gradColors={["#7C3AED", "#6D28D9"]}>
        <AmountInput value={agencyAmount} onChange={setAgencyAmount} currency={agencyCurrency} accentColor="#7C3AED" accentBg="#F5F3FF" />
        <QuickAmounts amounts={[50000, 100000, 500000, 1000000]} selected={agencyAmount} onSelect={setAgencyAmount} color="#7C3AED" />
        <ConfirmBtn label={`TRANSFÉRER ${agencyAmount ? fmt(Number(agencyAmount), agencyCurrency) : "—"} ${agencyCurrency}`} color="#7C3AED" loading={loadingAgency} onPress={handleAgencyRefill} />
        <TouchableOpacity onPress={() => { setModalAgency(false); setAgencyAmount(""); targetAgencyRef.current = null; }} style={{ alignItems: "center", paddingVertical: 14 }}>
          <Text style={[{ color: T.textSoft, fontWeight: "600", fontSize: 13 }, { fontFamily: T.font.sans }]}>Annuler</Text>
        </TouchableOpacity>
      </ModalSheet>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────
const s = StyleSheet.create({
  // ✅ v9.0 : fond global blanc pur
  safe: { flex: 1, backgroundColor: "#FFFFFF" },

  // ✅ v9.0 : Héro bleu rectangulaire — plus de concave
  hero: {
    paddingTop:    Platform.OS === "android" ? 44 : 14,
    paddingBottom: 32,
    paddingHorizontal: 18,
    borderBottomLeftRadius:  28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
    // Ombre portée bleue profonde
    shadowColor:   "#1D4ED8",
    shadowOffset:  { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius:  24,
    elevation:     14,
  },

  // Glows décoratifs dans le héro
  heroGlow1: {
    position: "absolute", width: 300, height: 300, borderRadius: 150,
    backgroundColor: "rgba(255,255,255,0.07)", top: -120, right: -80,
  },
  heroGlow2: {
    position: "absolute", width: 180, height: 180, borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.05)", bottom: -60, left: -40,
  },

  heroRow:     { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  avatar:      { width: 44, height: 44, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)", justifyContent: "center", alignItems: "center", position: "relative" },
  avatarTxt:   { color: "#fff", fontSize: 18, fontWeight: "900" },
  avatarOnline:{ position: "absolute", bottom: -1, right: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: "#34D399", borderWidth: 2, borderColor: HERO_FROM },
  heroBadge:   { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.30)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start", marginBottom: 4 },
  heroBadgeDot:{ width: 5, height: 5, borderRadius: 99, backgroundColor: "#34D399" },
  heroBadgeTxt:{ color: "#fff", fontSize: 8, fontWeight: "700", letterSpacing: 1.2 },
  heroTitle:   { color: "#fff", fontSize: 17, fontWeight: "700" },
  heroActions: { flexDirection: "row", gap: 8, marginLeft: 10 },
  heroBtn:     { width: 36, height: 36, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", justifyContent: "center", alignItems: "center", position: "relative" },
  notifDot:    { position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: 99, backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: HERO_FROM },

  heroWelcome:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroWelcomeTxt:{ color: "rgba(255,255,255,0.85)", fontSize: 13 },
  datePill:      { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  dateTxt:       { color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "600" },

  // Carte stats
  statsCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: T.r.xl, borderWidth: 1, borderColor: "#EEF2FF",
    paddingVertical: 14, paddingHorizontal: 8, marginBottom: 18,
    shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  statsItem: { flex: 1, alignItems: "center" },
  statsVal:  { color: T.primary, fontSize: 22, fontWeight: "700", lineHeight: 24 },
  statsLbl:  { color: T.textMuted, fontSize: 7, fontWeight: "700", letterSpacing: 1.2, marginTop: 3 },
  statsSep:  { width: 1, height: 28, backgroundColor: T.border },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  secRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  secDot: { width: 5, height: 5, borderRadius: 99 },
  secLbl: { fontSize: 9, fontWeight: "700", color: T.textSoft, letterSpacing: 1.5 },
  seeAll: { fontSize: 11, fontWeight: "600", color: T.primary },

  chip:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1 },
  chipTxt: { fontSize: 10, fontWeight: "700" },
  chipDot: { width: 4, height: 4, borderRadius: 99 },

  // ✅ v9.0 : boutons blancs avec ombres accentuées colorées (effet flottant)
  actionStrip: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },
  // Ombre verte pour "Alimenter"
  actionStripGreen: {
    shadowColor:   "#059669",
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius:  20,
    elevation:     8,
  },
  // Ombre indigo pour "Déclarer B2B"
  actionStripBlue: {
    shadowColor:   "#4F46E5",
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius:  20,
    elevation:     8,
    marginBottom: 18,
  },
  actionStripIcon:  { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  actionStripTitle: { fontSize: 14, fontWeight: "700", marginBottom: 3 },
  actionStripSub:   { fontSize: 11, fontWeight: "500" },
  actionStripArrow: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },

  grid:    { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 8 },
  moreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 12, backgroundColor: "#FFFFFF", borderRadius: T.r.xl, borderWidth: 1, borderColor: T.border, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  moreTxt: { color: T.primary, fontSize: 11, fontWeight: "600" },
});