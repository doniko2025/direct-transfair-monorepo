// apps/direct-transfair-mobile/components/dashboards/CompanyDashboard.tsx
// =========================================================
// COMPANY ADMIN DASHBOARD v6.0 — Direct Transf'air
// Design: Modern Fintech · Hero compact · Carousel 2-col
// =========================================================

import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  ScrollView, Modal, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Animated, SafeAreaView,
  StatusBar, Dimensions, Pressable,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";

const { width: SW } = Dimensions.get("window");
const CARD_W = (SW - 48 - 8) / 2; // 2 cards visible + gap

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

// ─── Design Tokens ───────────────────────────────────────
const T = {
  pageBg:      "#F5F7FF",
  surface:     "#FFFFFF",
  border:      "rgba(26,63,203,0.10)",
  borderSoft:  "#F5F7FF",
  primary:     "#1A3FCB",
  primaryDark: "#1230A0",
  primaryMid:  "#2952E3",
  success:     "#16A34A",
  successSoft: "#DCFCE7",
  warning:     "#D97706",
  warningSoft: "#FEF3C7",
  danger:      "#DC2626",
  dangerSoft:  "#FEE2E2",
  text:        "#0B1437",
  textSoft:    "#5B6A96",
  textMuted:   "#A8B5D8",
  r: { sm: 8, md: 12, lg: 14, xl: 20, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace" }),
  },
};

// ─── Helpers ─────────────────────────────────────────────
function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

function fmt(n: number, currency: string): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(n);
  } catch { return n.toFixed(d); }
}

// ─── Wallet Card (Carousel Item) ─────────────────────────
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

// ─── Carousel with dots ───────────────────────────────────
function WalletCarousel({
  wallets,
  activeCur,
  setActiveCur,
}: {
  wallets: any[];
  activeCur: number;
  setActiveCur: (i: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);

  const getBalance = useCallback((c: string) => {
    const w = wallets.find((x) => x.currency === c);
    return toNum(w?.balance ?? w?.availableBalance ?? 0);
  }, [wallets]);

  // Active dot tracks which pair is "leading" (every card = 1 step)
  const [dotIdx, setDotIdx] = useState(0);

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

      {/* Dots */}
      <View style={car.dots}>
        {CURRENCIES_ORDER.map((c, i) => {
          const cfg = CURRENCIES[c];
          const isActive = i === dotIdx;
          return (
            <TouchableOpacity
              key={c}
              hitSlop={8}
              onPress={() => {
                setDotIdx(i);
                setActiveCur(i);
                scrollRef.current?.scrollTo({ x: i * (CARD_W + 8), animated: true });
              }}
            >
              <View style={[
                car.dot,
                { width: isActive ? 16 : 4, backgroundColor: isActive ? cfg.color : T.border },
              ]} />
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

// ─── Action Card ─────────────────────────────────────────
function ActionCard({
  title, subtitle, icon, color, bg, onPress, badge,
}: {
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

// ─── Agency Card ─────────────────────────────────────────
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
  const flag = agency.country
    ? (flagMap[agency.country.toUpperCase().substring(0, 2)] ?? "🌍")
    : "🌍";

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
            borderColor: `${isActive ? T.success : T.danger}30`,
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

// ─── Generic Modal Sheet ──────────────────────────────────
function ModalSheet({
  visible, onClose, title, subtitle, gradColors, children,
}: {
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
  overlay: { flex: 1, backgroundColor: "rgba(11,20,55,0.5)", justifyContent: "flex-end" },
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
  btn:  { borderRadius: T.r.md, overflow: "hidden", marginBottom: 4, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  grad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, gap: 8 },
  txt:  { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.8 },
});

// ─── Main Dashboard ───────────────────────────────────────
export default function CompanyDashboard() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [refreshing,    setRefreshing]    = useState(false);
  const [wallets,       setWallets]       = useState<any[]>([]);
  const [agencies,      setAgencies]      = useState<any[]>([]);
  const [activeCur,     setActiveCur]     = useState(0);

  const [modalB2B,      setModalB2B]      = useState(false);
  const [amountB2B,     setAmountB2B]     = useState("");
  const [refB2B,        setRefB2B]        = useState("");
  const [loadingB2B,    setLoadingB2B]    = useState(false);

  const [modalFill,     setModalFill]     = useState(false);
  const [fillCur,       setFillCur]       = useState<CurrencyCode>("XOF");
  const [fillAmount,    setFillAmount]    = useState("");
  const [loadingFill,   setLoadingFill]   = useState(false);

  const [modalAgency,   setModalAgency]   = useState(false);
  const [targetAgency,  setTargetAgency]  = useState<any>(null);
  const [agencyAmount,  setAgencyAmount]  = useState("");
  const [loadingAgency, setLoadingAgency] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;

  const clientName     = useMemo(() => user?.client?.name || "Mon Entreprise", [user?.client?.name]);
  const totalAgencies  = agencies.length;
  const activeAgencies = agencies.filter((a) => a.isActive !== false).length;

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshUser();
      let wals: any[] = await api.getMyWallets().catch(() => []);
      const allZero = wals.length === 0 || wals.every((w) => toNum(w?.balance) === 0);
      if (allZero) {
        const ov = await api.getTreasuryOverview().catch(() => []);
        if (Array.isArray(ov) && ov.length > 0) wals = ov;
      }
      setWallets(Array.isArray(wals) ? wals : []);
      const ags = await api.getAgencies().catch(() => []);
      setAgencies(Array.isArray(ags) ? ags : []);
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  }, [refreshUser]);

  useFocusEffect(useCallback(() => {
    void loadData();
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 4 }).start();
  }, [loadData]));

  useEffect(() => { setFillCur(CURRENCIES_ORDER[activeCur]); }, [activeCur]);

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

  const handleFill = async () => {
    const n = Number(fillAmount);
    if (!fillAmount || isNaN(n) || n <= 0) { Alert.alert("Erreur", "Montant invalide."); return; }
    setLoadingFill(true);
    try {
      await api.adminFundSelf(n, fillCur);
      setModalFill(false); setFillAmount("");
      Alert.alert("✅ Alimenté", `${fmt(n, fillCur)} ${fillCur} ajouté.`);
      await loadData();
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.message || "Erreur technique");
    } finally { setLoadingFill(false); }
  };

  const handleB2B = async () => {
    const n = Number(amountB2B);
    if (!amountB2B || isNaN(n) || n <= 0) { Alert.alert("Erreur", "Montant invalide."); return; }
    setLoadingB2B(true);
    try {
      await api.declareBankTransfer(n, refB2B);
      setModalB2B(false); setAmountB2B(""); setRefB2B("");
      Alert.alert("✅ Déclaration envoyée", "En attente de validation.");
      await loadData();
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.message || "Erreur technique");
    } finally { setLoadingB2B(false); }
  };

  const handleAgencyRefill = async () => {
    const n = Number(agencyAmount);
    if (!agencyAmount || isNaN(n) || n <= 0) { Alert.alert("Erreur", "Montant invalide."); return; }
    setLoadingAgency(true);
    try {
      await api.adminRefillAgency(targetAgency.id, n);
      setModalAgency(false); setAgencyAmount("");
      Alert.alert("✅ Rechargé", `${targetAgency.name} crédité de ${fmt(n, "XOF")} CFA.`);
      await loadData();
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.message || "Erreur technique");
    } finally { setLoadingAgency(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={T.primary} />

      {/* ── Hero ── */}
      <Animated.View style={[s.hero, {
        opacity: headerAnim,
        transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
      }]}>
        <LinearGradient
          colors={[T.primary, "#0F2890", "#0A1E6E"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.heroGrad}
        >
          <View style={s.heroDeco1} />
          <View style={s.heroDeco2} />

          {/* Top row */}
          <View style={s.heroRow}>
            <View style={s.avatar}>
              <Text style={[s.avatarTxt, { fontFamily: T.font.serif }]}>
                {(clientName[0] ?? "E").toUpperCase()}
              </Text>
              <View style={s.avatarDot} />
            </View>
            <View style={{ flex: 1, paddingLeft: 10 }}>
              <View style={s.heroBadge}>
                <View style={s.heroBadgeDot} />
                <Text style={[s.heroBadgeTxt, { fontFamily: T.font.sans }]}>ADMIN SOCIÉTÉ</Text>
              </View>
              <Text style={[s.heroTitle, { fontFamily: T.font.serif }]}>{clientName}</Text>
            </View>
            <View style={s.heroActions}>
              <TouchableOpacity style={s.heroBtn} onPress={loadData}>
                <Ionicons name="refresh" size={15} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={s.heroBtn}>
                <Ionicons name="notifications-outline" size={15} color="#fff" />
                <View style={s.notifDot} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Welcome + date */}
          <View style={s.heroWelcome}>
            <Text style={[s.heroWelcomeTxt, { fontFamily: T.font.sans }]}>
              Bonjour, <Text style={{ fontWeight: "700", color: "#fff" }}>{user?.firstName || "Admin"}</Text> 👋
            </Text>
            <View style={s.datePill}>
              <Text style={[s.dateTxt, { fontFamily: T.font.sans }]}>{today}</Text>
            </View>
          </View>

          {/* Stats */}
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
        </LinearGradient>
        <View style={s.wave}><View style={s.waveCurve} /></View>
      </Animated.View>

      {/* ── Scroll Content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={T.primary} />}
      >
        {/* Trésorerie label */}
        <View style={s.secRow}>
          <View style={[s.secDot, { backgroundColor: T.warning }]} />
          <Text style={[s.secLbl, { fontFamily: T.font.sans }]}>TRÉSORERIE · 5 DEVISES</Text>
        </View>

        {/* Wallet Carousel */}
        <WalletCarousel wallets={wallets} activeCur={activeCur} setActiveCur={setActiveCur} />

        {/* Currency chips */}
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
                <Text style={[s.chipTxt, { color: sel ? T.text : T.textSoft, fontFamily: T.font.sans }]}>
                  {cfg.code}
                </Text>
                {sel && <View style={[s.chipDot, { backgroundColor: cfg.color }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Alimenter button */}
        <TouchableOpacity style={s.fillBtn} onPress={() => setModalFill(true)} activeOpacity={0.88}>
          <LinearGradient
            colors={["#00B87C", "#009060"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.fillGrad}
          >
            <Ionicons name="add-circle-outline" size={16} color="#fff" />
            <Text style={[s.fillTxt, { fontFamily: T.font.sans }]}>Alimenter en {fillCur}</Text>
            <Ionicons name="arrow-forward" size={14} color="#fff" style={{ marginLeft: "auto" }} />
          </LinearGradient>
        </TouchableOpacity>

        {/* B2B Banner */}
        <TouchableOpacity style={s.b2bBanner} onPress={() => setModalB2B(true)} activeOpacity={0.88}>
          <LinearGradient
            colors={[T.primary, T.primaryDark]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.b2bGrad}
          >
            <View style={s.b2bIcon}>
              <Ionicons name="swap-horizontal-outline" size={17} color="#fff" />
            </View>
            <View style={{ flex: 1, paddingLeft: 12 }}>
              <Text style={[s.b2bTitle, { fontFamily: T.font.serif }]}>Déclarer un Virement B2B</Text>
              <Text style={[s.b2bSub,   { fontFamily: T.font.sans  }]}>En attente de validation Super Admin</Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Actions */}
        <View style={s.secRow}>
          <View style={[s.secDot, { backgroundColor: T.primary }]} />
          <Text style={[s.secLbl, { fontFamily: T.font.sans }]}>PILOTAGE SOCIÉTÉ</Text>
        </View>
        <View style={s.grid}>
          <ActionCard title="Transactions" subtitle="Historique & suivi"  icon="list-outline"       color={T.primary}  bg="#EEF2FF"    onPress={() => router.push("/(tabs)/admin/transactions")} />
          <ActionCard title="Agences"      subtitle="Réseau & gestion"    icon="storefront-outline" color={T.success}  bg={T.successSoft} onPress={() => router.push("/(tabs)/admin/agencies")} badge="Réseau" />
          <ActionCard title="Trésorerie"   subtitle="Vue détaillée"       icon="wallet-outline"     color={T.warning}  bg={T.warningSoft} onPress={() => router.push("/(tabs)/admin/treasury")} />
          <ActionCard title="Paramètres"   subtitle="Compte & société"    icon="settings-outline"   color="#7C3AED"    bg="#F5F3FF"    onPress={() => router.push("/(tabs)/admin/settings")} />
        </View>

        {/* Agencies */}
        {agencies.length > 0 && (
          <>
            <View style={s.secRow}>
              <View style={[s.secDot, { backgroundColor: T.success }]} />
              <Text style={[s.secLbl, { fontFamily: T.font.sans }]}>
                AGENCES DU RÉSEAU · {totalAgencies}
              </Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/admin/agencies")} style={{ marginLeft: "auto" }}>
                <Text style={[s.seeAll, { fontFamily: T.font.sans }]}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            {agencies.slice(0, 5).map((a) => (
              <AgencyCard
                key={a.id} agency={a}
                onRefill={() => { setTargetAgency(a); setAgencyAmount(""); setModalAgency(true); }}
              />
            ))}
            {agencies.length > 5 && (
              <TouchableOpacity
                style={s.moreBtn}
                onPress={() => router.push("/(tabs)/admin/agencies")}
                activeOpacity={0.8}
              >
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
        gradColors={["#00B87C", "#009060"]}
      >
        <AmountInput value={fillAmount} onChange={setFillAmount} currency={fillCur} accentColor="#00B87C" accentBg="#DCFCE7" />
        <QuickAmounts amounts={[100000, 500000, 1000000, 5000000]} selected={fillAmount} onSelect={setFillAmount} color="#00B87C" />
        <ConfirmBtn
          label={`INJECTER ${fillAmount ? fmt(Number(fillAmount), fillCur) : "—"} ${fillCur}`}
          color="#00B87C" loading={loadingFill} onPress={handleFill}
        />
        <TouchableOpacity onPress={() => { setModalFill(false); setFillAmount(""); }} style={{ alignItems: "center", paddingVertical: 14 }}>
          <Text style={[{ color: T.textSoft, fontWeight: "600", fontSize: 13 }, { fontFamily: T.font.sans }]}>Annuler</Text>
        </TouchableOpacity>
      </ModalSheet>

      {/* ── Modal B2B ── */}
      <ModalSheet
        visible={modalB2B}
        onClose={() => { setModalB2B(false); setAmountB2B(""); setRefB2B(""); }}
        title="Déclarer un Virement"
        subtitle="Alimentation B2B · en attente validation"
        gradColors={[T.primary, T.primaryDark]}
      >
        <AmountInput value={amountB2B} onChange={setAmountB2B} currency="XOF" accentColor={T.primary} accentBg="#EEF2FF" />
        <Text style={[{ fontSize: 9, fontWeight: "900", color: T.textMuted, letterSpacing: 1.5, marginBottom: 8 }, { fontFamily: T.font.sans }]}>
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
        <ConfirmBtn label="ENVOYER POUR VALIDATION" color={T.primary} loading={loadingB2B} onPress={handleB2B} />
        <TouchableOpacity onPress={() => { setModalB2B(false); setAmountB2B(""); setRefB2B(""); }} style={{ alignItems: "center", paddingVertical: 14 }}>
          <Text style={[{ color: T.textSoft, fontWeight: "600", fontSize: 13 }, { fontFamily: T.font.sans }]}>Annuler</Text>
        </TouchableOpacity>
      </ModalSheet>

      {/* ── Modal Recharge Agence ── */}
      <ModalSheet
        visible={modalAgency}
        onClose={() => { setModalAgency(false); setAgencyAmount(""); }}
        title="Recharger l'Agence"
        subtitle={targetAgency?.name || "—"}
        gradColors={["#7C3AED", "#6D28D9"]}
      >
        <AmountInput value={agencyAmount} onChange={setAgencyAmount} currency="XOF" accentColor="#7C3AED" accentBg="#F5F3FF" />
        <QuickAmounts amounts={[50000, 100000, 500000, 1000000]} selected={agencyAmount} onSelect={setAgencyAmount} color="#7C3AED" />
        <ConfirmBtn
          label={`TRANSFÉRER ${agencyAmount ? fmt(Number(agencyAmount), "XOF") : "—"} CFA`}
          color="#7C3AED" loading={loadingAgency} onPress={handleAgencyRefill}
        />
        <TouchableOpacity onPress={() => { setModalAgency(false); setAgencyAmount(""); }} style={{ alignItems: "center", paddingVertical: 14 }}>
          <Text style={[{ color: T.textSoft, fontWeight: "600", fontSize: 13 }, { fontFamily: T.font.sans }]}>Annuler</Text>
        </TouchableOpacity>
      </ModalSheet>
    </SafeAreaView>
  );
}

// ─── Main Styles ──────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.pageBg },

  hero:     { zIndex: 10 },
  heroGrad: { overflow: "hidden", paddingBottom: 0 },
  heroDeco1:{ position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.04)", top: -80, right: -60 },
  heroDeco2:{ position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.03)", bottom: 20, left: -40 },

  heroRow:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: Platform.OS === "android" ? 44 : 14, paddingBottom: 10 },
  avatar:       { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)", justifyContent: "center", alignItems: "center", position: "relative" },
  avatarTxt:    { color: "#fff", fontSize: 16, fontWeight: "800" },
  avatarDot:    { position: "absolute", bottom: 0, right: 0, width: 8, height: 8, borderRadius: 99, backgroundColor: "#67E8F9", borderWidth: 1.5, borderColor: T.primary },
  heroBadge:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start", marginBottom: 3 },
  heroBadgeDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: "#67E8F9" },
  heroBadgeTxt: { color: "rgba(255,255,255,0.85)", fontSize: 8, fontWeight: "700", letterSpacing: 1.2 },
  heroTitle:    { color: "#fff", fontSize: 15, fontWeight: "700" },
  heroActions:  { flexDirection: "row", gap: 7 },
  heroBtn:      { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.13)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center", position: "relative" },
  notifDot:     { position: "absolute", top: 5, right: 5, width: 6, height: 6, borderRadius: 99, backgroundColor: "#FCA5A5", borderWidth: 1.5, borderColor: T.primary },

  heroWelcome:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 12 },
  heroWelcomeTxt: { color: "rgba(255,255,255,0.75)", fontSize: 12 },
  datePill:       { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  dateTxt:        { color: "#fff", fontSize: 10, fontWeight: "600" },

  heroStats:    { flexDirection: "row", alignItems: "center", marginHorizontal: 18, marginBottom: 14, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: T.r.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", paddingVertical: 10, paddingHorizontal: 8 },
  heroStatItem: { flex: 1, alignItems: "center" },
  heroStatVal:  { color: "#fff", fontSize: 20, fontWeight: "700", lineHeight: 22 },
  heroStatLbl:  { color: "rgba(255,255,255,0.55)", fontSize: 7, fontWeight: "700", letterSpacing: 1.2, marginTop: 3 },
  heroStatSep:  { width: 1, height: 26, backgroundColor: "rgba(255,255,255,0.18)" },

  wave:      { width: "100%", height: 20, overflow: "hidden", backgroundColor: T.pageBg },
  waveCurve: { width: "100%", height: 40, backgroundColor: "#0A1E6E", borderBottomLeftRadius: SW * 0.6, borderBottomRightRadius: SW * 0.6, marginTop: -20 },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  secRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  secDot: { width: 5, height: 5, borderRadius: 99 },
  secLbl: { fontSize: 9, fontWeight: "700", color: T.textSoft, letterSpacing: 1.5 },
  seeAll: { fontSize: 11, fontWeight: "600", color: T.primary },

  chip:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1 },
  chipTxt: { fontSize: 10, fontWeight: "700" },
  chipDot: { width: 4, height: 4, borderRadius: 99 },

  fillBtn:  { borderRadius: T.r.md, overflow: "hidden", marginBottom: 12 },
  fillGrad: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 8 },
  fillTxt:  { flex: 1, color: "#fff", fontSize: 13, fontWeight: "600" },

  b2bBanner: { borderRadius: T.r.lg, overflow: "hidden", marginBottom: 16 },
  b2bGrad:   { flexDirection: "row", alignItems: "center", padding: 14 },
  b2bIcon:   { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", justifyContent: "center", alignItems: "center" },
  b2bTitle:  { color: "#fff", fontSize: 13, fontWeight: "700", marginBottom: 2 },
  b2bSub:    { color: "rgba(255,255,255,0.65)", fontSize: 10 },

  grid:    { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 8 },
  moreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 12, backgroundColor: T.surface, borderRadius: T.r.md, borderWidth: 1, borderColor: T.border, marginBottom: 8 },
  moreTxt: { color: T.primary, fontSize: 11, fontWeight: "600" },
});