// apps/direct-transfair-mobile/app/(tabs)/admin/settings.tsx
// =========================================================
// PARAMÈTRES SOCIÉTÉ v2.0 — Direct Transf'air
// ✅ Commissions : 4 règles distinctes
//    → Filiale  : part plateforme à l'ENVOI + au RETRAIT
//    → Partenaire : part plateforme à l'ENVOI + au RETRAIT
// ✅ Taux de change : toutes combinaisons GNF/EUR/XOF/USD/GBP
// =========================================================

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Platform, Animated, TextInput,
  Alert, ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../services/api";
import { useAuth } from "../../../providers/AuthProvider";

// ─── Tokens ──────────────────────────────────────────────
const T = {
  pageBg:   "#F2F4F8",
  surface:  "#FFFFFF",
  border:   "#E4E9F0",
  borderLt: "#F1F5F9",
  borderMd: "#D1D9E6",
  ink:      "#0F172A",
  inkMid:   "#1E293B",
  inkSub:   "#6B7280",
  inkMuted: "#94A3B8",
  sky:      "#0284C7",
  skyDark:  "#0369A1",
  skyLt:    "#E0F2FE",
  skyMd:    "#7DD3FC",
  teal:     "#0F766E",
  tealLt:   "#CCFBF1",
  tealMd:   "#5EEAD4",
  amber:    "#D97706",
  amberLt:  "#FEF3C7",
  amberMd:  "#FDE68A",
  green:    "#16A34A",
  greenLt:  "#DCFCE7",
  greenMd:  "#A7F3D0",
  red:      "#DC2626",
  redLt:    "#FEE2E2",
  violet:   "#7C3AED",
  violetLt: "#EDE9FE",
  violetMd: "#C4B5FD",
  white:    "#FFFFFF",
  radius:   { sm: 8, md: 12, lg: 16, xl: 20 },
  font: {
    display: Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    sans:    Platform.select({ ios: "Trebuchet MS", android: "sans-serif-condensed", default: "Trebuchet MS" }),
    mono:    Platform.select({ ios: "Trebuchet MS", android: "monospace",            default: "Trebuchet MS" }),
  },
  shadow: {
    soft: { shadowColor: "#0284C7", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,  elevation: 3 },
    card: { shadowColor: "#0284C7", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  },
};

// ─── Devises ─────────────────────────────────────────────
const CURRENCIES = ["GNF", "EUR", "XOF", "USD", "GBP"] as const;
type CurrencyCode = typeof CURRENCIES[number];

const CURRENCY_META: Record<CurrencyCode, { flag: string; name: string; symbol: string; color: string; bg: string }> = {
  GNF: { flag: "🇬🇳", name: "Franc Guinéen",    symbol: "FG",  color: T.red,    bg: T.redLt    },
  EUR: { flag: "🇪🇺", name: "Euro",              symbol: "€",   color: T.sky,    bg: T.skyLt    },
  XOF: { flag: "🌍",  name: "Franc CFA BCEAO",   symbol: "CFA", color: T.amber,  bg: T.amberLt  },
  USD: { flag: "🇺🇸", name: "Dollar US",         symbol: "$",   color: T.green,  bg: T.greenLt  },
  GBP: { flag: "🇬🇧", name: "Livre Sterling",    symbol: "£",   color: T.violet, bg: T.violetLt },
};

function getAllPairs(): Array<{ from: CurrencyCode; to: CurrencyCode; key: string }> {
  const pairs: Array<{ from: CurrencyCode; to: CurrencyCode; key: string }> = [];
  for (const from of CURRENCIES)
    for (const to of CURRENCIES)
      if (from !== to) pairs.push({ from, to, key: `${from}/${to}` });
  return pairs;
}
const ALL_PAIRS = getAllPairs();

const DEFAULT_RATES: Record<string, number> = {
  "GNF/EUR": 0.000105, "GNF/XOF": 0.069,   "GNF/USD": 0.000115, "GNF/GBP": 0.000090,
  "EUR/GNF": 9524,     "EUR/XOF": 655.96,  "EUR/USD": 1.085,    "EUR/GBP": 0.862,
  "XOF/GNF": 14.49,    "XOF/EUR": 0.00152, "XOF/USD": 0.00165,  "XOF/GBP": 0.00132,
  "USD/GNF": 8696,     "USD/EUR": 0.922,   "USD/XOF": 606,      "USD/GBP": 0.794,
  "GBP/GNF": 11111,    "GBP/EUR": 1.160,   "GBP/XOF": 762,      "GBP/USD": 1.259,
};

function fmtRate(n: number, to: CurrencyCode): string {
  const d = to === "GNF" || to === "XOF" ? 0 : 6;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

// ─── Section Header ───────────────────────────────────────
function SectionHeader({ icon, title, color, desc }: { icon: string; title: string; color: string; desc?: string }) {
  return (
    <View style={shS.wrap}>
      <View style={[shS.iconBox, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[shS.title, { color, fontFamily: T.font.sans }]}>{title}</Text>
        {desc && <Text style={[shS.desc, { fontFamily: T.font.sans }]}>{desc}</Text>}
      </View>
    </View>
  );
}
const shS = StyleSheet.create({
  wrap:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  iconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  title:   { fontSize: 13, fontWeight: "900", letterSpacing: 0.3 },
  desc:    { fontSize: 10, color: T.inkMuted, fontWeight: "600", marginTop: 2 },
});

// ─── Rate Row ─────────────────────────────────────────────
function RateRow({ from, to, rateKey, rates, onChange }: {
  from: CurrencyCode; to: CurrencyCode; rateKey: string;
  rates: Record<string, string>; onChange: (key: string, val: string) => void;
}) {
  const fromMeta = CURRENCY_META[from];
  const toMeta   = CURRENCY_META[to];
  const [focused, setFocused] = useState(false);
  return (
    <View style={rrS.row}>
      <View style={rrS.pairBlock}>
        <View style={rrS.flags}>
          <View style={[rrS.flagBox, { backgroundColor: fromMeta.bg }]}>
            <Text style={{ fontSize: 14 }}>{fromMeta.flag}</Text>
          </View>
          <View style={[rrS.flagBox, rrS.flagOverlap, { backgroundColor: toMeta.bg }]}>
            <Text style={{ fontSize: 14 }}>{toMeta.flag}</Text>
          </View>
        </View>
        <View>
          <Text style={[rrS.pairTxt, { fontFamily: T.font.mono }]}>{from} → {to}</Text>
          <Text style={[rrS.pairSub, { fontFamily: T.font.sans }]} numberOfLines={1}>1 {fromMeta.symbol} en {toMeta.symbol}</Text>
        </View>
      </View>
      <View style={[rrS.inputBox, focused && { borderColor: toMeta.color, backgroundColor: toMeta.bg + "80" }]}>
        <TextInput
          style={[rrS.input, { fontFamily: T.font.mono, color: focused ? toMeta.color : T.ink }]}
          value={rates[rateKey] ?? ""}
          onChangeText={(v) => onChange(rateKey, v)}
          keyboardType="numeric"
          placeholder={fmtRate(DEFAULT_RATES[rateKey] ?? 1, to)}
          placeholderTextColor={T.inkMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <Text style={[rrS.suffix, { color: toMeta.color, fontFamily: T.font.sans }]}>{toMeta.symbol}</Text>
      </View>
    </View>
  );
}
const rrS = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.borderLt },
  pairBlock:  { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  flags:      { flexDirection: "row" },
  flagBox:    { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.border },
  flagOverlap:{ marginLeft: -10 },
  pairTxt:    { fontSize: 12, fontWeight: "800", color: T.ink, marginBottom: 1 },
  pairSub:    { fontSize: 9,  color: T.inkMuted, fontWeight: "600" },
  inputBox:   { flexDirection: "row", alignItems: "center", backgroundColor: T.borderLt, borderWidth: 1.5, borderColor: T.border, borderRadius: T.radius.md, paddingHorizontal: 10, paddingVertical: 8, minWidth: 120 },
  input:      { flex: 1, fontSize: 13, fontWeight: "700", color: T.ink },
  suffix:     { fontSize: 10, fontWeight: "900", marginLeft: 4 },
});

// ─── Commission Slider ────────────────────────────────────
const COMM_STEPS = [0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];

function CommissionSlider({
  label, icon, color, bg,
  platform, onPlatformChange,
}: {
  label: string; icon: string; color: string; bg: string;
  platform: number;
  onPlatformChange: (v: number) => void;
}) {
  const agency = 100 - platform;
  return (
    <View style={csS.wrap}>
      <View style={csS.header}>
        <View style={[csS.iconBox, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={14} color={color} />
        </View>
        <Text style={[csS.label, { fontFamily: T.font.sans, color }]}>{label}</Text>
      </View>
      <View style={csS.barWrap}>
        <View style={[csS.barFill, { width: `${platform}%` as any, backgroundColor: color }]} />
        <View style={[csS.barRemainder, { width: `${agency}%` as any }]} />
      </View>
      <View style={csS.legend}>
        <View style={csS.legendItem}>
          <View style={[csS.legendDot, { backgroundColor: color }]} />
          <Text style={[csS.legendTxt, { fontFamily: T.font.sans }]}>Plateforme</Text>
          <Text style={[csS.legendVal, { color, fontFamily: T.font.mono }]}>{platform}%</Text>
        </View>
        <View style={csS.legendItem}>
          <View style={[csS.legendDot, { backgroundColor: T.borderMd }]} />
          <Text style={[csS.legendTxt, { fontFamily: T.font.sans }]}>Agence</Text>
          <Text style={[csS.legendVal, { color: T.inkSub, fontFamily: T.font.mono }]}>{agency}%</Text>
        </View>
      </View>
      <Text style={[csS.stepsLabel, { fontFamily: T.font.sans }]}>PART PLATEFORME</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={csS.steps}>
        {COMM_STEPS.map((step) => {
          const active = platform === step;
          return (
            <TouchableOpacity
              key={step}
              style={[csS.step, active && { backgroundColor: color, borderColor: color }]}
              onPress={() => onPlatformChange(step)}
            >
              <Text style={[csS.stepTxt, { color: active ? T.white : T.inkSub, fontFamily: T.font.mono }]}>
                {step}%
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
const csS = StyleSheet.create({
  wrap:     { marginBottom: 8 },
  header:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  iconBox:  { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  label:    { fontSize: 13, fontWeight: "800" },
  barWrap:  { flexDirection: "row", height: 8, borderRadius: 99, overflow: "hidden", marginBottom: 10, backgroundColor: T.borderLt },
  barFill:  { height: 8 },
  barRemainder: { height: 8, backgroundColor: T.borderMd },
  legend:   { flexDirection: "row", gap: 20, marginBottom: 12 },
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:   { width: 8, height: 8, borderRadius: 99 },
  legendTxt:   { fontSize: 11, color: T.inkSub, fontWeight: "600" },
  legendVal:   { fontSize: 12, fontWeight: "900" },
  stepsLabel:  { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 8 },
  steps:    { gap: 6, paddingBottom: 4 },
  step:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.surface },
  stepTxt:  { fontSize: 11, fontWeight: "800" },
});

// ─── Commission Section ───────────────────────────────────
// ✅ Nouveau : 2 sliders par type (Envoi + Retrait)
function CommissionSection({
  agencyIcon, agencyLabel, agencyColor, agencyBg,
  sendPlatform,     onSendChange,
  withdrawPlatform, onWithdrawChange,
}: {
  agencyIcon: string; agencyLabel: string; agencyColor: string; agencyBg: string;
  sendPlatform: number;     onSendChange: (v: number) => void;
  withdrawPlatform: number; onWithdrawChange: (v: number) => void;
}) {
  return (
    <View style={[cscS.wrap, { borderLeftColor: agencyColor }]}>
      {/* En-tête type agence */}
      <View style={cscS.agencyHeader}>
        <View style={[cscS.agencyIcon, { backgroundColor: agencyBg }]}>
          <Ionicons name={agencyIcon as any} size={16} color={agencyColor} />
        </View>
        <Text style={[cscS.agencyLabel, { color: agencyColor, fontFamily: T.font.sans }]}>
          {agencyLabel}
        </Text>
      </View>

      {/* Résumé visuel 2 colonnes */}
      <View style={cscS.summaryRow}>
        <View style={[cscS.summaryBox, { backgroundColor: agencyBg, borderColor: agencyColor + "30" }]}>
          <Text style={[cscS.summaryType, { fontFamily: T.font.sans, color: agencyColor }]}>ENVOI</Text>
          <Text style={[cscS.summaryPct, { color: agencyColor, fontFamily: T.font.mono }]}>
            {sendPlatform}%
          </Text>
          <Text style={[cscS.summaryAgency, { fontFamily: T.font.sans }]}>plate-forme</Text>
          <Text style={[cscS.summaryAgency, { color: T.inkMuted, fontFamily: T.font.sans }]}>
            {100 - sendPlatform}% agence
          </Text>
        </View>
        <View style={cscS.summaryArrow}>
          <Ionicons name="swap-horizontal-outline" size={16} color={T.inkMuted} />
        </View>
        <View style={[cscS.summaryBox, { backgroundColor: agencyBg, borderColor: agencyColor + "30" }]}>
          <Text style={[cscS.summaryType, { fontFamily: T.font.sans, color: agencyColor }]}>RETRAIT</Text>
          <Text style={[cscS.summaryPct, { color: agencyColor, fontFamily: T.font.mono }]}>
            {withdrawPlatform}%
          </Text>
          <Text style={[cscS.summaryAgency, { fontFamily: T.font.sans }]}>plate-forme</Text>
          <Text style={[cscS.summaryAgency, { color: T.inkMuted, fontFamily: T.font.sans }]}>
            {100 - withdrawPlatform}% agence
          </Text>
        </View>
      </View>

      <View style={cscS.divider} />

      {/* Slider Envoi */}
      <CommissionSlider
        label="Commission à l'Envoi"
        icon="paper-plane-outline"
        color={agencyColor}
        bg={agencyBg}
        platform={sendPlatform}
        onPlatformChange={onSendChange}
      />

      <View style={cscS.divider} />

      {/* Slider Retrait */}
      <CommissionSlider
        label="Commission au Retrait"
        icon="cash-outline"
        color={agencyColor}
        bg={agencyBg}
        platform={withdrawPlatform}
        onPlatformChange={onWithdrawChange}
      />
    </View>
  );
}
const cscS = StyleSheet.create({
  wrap:         { borderLeftWidth: 3, paddingLeft: 14, marginBottom: 8 },
  agencyHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  agencyIcon:   { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  agencyLabel:  { fontSize: 14, fontWeight: "900", letterSpacing: 0.3 },
  summaryRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  summaryBox:   { flex: 1, borderRadius: T.radius.md, borderWidth: 1, padding: 12, alignItems: "center", gap: 2 },
  summaryArrow: { width: 28, alignItems: "center" },
  summaryType:  { fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  summaryPct:   { fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  summaryAgency:{ fontSize: 9, fontWeight: "700", color: T.inkSub },
  divider:      { height: 1, backgroundColor: T.borderLt, marginVertical: 14 },
});

// ─── Main Screen ──────────────────────────────────────────
export default function SettingsScreen() {
  const router   = useRouter();
  const { user } = useAuth();
  const isAdmin  = user?.role === "COMPANY_ADMIN";

  // ── Taux de change ──
  const [rates,       setRates]       = useState<Record<string, string>>({});
  const [savingRates, setSavingRates] = useState(false);
  const [ratesLoaded, setRatesLoaded] = useState(false);

  // ── Commissions — 4 règles ──────────────────────────────
  // Filiale : envoi + retrait
  const [subsidSend,     setSubsidSend]     = useState(30);
  const [subsidWithdraw, setSubsidWithdraw] = useState(30);
  // Partenaire : envoi + retrait
  const [partnerSend,     setPartnerSend]     = useState(50);
  const [partnerWithdraw, setPartnerWithdraw] = useState(50);
  const [savingComm,      setSavingComm]      = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Chargement ─────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    try {
      // Taux
      const apiRates = await api.getExchangeRates();
      const rateMap: Record<string, string> = {};
      if (Array.isArray(apiRates)) {
        for (const r of apiRates) {
          if (r.pair && r.rate !== undefined) rateMap[r.pair] = String(r.rate);
        }
      }
      for (const pair of ALL_PAIRS) {
        if (!rateMap[pair.key] && DEFAULT_RATES[pair.key])
          rateMap[pair.key] = String(DEFAULT_RATES[pair.key]);
      }
      setRates(rateMap);
      setRatesLoaded(true);

      // Commissions
      try {
        const commRules = await api.getCommissionRules() as any[];
        if (Array.isArray(commRules) && commRules.length > 0) {
          // ✅ Cherche par sourceType + transactionType
          const find = (sourceType: string, txType: string) =>
            commRules.find(
              (r: any) =>
                r.sourceType === sourceType &&
                (r.transactionType === txType || r.txType === txType)
            );

          const subsidSendRule     = find("SUBSIDIARY", "SEND");
          const subsidWithdrawRule = find("SUBSIDIARY", "WITHDRAWAL");
          const partnerSendRule    = find("PARTNER",    "SEND");
          const partnerWithdrawRule= find("PARTNER",    "WITHDRAWAL");

          if (subsidSendRule?.platformShare     !== undefined) setSubsidSend(Math.round(subsidSendRule.platformShare));
          if (subsidWithdrawRule?.platformShare !== undefined) setSubsidWithdraw(Math.round(subsidWithdrawRule.platformShare));
          if (partnerSendRule?.platformShare    !== undefined) setPartnerSend(Math.round(partnerSendRule.platformShare));
          if (partnerWithdrawRule?.platformShare!== undefined) setPartnerWithdraw(Math.round(partnerWithdrawRule.platformShare));
        }
      } catch { /* commissions optionnelles */ }

      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    } catch {
      const rateMap: Record<string, string> = {};
      for (const pair of ALL_PAIRS) {
        if (DEFAULT_RATES[pair.key]) rateMap[pair.key] = String(DEFAULT_RATES[pair.key]);
      }
      setRates(rateMap);
      setRatesLoaded(true);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 3 }).start();
    }
  }, [fadeAnim]);

  useFocusEffect(useCallback(() => { void loadSettings(); }, [loadSettings]));

  // ── Sauvegarder taux ───────────────────────────────────
  const handleSaveRates = async () => {
    setSavingRates(true);
    const errors: string[] = [];
    try {
      for (const pair of ALL_PAIRS) {
        const raw = rates[pair.key];
        if (!raw) continue;
        const val = Number(raw.replace(",", "."));
        if (!isFinite(val) || val <= 0) { errors.push(pair.key); continue; }
        try { await api.updateExchangeRate(pair.key, val); }
        catch { errors.push(pair.key); }
      }
      if (errors.length === 0) Alert.alert("✅ Taux sauvegardés", "Tous les taux ont été mis à jour.");
      else Alert.alert("⚠️ Partiellement sauvegardé", `${errors.length} paire(s) en erreur : ${errors.slice(0, 3).join(", ")}${errors.length > 3 ? "…" : ""}`);
    } finally { setSavingRates(false); }
  };

  // ── Sauvegarder commissions ─────────────────────────────
  // ✅ 4 règles : Filiale/Envoi, Filiale/Retrait, Partenaire/Envoi, Partenaire/Retrait
  const handleSaveComm = async () => {
    setSavingComm(true);
    try {
      const rules = [
        { sourceType: "SUBSIDIARY", transactionType: "SEND",       platform: subsidSend     },
        { sourceType: "SUBSIDIARY", transactionType: "WITHDRAWAL",  platform: subsidWithdraw },
        { sourceType: "PARTNER",    transactionType: "SEND",        platform: partnerSend    },
        { sourceType: "PARTNER",    transactionType: "WITHDRAWAL",  platform: partnerWithdraw},
      ];

      for (const rule of rules) {
        await api.saveCommissionRule({
          type:            "PERCENTAGE",
          value:           rule.platform,
          sourceType:      rule.sourceType,
          destType:        rule.sourceType,        // ✅ requis par le backend
          transactionType: rule.transactionType,
          platformShare:   rule.platform,
          senderShare:     0,
          payerShare:      100 - rule.platform,
        } as any);
      }

      Alert.alert("✅ Commissions sauvegardées", "Les 4 règles ont été mises à jour.");
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.message ?? "Sauvegarde impossible.");
    } finally { setSavingComm(false); }
  };

  // Groupement paires par devise source
  const pairsByFrom: Record<string, typeof ALL_PAIRS> = {};
  for (const p of ALL_PAIRS) {
    if (!pairsByFrom[p.from]) pairsByFrom[p.from] = [];
    pairsByFrom[p.from].push(p);
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: T.pageBg, justifyContent: "center", alignItems: "center" }}>
        <Ionicons name="lock-closed-outline" size={48} color={T.inkMuted} />
        <Text style={{ color: T.ink, fontSize: 16, fontWeight: "700", marginTop: 16, fontFamily: T.font.sans }}>
          Accès réservé à l'Admin Société
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar backgroundColor={T.surface} barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Paramètres</Text>
          <Text style={[s.headerSub, { color: T.sky, fontFamily: T.font.sans }]}>
            Compte & Société · Admin uniquement
          </Text>
        </View>
        <View style={[s.roleBadge, { backgroundColor: T.skyLt, borderColor: T.skyMd }]}>
          <View style={s.roleDot} />
          <Text style={[s.roleTxt, { color: T.sky, fontFamily: T.font.sans }]}>ADMIN</Text>
        </View>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim, flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ══════════════════════════════════════════
            SECTION 1 — COMMISSIONS
        ══════════════════════════════════════════ */}
        <View style={s.card}>
          <SectionHeader
            icon="pie-chart-outline"
            title="Répartition des Commissions"
            color={T.teal}
            desc="Configurez la part plateforme selon le type d'agence"
          />

          {/* Agences Filiales */}
          <CommissionSection
            agencyIcon="business-outline"
            agencyLabel="Agences Filiales"
            agencyColor={T.teal}
            agencyBg={T.tealLt}
            sendPlatform={subsidSend}         onSendChange={setSubsidSend}
            withdrawPlatform={subsidWithdraw} onWithdrawChange={setSubsidWithdraw}
          />

          <View style={{ height: 1, backgroundColor: T.border, marginVertical: 16 }} />

          {/* Agences Partenaires */}
          <CommissionSection
            agencyIcon="storefront-outline"
            agencyLabel="Agences Partenaires"
            agencyColor={T.amber}
            agencyBg={T.amberLt}
            sendPlatform={partnerSend}         onSendChange={setPartnerSend}
            withdrawPlatform={partnerWithdraw} onWithdrawChange={setPartnerWithdraw}
          />

          {/* Bouton sauvegarder commissions */}
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: T.teal }, savingComm && { opacity: 0.6 }]}
            onPress={handleSaveComm}
            disabled={savingComm}
            activeOpacity={0.88}
          >
            {savingComm
              ? <ActivityIndicator color={T.white} size="small" />
              : <>
                  <Ionicons name="cloud-upload-outline" size={18} color={T.white} />
                  <Text style={[s.saveBtnTxt, { fontFamily: T.font.sans }]}>
                    SAUVEGARDER LES COMMISSIONS
                  </Text>
                </>
            }
          </TouchableOpacity>
        </View>

        {/* ══════════════════════════════════════════
            SECTION 2 — TAUX DE CHANGE
        ══════════════════════════════════════════ */}
        <View style={s.card}>
          <SectionHeader
            icon="swap-horizontal"
            title="Taux de Change"
            color={T.sky}
            desc="Toutes les combinaisons entre les 5 devises supportées"
          />

          {!ratesLoaded ? (
            <ActivityIndicator color={T.sky} style={{ marginVertical: 20 }} />
          ) : (
            CURRENCIES.map((from) => (
              <View key={from} style={s.rateGroup}>
                <View style={[s.rateGroupHeader, { backgroundColor: CURRENCY_META[from].bg }]}>
                  <Text style={{ fontSize: 16 }}>{CURRENCY_META[from].flag}</Text>
                  <Text style={[s.rateGroupTitle, { color: CURRENCY_META[from].color, fontFamily: T.font.sans }]}>
                    {from} — {CURRENCY_META[from].name}
                  </Text>
                </View>
                {pairsByFrom[from].map((pair) => (
                  <RateRow
                    key={pair.key}
                    from={pair.from} to={pair.to} rateKey={pair.key}
                    rates={rates}
                    onChange={(key, val) => setRates((prev) => ({ ...prev, [key]: val }))}
                  />
                ))}
              </View>
            ))
          )}

          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: T.sky }, savingRates && { opacity: 0.6 }]}
            onPress={handleSaveRates}
            disabled={savingRates}
            activeOpacity={0.88}
          >
            {savingRates
              ? <ActivityIndicator color={T.white} size="small" />
              : <>
                  <Ionicons name="cloud-upload-outline" size={18} color={T.white} />
                  <Text style={[s.saveBtnTxt, { fontFamily: T.font.sans }]}>
                    SAUVEGARDER LES TAUX
                  </Text>
                </>
            }
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.pageBg },

  header: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.surface,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 44 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  backBtn:     { width: 38, height: 38, borderRadius: T.radius.md, backgroundColor: T.pageBg, borderWidth: 1, borderColor: T.border, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: T.ink },
  headerSub:   { fontSize: 11, fontWeight: "700", marginTop: 2 },
  roleBadge:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: T.radius.sm, borderWidth: 1 },
  roleDot:     { width: 6, height: 6, borderRadius: 99, backgroundColor: T.sky },
  roleTxt:     { fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },

  scroll: { padding: 16 },

  card: {
    backgroundColor: T.surface,
    borderRadius: T.radius.xl,
    padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: T.border,
    ...T.shadow.card,
  },

  rateGroup:       { marginBottom: 16 },
  rateGroupHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: T.radius.md, marginBottom: 4 },
  rateGroupTitle:  { fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },

  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    borderRadius: T.radius.lg, paddingVertical: 16, marginTop: 20,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  saveBtnTxt: { color: T.white, fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
});