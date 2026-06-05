// apps/direct-transfair-mobile/components/dashboards/CompanyDashboard.tsx
// =========================================================
// COMPANY ADMIN DASHBOARD v7.0 — Direct Transf'air
// ✅ v6.4 : toutes corrections fonctionnelles conservées
// ✅ v7.0 : refonte visuelle complète — thème 100% clair
//    - Hero : fond blanc, accent indigo, typographie sombre
//    - Boutons "Alimenter" et "B2B" : style verre/outlined (no dark)
//    - StatusBar dark-content cohérente avec le fond clair
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
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const { width: SW } = Dimensions.get("window");
const CARD_W = (SW - 48 - 8) / 2;

const CURRENCIES_ORDER = ["XOF", "EUR", "USD", "GNF", "GBP"] as const;
type CurrencyCode = (typeof CURRENCIES_ORDER)[number];

const CURRENCIES: Record<CurrencyCode, {
  code: CurrencyCode; symbol: string; flag: string;
  color: string; bg: string; name: string;
}> = {
  XOF: { code: "XOF", symbol: "CFA", flag: "🌍", color: "#D97706", bg: "#FEF3C7", name: "Franc CFA" },
  EUR: { code: "EUR", symbol: "€",   flag: "🇪🇺", color: "#2563EB", bg: "#EFF6FF", name: "Euro" },
  USD: { code: "USD", symbol: "$",   flag: "🇺🇸", color: "#059669", bg: "#ECFDF5", name: "Dollar US" },
  GNF: { code: "GNF", symbol: "FG",  flag: "🇬🇳", color: "#DC2626", bg: "#FEF2F2", name: "Franc Guinéen" },
  GBP: { code: "GBP", symbol: "£",   flag: "🇬🇧", color: "#7C3AED", bg: "#F5F3FF", name: "Livre Sterling" },
};

// ─── Design tokens v7 — thème 100% clair ────────────────
const T = {
  pageBg:        "#F4F6FF",
  surface:       "#FFFFFF",
  border:        "#E4E9F5",
  borderSoft:    "#F0F3FB",

  primary:       "#4F46E5",   // Indigo — plus doux que #1A3FCB
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
    serif: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace" }),
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
  card:   { backgroundColor: T.surface, borderRadius: T.r.lg, borderWidth: 1, borderColor: T.border, overflow: "hidden", paddingBottom: 12 },
  topBar: { height: 3, width: "100%", marginBottom: 9 },
  header: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, marginBottom: 8 },
  flag:   { width: 24, height: 24, borderRadius: 7, justifyContent: "center", alignItems: "center" },
  code:   { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  name:   { fontSize: 8, color: T.textSoft, fontWeight: "400", marginTop: 1 },
  lbl:    { fontSize: 7, fontWeight: "700", color: T.textMuted, letterSpacing: 1.2, marginBottom: 2, paddingHorizontal: 10 },
  amount: { fontSize: 16, fontWeight: "700", color: T.text, lineHeight: 19, paddingHorizontal: 10, marginBottom: 2 },
  sym:    { fontSize: 9, fontWeight: "700", paddingHorizontal: 10, marginTop: 2 },
});

// ─── Carousel ─────────────────────────────────────────────
function WalletCarousel({ wallets, activeCur, setActiveCur }: {
  wallets: any[]; activeCur: number; setActiveCur: (i: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [dotIdx, setDotIdx] = useState(0);

  const getBalance = useCallback((c: string) => {
    const w = wallets.find((x) => x.currency === c);
    return toNum(w?.balance ?? w?.availableBalance ?? 0);
  }, [wallets]);

  return (
    <View style={{ marginBottom: 10 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + 8}
        decelerationRate="fast"
        snapToAlignment="start"
        contentContainerStyle={{ paddingRight: 16 }}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + 8));
          const clamped = Math.max(0, Math.min(idx, CURRENCIES_ORDER.length - 1));
          setDotIdx(clamped);
          if (clamped !== activeCur) setActiveCur(clamped);
        }}
      >
        {CURRENCIES_ORDER.map((c) => (
          <View key={c} style={{ marginRight: 8 }}>
            <WalletCard currency={c} balance={getBalance(c)} />
          </View>
        ))}
      </ScrollView>
      <View style={car.dots}>
        {CURRENCIES_ORDER.map((c, i) => {
          const cfg = CURRENCIES[c];
          const isActive = i === dotIdx;
          return (
            <TouchableOpacity
              key={c} hitSlop={8}
              onPress={() => {
                setDotIdx(i);
                setActiveCur(i);
                scrollRef.current?.scrollTo({ x: i * (CARD_W + 8), animated: true });
              }}
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
    <Animated.View style={{ width: "48%", marginBottom: 8, transform: [{ scale }] }}>
      <TouchableOpacity
        style={ac.card} onPress={onPress} activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
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
        <Text style={[ac.sub, { fontFamily: T.font.sans }]} numberOfLines={2}>{subtitle}</Text>
        <View style={[ac.arrow, { backgroundColor: bg }]}>
          <Ionicons name="arrow-forward" size={10} color={color} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const ac = StyleSheet.create({
  card:     { backgroundColor: T.surface, borderRadius: T.r.lg, padding: 12, borderWidth: 1, borderColor: T.border, overflow: "hidden" },
  top:      { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  icon:     { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  badge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeTxt: { fontSize: 8, fontWeight: "700" },
  title:    { fontSize: 12, fontWeight: "600", color: T.text, marginBottom: 3 },
  sub:      { fontSize: 10, color: T.textSoft, fontWeight: "400", lineHeight: 14, paddingBottom: 12 },
  arrow:    { position: "absolute", right: 10, bottom: 10, width: 18, height: 18, borderRadius: 6, justifyContent: "center", alignItems: "center" },
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
            borderColor: isActive ? T.successBorder : T.dangerBorder,
          }]}>
            <View style={[ag.dot, { backgroundColor: isActive ? T.success : T.danger }]} />
            <Text style={[ag.statusTxt, { color: isActive ? T.success : T.danger, fontFamily: T.font.sans }]}>
              {isActive ? "Opérationnelle" : "Suspendue"}
            </Text>
          </View>
          <TouchableOpacity style={ag.refillBtn} onPress={onRefill} activeOpacity={0.8}>
            <LinearGradient
              colors={[T.primary, T.primaryDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={ag.refillGrad}
            >
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
  card:      { backgroundColor: T.surface, borderRadius: T.r.lg, marginBottom: 8, borderWidth: 1, borderColor: T.border, flexDirection: "row", overflow: "hidden" },
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
                <Text style={[mo.sub, { fontFamily: T.font.sans }]}>{subtitle}</Text>
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
  head:    { flexDirection: "row", alignItems: "center", padding: 18, margin: 16, marginTop: 12, borderRadius: T.r.lg },
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
      <TextInput
        style={[ai.input, { fontFamily: T.font.serif }]}
        value={value} onChangeText={onChange}
        keyboardType="numeric" placeholder="0"
        placeholderTextColor={T.textMuted} autoFocus
        underlineColorAndroid="transparent"
      />
      <View style={[ai.suffix, { backgroundColor: accentBg }]}>
        <Text style={[ai.suffixTxt, { color: accentColor, fontFamily: T.font.mono }]}>{currency}</Text>
      </View>
    </View>
  );
}
const ai = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: T.r.md, overflow: "hidden", marginBottom: 14, backgroundColor: T.pageBg },
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
            style={[qa.btn, { backgroundColor: sel ? `${color}12` : T.pageBg, borderColor: sel ? `${color}40` : T.border }]}
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
  txt: { fontSize: 11, fontWeight: "700" },
});

// ─── Confirm Button ───────────────────────────────────────
function ConfirmBtn({ label, color, loading, onPress }: {
  label: string; color: string; loading: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[cb.btn, { shadowColor: color }, loading && { opacity: 0.65 }]}
      onPress={onPress} disabled={loading} activeOpacity={0.88}
    >
      <LinearGradient colors={[color, color + "CC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={cb.grad}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={[cb.txt, { fontFamily: T.font.sans }]}>{label}</Text>
        }
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
            <TouchableOpacity
              key={cur} onPress={() => onSelect(cur)} activeOpacity={0.8}
              style={[ccs.chip, { backgroundColor: sel ? cfg.bg : T.surface, borderColor: sel ? cfg.color : T.border }]}
            >
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
      const [wRes, aRes] = await Promise.allSettled([
        api.getMyWallets(),
        api.getAgencies(),
      ]);
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
      setModalFill(false);
      setFillAmount("");
      const cfg = CURRENCIES[fillCur];
      Alert.alert("✅ Alimenté", `${fmt(n, fillCur)} ${cfg.symbol} ajoutés à votre caisse.`);
      await loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Erreur technique";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally { setLoadingFill(false); }
  };

  const handleB2B = async () => {
    const n = Number(amountB2B.replace(/\s/g, "").replace(",", "."));
    if (!n || n <= 0) { Alert.alert("Montant invalide", "Saisissez un montant supérieur à 0."); return; }
    setLoadingB2B(true);

    const resetB2B = () => {
      setModalB2B(false);
      setAmountB2B("");
      setRefB2B("");
      setB2bCur("XOF");
    };

    try {
      await api.declareBankTransfer(n, refB2B.trim() || undefined, b2bCur);
      resetB2B();
      const cfg = CURRENCIES[b2bCur];
      Alert.alert("✅ Virement déclaré", `${fmt(n, b2bCur)} ${cfg.symbol} envoyé pour validation Super Admin.`);
    } catch (e: any) {
      const httpStatus: number | undefined = e?.response?.status;
      const isTimeout = e?.code === "ECONNABORTED" || String(e?.message ?? "").toLowerCase().includes("timeout");
      const is2xx = httpStatus !== undefined && httpStatus >= 200 && httpStatus < 300;

      if (isTimeout || is2xx) {
        resetB2B();
        Alert.alert("✅ Virement déclaré", "Transaction créée avec succès.");
        return;
      }
      const msg = e?.response?.data?.message || e?.message || "Erreur réseau";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : String(msg));
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
      setModalAgency(false);
      setAgencyAmount("");
      targetAgencyRef.current = null;
      const cfg = CURRENCIES[currency as CurrencyCode] ?? CURRENCIES.XOF;
      Alert.alert("✅ Rechargé", `${agency.name} crédité de ${fmt(n, currency)} ${cfg.symbol}.`);
      await loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Erreur technique";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
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
      {/* ✅ dark-content : cohérent avec le fond clair du hero */}
      <StatusBar barStyle="dark-content" backgroundColor={T.surface} />

      {/* ══════════ HERO — THÈME CLAIR v7 ══════════ */}
      <Animated.View style={[s.hero, {
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
      }]}>
        {/* Barre d'accent indigo fine en haut */}
        <View style={s.heroTopAccent} />

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
            <Text style={[s.heroTitle, { fontFamily: T.font.serif }]}>{clientName}</Text>
          </View>

          <View style={s.heroActions}>
            <TouchableOpacity style={s.heroBtn} onPress={() => void loadData("refresh")}>
              <Ionicons name="refresh" size={15} color={T.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.heroBtn}>
              <Ionicons name="notifications-outline" size={15} color={T.primary} />
              <View style={s.notifDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Welcome + date ── */}
        <View style={s.heroWelcome}>
          <Text style={[s.heroWelcomeTxt, { fontFamily: T.font.sans }]}>
            Bonjour, <Text style={{ fontWeight: "700", color: T.text }}>{user?.firstName || "Admin"} 👋</Text>
          </Text>
          <View style={s.datePill}>
            <Ionicons name="calendar-outline" size={10} color={T.primary} />
            <Text style={[s.dateTxt, { fontFamily: T.font.sans }]}>{today}</Text>
          </View>
        </View>

        {/* ── Stats strip ── */}
        <View style={s.heroStats}>
          <View style={s.heroStatItem}>
            <Text style={[s.heroStatVal, { fontFamily: T.font.serif }]}>{totalAgencies}</Text>
            <Text style={[s.heroStatLbl, { fontFamily: T.font.sans }]}>AGENCES</Text>
          </View>
          <View style={s.heroStatSep} />
          <View style={s.heroStatItem}>
            <Text style={[s.heroStatVal, { fontFamily: T.font.serif }]}>{activeAgencies}</Text>
            <Text style={[s.heroStatLbl, { fontFamily: T.font.sans }]}>ACTIVES</Text>
          </View>
          <View style={s.heroStatSep} />
          <View style={s.heroStatItem}>
            <Text style={[s.heroStatVal, { fontFamily: T.font.serif }]}>{CURRENCIES_ORDER.length}</Text>
            <Text style={[s.heroStatLbl, { fontFamily: T.font.sans }]}>DEVISES</Text>
          </View>
        </View>
      </Animated.View>

      {/* ══════════ SCROLL CONTENT ══════════ */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadData("refresh")}
            tintColor={T.primary}
          />
        }
      >
        {/* Trésorerie */}
        <View style={s.secRow}>
          <View style={[s.secDot, { backgroundColor: T.warning }]} />
          <Text style={[s.secLbl, { fontFamily: T.font.sans }]}>TRÉSORERIE · 5 DEVISES</Text>
        </View>

        <WalletCarousel wallets={wallets} activeCur={activeCur} setActiveCur={setActiveCur} />

        {/* Sélecteur devise */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingRight: 4, marginBottom: 10 }}
        >
          {CURRENCIES_ORDER.map((cur) => {
            const cfg = CURRENCIES[cur];
            const sel = fillCur === cur;
            return (
              <TouchableOpacity
                key={cur} onPress={() => setFillCur(cur)} activeOpacity={0.8}
                style={[s.chip, {
                  backgroundColor: sel ? cfg.bg : T.surface,
                  borderColor: sel ? cfg.color : T.border,
                }]}
              >
                <Text style={{ fontSize: 12 }}>{cfg.flag}</Text>
                <Text style={[s.chipTxt, { color: sel ? T.text : T.textSoft, fontFamily: T.font.sans }]}>{cfg.code}</Text>
                {sel && <View style={[s.chipDot, { backgroundColor: cfg.color }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Bouton Alimenter — verre vert ── */}
        <TouchableOpacity
          style={[s.actionStrip, {
            backgroundColor: T.successSoft,
            borderColor: T.successBorder,
          }]}
          onPress={() => setModalFill(true)}
          activeOpacity={0.85}
        >
          <View style={[s.actionStripIcon, { backgroundColor: "rgba(5,150,105,0.12)" }]}>
            <Ionicons name="add-circle-outline" size={18} color={T.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.actionStripTitle, { color: T.successDark, fontFamily: T.font.sans }]}>
              Alimenter en {fillCur}
            </Text>
            <Text style={[s.actionStripSub, { color: T.success, fontFamily: T.font.sans }]}>
              Injection directe · {fillCfg.name}
            </Text>
          </View>
          <View style={[s.actionStripArrow, { backgroundColor: T.successBorder }]}>
            <Ionicons name="arrow-forward" size={13} color={T.successDark} />
          </View>
        </TouchableOpacity>

        {/* ── Bouton B2B — verre indigo ── */}
        <TouchableOpacity
          style={[s.actionStrip, {
            backgroundColor: T.primaryPale,
            borderColor: T.primaryBorder,
            marginBottom: 16,
          }]}
          onPress={() => setModalB2B(true)}
          activeOpacity={0.85}
        >
          <View style={[s.actionStripIcon, { backgroundColor: "rgba(79,70,229,0.10)" }]}>
            <Ionicons name="swap-horizontal-outline" size={18} color={T.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.actionStripTitle, { color: T.primaryDark, fontFamily: T.font.sans }]}>
              Déclarer un Virement B2B
            </Text>
            <Text style={[s.actionStripSub, { color: T.primary, fontFamily: T.font.sans }]}>
              En attente de validation Super Admin
            </Text>
          </View>
          <View style={[s.actionStripArrow, { backgroundColor: T.primaryBorder }]}>
            <Ionicons name="arrow-forward" size={13} color={T.primaryDark} />
          </View>
        </TouchableOpacity>

        {/* Pilotage société */}
        <View style={s.secRow}>
          <View style={[s.secDot, { backgroundColor: T.primary }]} />
          <Text style={[s.secLbl, { fontFamily: T.font.sans }]}>PILOTAGE SOCIÉTÉ</Text>
        </View>
        <View style={s.grid}>
          <ActionCard title="Transactions"        subtitle="Historique & suivi"   icon="list-outline"       color={T.primary}  bg={T.primaryPale}   onPress={() => router.push("/(tabs)/admin/transactions")} />
          <ActionCard title="Agences"             subtitle="Réseau & gestion"     icon="storefront-outline" color={T.success}  bg={T.successSoft}   onPress={() => router.push("/(tabs)/admin/agencies")} badge="Réseau" />
          <ActionCard title="Trésorerie"          subtitle="Vue détaillée"        icon="wallet-outline"     color={T.warning}  bg={T.warningSoft}   onPress={() => router.push("/(tabs)/admin/treasury")} />
          <ActionCard title="Frais & Commissions" subtitle="Taux par méthode"     icon="pricetag-outline"   color="#D97706"    bg="#FEF3C7"          onPress={() => router.push("/(tabs)/admin/fees")} />
          <ActionCard title="Paramètres"          subtitle="Compte & société"     icon="settings-outline"   color="#7C3AED"    bg="#F5F3FF"          onPress={() => router.push("/(tabs)/admin/settings")} />
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
      <ModalSheet
        visible={modalFill}
        onClose={() => { setModalFill(false); setFillAmount(""); }}
        title="Alimenter ma Caisse"
        subtitle={`Injection directe · ${fillCur}`}
        gradColors={[T.success, T.successDark]}
      >
        <AmountInput value={fillAmount} onChange={setFillAmount} currency={fillCur} accentColor={T.success} accentBg={T.successSoft} />
        <QuickAmounts amounts={[100000, 500000, 1000000, 5000000]} selected={fillAmount} onSelect={setFillAmount} color={T.success} />
        <ConfirmBtn
          label={`INJECTER ${fillAmount ? fmt(Number(fillAmount), fillCur) : "—"} ${fillCur}`}
          color={T.success} loading={loadingFill} onPress={handleFill}
        />
        <TouchableOpacity onPress={() => { setModalFill(false); setFillAmount(""); }} style={{ alignItems: "center", paddingVertical: 14 }}>
          <Text style={[{ color: T.textSoft, fontWeight: "600", fontSize: 13 }, { fontFamily: T.font.sans }]}>Annuler</Text>
        </TouchableOpacity>
      </ModalSheet>

      {/* ── Modal B2B ── */}
      <ModalSheet
        visible={modalB2B}
        onClose={() => { setModalB2B(false); setAmountB2B(""); setRefB2B(""); setB2bCur("XOF"); }}
        title="Déclarer un Virement"
        subtitle="Alimentation B2B · en attente validation"
        gradColors={[T.primary, T.primaryDark]}
      >
        <CurrencyChipSelector selected={b2bCur} onSelect={setB2bCur} />
        <AmountInput
          value={amountB2B} onChange={setAmountB2B}
          currency={b2bCur}
          accentColor={CURRENCIES[b2bCur].color}
          accentBg={CURRENCIES[b2bCur].bg}
        />
        <Text style={[{ fontSize: 9, fontWeight: "900" as const, color: T.textMuted, letterSpacing: 1.5, marginBottom: 8 }, { fontFamily: T.font.sans }]}>
          RÉFÉRENCE BANCAIRE
        </Text>
        <TextInput
          style={[{
            backgroundColor: T.pageBg, borderWidth: 1.5, borderColor: T.border,
            borderRadius: T.r.md, paddingHorizontal: 14, paddingVertical: 12,
            fontSize: 14, color: T.text, marginBottom: 16, fontFamily: T.font.mono,
          }]}
          value={refB2B} onChangeText={setRefB2B}
          placeholder="REF-VIREMENT-XXXX" placeholderTextColor={T.textMuted}
          autoCapitalize="characters" underlineColorAndroid="transparent"
        />
        <ConfirmBtn
          label={`ENVOYER ${amountB2B ? fmt(Number(amountB2B), b2bCur) : "—"} ${b2bCur}`}
          color={CURRENCIES[b2bCur].color} loading={loadingB2B} onPress={handleB2B}
        />
        <TouchableOpacity
          onPress={() => { setModalB2B(false); setAmountB2B(""); setRefB2B(""); setB2bCur("XOF"); }}
          style={{ alignItems: "center", paddingVertical: 14 }}
        >
          <Text style={[{ color: T.textSoft, fontWeight: "600", fontSize: 13 }, { fontFamily: T.font.sans }]}>Annuler</Text>
        </TouchableOpacity>
      </ModalSheet>

      {/* ── Modal Recharge Agence ── */}
      <ModalSheet
        visible={modalAgency}
        onClose={() => { setModalAgency(false); setAgencyAmount(""); targetAgencyRef.current = null; }}
        title="Recharger l'Agence"
        subtitle={targetAgency?.name || "—"}
        gradColors={["#7C3AED", "#6D28D9"]}
      >
        <AmountInput
          value={agencyAmount} onChange={setAgencyAmount}
          currency={agencyCurrency} accentColor="#7C3AED" accentBg="#F5F3FF"
        />
        <QuickAmounts amounts={[50000, 100000, 500000, 1000000]} selected={agencyAmount} onSelect={setAgencyAmount} color="#7C3AED" />
        <ConfirmBtn
          label={`TRANSFÉRER ${agencyAmount ? fmt(Number(agencyAmount), agencyCurrency) : "—"} ${agencyCurrency}`}
          color="#7C3AED" loading={loadingAgency} onPress={handleAgencyRefill}
        />
        <TouchableOpacity
          onPress={() => { setModalAgency(false); setAgencyAmount(""); targetAgencyRef.current = null; }}
          style={{ alignItems: "center", paddingVertical: 14 }}
        >
          <Text style={[{ color: T.textSoft, fontWeight: "600", fontSize: 13 }, { fontFamily: T.font.sans }]}>Annuler</Text>
        </TouchableOpacity>
      </ModalSheet>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.pageBg },

  // ── Hero clair v7 ──
  hero: {
    backgroundColor: T.surface,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    // Légère ombre vers le bas
    shadowColor: T.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },

  // Accent couleur en haut du hero
  heroTopAccent: {
    height: 3,
    backgroundColor: T.primary,   // ligne indigo fine
  },

  heroRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 44 : 14,
    paddingBottom: 10,
  },

  avatar: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: T.primaryPale,
    borderWidth: 1.5, borderColor: T.primaryBorder,
    justifyContent: "center", alignItems: "center",
    position: "relative",
  },
  avatarTxt:    { color: T.primary, fontSize: 18, fontWeight: "800" },
  avatarOnline: { position: "absolute", bottom: -1, right: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: "#10B981", borderWidth: 2, borderColor: T.surface },

  heroBadge:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: T.primaryPale, borderWidth: 1, borderColor: T.primaryBorder, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start", marginBottom: 3 },
  heroBadgeDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: T.primary },
  heroBadgeTxt: { color: T.primary, fontSize: 8, fontWeight: "700", letterSpacing: 1.2 },
  heroTitle:    { color: T.text, fontSize: 16, fontWeight: "700" },

  heroActions: { flexDirection: "row", gap: 7 },
  heroBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.border,
    justifyContent: "center", alignItems: "center", position: "relative",
  },
  notifDot: { position: "absolute", top: 5, right: 5, width: 6, height: 6, borderRadius: 99, backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: T.surface },

  heroWelcome: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingBottom: 12,
  },
  heroWelcomeTxt: { color: T.textSoft, fontSize: 12 },
  datePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: T.pageBg, borderRadius: 99,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: T.border,
  },
  dateTxt: { color: T.textSoft, fontSize: 10, fontWeight: "600" },

  heroStats: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 18, marginBottom: 14,
    backgroundColor: T.pageBg,
    borderRadius: T.r.lg, borderWidth: 1, borderColor: T.border,
    paddingVertical: 10, paddingHorizontal: 8,
  },
  heroStatItem: { flex: 1, alignItems: "center" },
  heroStatVal:  { color: T.primary, fontSize: 22, fontWeight: "700", lineHeight: 24 },
  heroStatLbl:  { color: T.textMuted, fontSize: 7, fontWeight: "700", letterSpacing: 1.2, marginTop: 3 },
  heroStatSep:  { width: 1, height: 28, backgroundColor: T.border },

  // ── Body ──
  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  secRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  secDot: { width: 5, height: 5, borderRadius: 99 },
  secLbl: { fontSize: 9, fontWeight: "700", color: T.textSoft, letterSpacing: 1.5 },
  seeAll: { fontSize: 11, fontWeight: "600", color: T.primary },

  chip:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1 },
  chipTxt: { fontSize: 10, fontWeight: "700" },
  chipDot: { width: 4, height: 4, borderRadius: 99 },

  // ── Action strips (Alimenter + B2B) — style verre outlined ──
  actionStrip: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1.5, borderRadius: T.r.lg,
    padding: 14, marginBottom: 10,
  },
  actionStripIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  actionStripTitle: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  actionStripSub:   { fontSize: 10, fontWeight: "500" },
  actionStripArrow: {
    width: 30, height: 30, borderRadius: 9,
    justifyContent: "center", alignItems: "center",
  },

  // ── Grid ──
  grid:    { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 8 },
  moreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 12, backgroundColor: T.surface, borderRadius: T.r.md, borderWidth: 1, borderColor: T.border, marginBottom: 8 },
  moreTxt: { color: T.primary, fontSize: 11, fontWeight: "600" },
});