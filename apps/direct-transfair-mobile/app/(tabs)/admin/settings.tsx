// apps/direct-transfair-mobile/app/(tabs)/admin/settings.tsx
// =========================================================
// PARAMÈTRES SOCIÉTÉ v3.0 — Direct Transf'air
// ✅ Taux de change : toutes combinaisons GNF/EUR/XOF/USD/GBP (inchangé)
//
// ✅ v3.0 : 🚨 REFONTE — 2 configurations → 6 configurations de
//    commission
//
//   PROBLÈME RÉSOLU :
//   L'écran n'exposait que 2 blocs ("Agences Filiales", "Agences
//   Partenaires"), chacun supposant implicitement que l'agence
//   d'origine et l'agence de destination sont du MÊME type. Or le
//   modèle de données (CommissionConfig, clé unique sur
//   [clientId, sourceType, destType, currency]) prévoit depuis le
//   début sourceType ∈ {SUBSIDIARY, PARTNER, WALLET} croisé avec
//   destType ∈ {SUBSIDIARY, PARTNER} — soit 6 combinaisons possibles,
//   et withdrawals.service.ts::agentProcessPayment() calcule déjà
//   correctement le vrai sourceType/destType de chaque retrait pour
//   aller chercher LA bonne règle. Résultat concret avant ce fix :
//   un retrait Filiale→Partenaire, Partenaire→Filiale, ou une
//   émission de code par un client Wallet, ne trouvait JAMAIS de
//   règle configurée par l'admin (aucun des 2 blocs ne pouvait
//   l'écrire) et retombait silencieusement sur les valeurs par
//   défaut codées en dur du backend (40/20/40) — sans erreur, sans
//   log visible côté admin, juste une répartition différente de ce
//   qui avait été réellement paramétré.
//
//   CORRECTIF — aucune ligne backend requise (DTO, controller et
//   service acceptent déjà sourceType:"WALLET" et n'importe quelle
//   combinaison) :
//   - 4 configurations agence↔agence (Filiale→Filiale,
//     Filiale→Partenaire, Partenaire→Filiale, Partenaire→Partenaire),
//     chacune avec 3 parts : agence de départ (senderShare), agence
//     de destination/payeuse (payerShare), plateforme (platformShare,
//     calculée = 100 - les deux autres, jamais négative — les deux
//     sélecteurs se plafonnent mutuellement à la saisie).
//   - 2 configurations d'émission wallet (Client Wallet→Filiale,
//     Client Wallet→Partenaire) : SEULEMENT 2 parts (agence
//     destination / plateforme) — pas d'agence de départ puisqu'il
//     n'y en a pas dans ce cas ; senderShare est toujours envoyé à 0
//     pour ces deux lignes.
//   - loadSettings() cherche pour chacune des 6 combinaisons la ligne
//     CommissionConfig correspondante SANS payoutMethod (ce champ
//     distingue une config de frais par méthode — fees.tsx — d'une
//     règle de répartition agence↔agence — cet écran). Note : pour
//     WALLET→SUBSIDIARY, les configs de frais de fees.tsx utilisent
//     aussi sourceType:WALLET/destType:SUBSIDIARY mais avec une
//     currency précise (XOF/EUR/GNF/USD) — la clé unique
//     [clientId, sourceType, destType, currency] les garde
//     distinctes de la règle de répartition (currency: null), donc
//     aucune collision possible entre les deux écrans.
//   - handleSaveComm() envoie 6 appels api.saveCommissionRule() (au
//     lieu de 2), un par combinaison.
//   - Anciens CommissionSlider/CommissionSection (modèle "part
//     plateforme unique" à 2 combinaisons implicites) supprimés,
//     remplacés par SplitBar/ShareStepRow/ComboCard (modèle
//     3 parts explicites, générique sur les 6 combinaisons).
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

// =========================================================
// ✅ v3.0 — COMMISSIONS : 6 combinaisons (voir changelog en tête
// de fichier)
// =========================================================

type SourceType = "SUBSIDIARY" | "PARTNER" | "WALLET";
type DestType   = "SUBSIDIARY" | "PARTNER";

type ComboKey =
  | "SUBSIDIARY_SUBSIDIARY" | "SUBSIDIARY_PARTNER"
  | "PARTNER_SUBSIDIARY"    | "PARTNER_PARTNER"
  | "WALLET_SUBSIDIARY"     | "WALLET_PARTNER";

type ComboDef = {
  key: ComboKey; source: SourceType; dest: DestType;
  label: string; sub: string; icon: string; color: string; bg: string;
  hasSender: boolean; // false pour les combinaisons WALLET (pas d'agence de départ)
};

const AGENCY_COMBOS: ComboDef[] = [
  { key: "SUBSIDIARY_SUBSIDIARY", source: "SUBSIDIARY", dest: "SUBSIDIARY", label: "Filiale → Filiale",      sub: "Envoi et retrait entre deux filiales",         icon: "business-outline",        color: T.teal,   bg: T.tealLt,   hasSender: true },
  { key: "SUBSIDIARY_PARTNER",    source: "SUBSIDIARY", dest: "PARTNER",    label: "Filiale → Partenaire",    sub: "Origine filiale, retrait chez un partenaire",   icon: "swap-horizontal-outline", color: T.sky,    bg: T.skyLt,    hasSender: true },
  { key: "PARTNER_SUBSIDIARY",    source: "PARTNER",    dest: "SUBSIDIARY", label: "Partenaire → Filiale",    sub: "Origine partenaire, retrait chez une filiale",  icon: "swap-horizontal-outline", color: T.violet, bg: T.violetLt, hasSender: true },
  { key: "PARTNER_PARTNER",       source: "PARTNER",    dest: "PARTNER",    label: "Partenaire → Partenaire", sub: "Envoi et retrait entre deux partenaires",       icon: "storefront-outline",      color: T.amber,  bg: T.amberLt,  hasSender: true },
];

const WALLET_COMBOS: ComboDef[] = [
  { key: "WALLET_SUBSIDIARY", source: "WALLET", dest: "SUBSIDIARY", label: "Client Wallet → Filiale",    sub: "Émission de code, retrait chez une filiale",   icon: "phone-portrait-outline", color: T.green, bg: T.greenLt, hasSender: false },
  { key: "WALLET_PARTNER",    source: "WALLET", dest: "PARTNER",    label: "Client Wallet → Partenaire", sub: "Émission de code, retrait chez un partenaire", icon: "phone-portrait-outline", color: T.red,   bg: T.redLt,   hasSender: false },
];

const ALL_COMBOS: ComboDef[] = [...AGENCY_COMBOS, ...WALLET_COMBOS];

// Alignés sur DEFAULT_PAYER_SHARE/DEFAULT_SENDER_SHARE/DEFAULT_PLATFORM_SHARE
// de withdrawals.service.ts (40/20/40) — les valeurs de repli du backend
// quand aucune règle n'est configurée. Défaut wallet arbitraire (0/60/40).
const DEFAULT_SHARES: Record<ComboKey, { senderShare: number; payerShare: number }> = {
  SUBSIDIARY_SUBSIDIARY: { senderShare: 20, payerShare: 40 },
  SUBSIDIARY_PARTNER:    { senderShare: 20, payerShare: 40 },
  PARTNER_SUBSIDIARY:    { senderShare: 20, payerShare: 40 },
  PARTNER_PARTNER:       { senderShare: 20, payerShare: 40 },
  WALLET_SUBSIDIARY:     { senderShare: 0,  payerShare: 60 },
  WALLET_PARTNER:        { senderShare: 0,  payerShare: 60 },
};

const SHARE_STEPS = [0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];

// ─── Split Bar — barre proportionnelle 2 ou 3 segments ────
function SplitBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  return (
    <View style={sbS.wrap}>
      <View style={sbS.barBg}>
        {segments.map((seg, i) => (
          <View key={i} style={[sbS.seg, { width: `${seg.value}%` as any, backgroundColor: seg.color }]} />
        ))}
      </View>
      <View style={sbS.legend}>
        {segments.map((seg, i) => (
          <View key={i} style={sbS.legendItem}>
            <View style={[sbS.legendDot, { backgroundColor: seg.color }]} />
            <Text style={[sbS.legendTxt, { fontFamily: T.font.sans }]}>{seg.label}</Text>
            <Text style={[sbS.legendVal, { color: seg.color, fontFamily: T.font.mono }]}>{seg.value}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const sbS = StyleSheet.create({
  wrap:       { marginBottom: 4 },
  barBg:      { flexDirection: "row", height: 8, borderRadius: 99, overflow: "hidden", backgroundColor: T.borderLt, marginBottom: 10 },
  seg:        { height: 8 },
  legend:     { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:  { width: 8, height: 8, borderRadius: 99 },
  legendTxt:  { fontSize: 10, color: T.inkSub, fontWeight: "600" },
  legendVal:  { fontSize: 11, fontWeight: "900" },
});

// ─── Share Step Row — sélecteur de pourcentage plafonné ───
function ShareStepRow({ label, value, max, color, onChange }: {
  label: string; value: number; max: number; color: string; onChange: (v: number) => void;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[csS.stepsLabel, { fontFamily: T.font.sans }]}>{label.toUpperCase()}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={csS.steps}>
        {SHARE_STEPS.filter((step) => step <= max).map((step) => {
          const active = value === step;
          return (
            <TouchableOpacity
              key={step}
              style={[csS.step, active && { backgroundColor: color, borderColor: color }]}
              onPress={() => onChange(step)}
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
  stepsLabel: { fontSize: 9, fontWeight: "900", color: T.inkMuted, letterSpacing: 1, marginBottom: 8 },
  steps:      { gap: 6, paddingBottom: 4 },
  step:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.surface },
  stepTxt:    { fontSize: 11, fontWeight: "800" },
});

// ─── Combo Card — une des 6 configurations ────────────────
function ComboCard({ combo, shares, onChange }: {
  combo: ComboDef;
  shares: { senderShare: number; payerShare: number };
  onChange: (key: ComboKey, next: { senderShare: number; payerShare: number }) => void;
}) {
  const platformShare = Math.max(0, 100 - shares.senderShare - shares.payerShare);

  const setSender = (v: number) => {
    const maxAllowed = 100 - shares.payerShare;
    onChange(combo.key, { ...shares, senderShare: Math.min(v, maxAllowed) });
  };
  const setPayer = (v: number) => {
    const maxAllowed = 100 - shares.senderShare;
    onChange(combo.key, { ...shares, payerShare: Math.min(v, maxAllowed) });
  };

  const segments = combo.hasSender
    ? [
        { label: "Agence départ",      value: shares.senderShare, color: combo.color },
        { label: "Agence destination", value: shares.payerShare,  color: T.sky },
        { label: "Plateforme",         value: platformShare,      color: T.inkMuted },
      ]
    : [
        { label: "Agence destination", value: shares.payerShare, color: combo.color },
        { label: "Plateforme",         value: platformShare,     color: T.inkMuted },
      ];

  return (
    <View style={[cscS.wrap, { borderLeftColor: combo.color }]}>
      <View style={cscS.agencyHeader}>
        <View style={[cscS.agencyIcon, { backgroundColor: combo.bg }]}>
          <Ionicons name={combo.icon as any} size={16} color={combo.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[cscS.agencyLabel, { color: combo.color, fontFamily: T.font.sans }]}>{combo.label}</Text>
          <Text style={[cscS.agencySub, { fontFamily: T.font.sans }]}>{combo.sub}</Text>
        </View>
      </View>

      <SplitBar segments={segments} />

      <View style={cscS.divider} />

      {combo.hasSender && (
        <ShareStepRow
          label="Part agence de départ"
          value={shares.senderShare}
          max={100 - shares.payerShare}
          color={combo.color}
          onChange={setSender}
        />
      )}
      <ShareStepRow
        label="Part agence de destination (retrait)"
        value={shares.payerShare}
        max={100 - shares.senderShare}
        color={T.sky}
        onChange={setPayer}
      />

      <View style={[cscS.platformNote, { backgroundColor: combo.bg }]}>
        <Ionicons name="business-outline" size={13} color={combo.color} />
        <Text style={[cscS.platformNoteTxt, { color: combo.color, fontFamily: T.font.sans }]}>
          Part plateforme : {platformShare}% (calculée automatiquement)
        </Text>
      </View>
    </View>
  );
}
const cscS = StyleSheet.create({
  wrap:            { borderLeftWidth: 3, paddingLeft: 14, marginBottom: 20 },
  agencyHeader:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  agencyIcon:      { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  agencyLabel:     { fontSize: 13, fontWeight: "900", letterSpacing: 0.3 },
  agencySub:       { fontSize: 10, color: T.inkMuted, fontWeight: "600", marginTop: 2 },
  divider:         { height: 1, backgroundColor: T.borderLt, marginVertical: 12 },
  platformNote:    { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: T.radius.sm, paddingHorizontal: 10, paddingVertical: 8, marginTop: 2 },
  platformNoteTxt: { fontSize: 11, fontWeight: "700" },
});

const csecS = StyleSheet.create({
  groupLabel:    { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4, marginTop: 4 },
  groupLabelTxt: { fontSize: 10, fontWeight: "900", color: T.inkMuted, letterSpacing: 1.2 },
  groupHint:     { fontSize: 10, color: T.inkMuted, fontWeight: "600", marginBottom: 12, lineHeight: 14 },
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

  // ── Commissions — ✅ v3.0 : 6 configurations ────────────
  const [shares,     setShares]     = useState<Record<ComboKey, { senderShare: number; payerShare: number }>>(DEFAULT_SHARES);
  const [savingComm, setSavingComm] = useState(false);

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

      // ✅ v3.0 — Commissions : reconstruit les 6 configurations depuis
      // les CommissionConfig existants. !r.payoutMethod exclut les
      // configs de frais par méthode (fees.tsx) — voir changelog en
      // tête de fichier pour la coexistence WALLET/SUBSIDIARY entre
      // les deux écrans (currency les distingue).
      try {
        const commRules = await api.getCommissionRules() as any[];
        if (Array.isArray(commRules)) {
          const next = { ...DEFAULT_SHARES };
          for (const combo of ALL_COMBOS) {
            const rule = commRules.find((r: any) =>
              r.sourceType === combo.source && r.destType === combo.dest && !r.payoutMethod
            );
            if (rule) {
              next[combo.key] = {
                senderShare: Math.max(0, Math.min(100, Math.round(rule.senderShare ?? 0))),
                payerShare:  Math.max(0, Math.min(100, Math.round(rule.payerShare  ?? 0))),
              };
            }
          }
          setShares(next);
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

  // ── Sauvegarder commissions — ✅ v3.0 : 6 appels ─────────
  // Chaque combinaison envoie sourceType/destType/senderShare/
  // payerShare — le DTO backend n'a pas de champ platformShare, le
  // service le calcule (100 - senderShare - payerShare). Les sliders
  // se plafonnant mutuellement à la saisie (voir ComboCard), la somme
  // ne peut jamais dépasser 100 — pas de validation d'erreur possible
  // ici, contrairement à l'ancien modèle à 2 blocs.
  const handleSaveComm = async () => {
    setSavingComm(true);
    try {
      const results = await Promise.allSettled(
        ALL_COMBOS.map((combo) => {
          const s = shares[combo.key];
          return api.saveCommissionRule({
            sourceType:  combo.source as any,
            destType:    combo.dest as any,
            senderShare: combo.hasSender ? s.senderShare : 0,
            payerShare:  s.payerShare,
          } as any);
        })
      );

      const failed = results.filter((r) => r.status === "rejected").length;

      Alert.alert(
        failed === 0 ? "✅ Commissions sauvegardées" : "⚠️ Partiellement sauvegardé",
        failed === 0
          ? "Les 6 configurations (4 agence↔agence + 2 émission wallet) ont été mises à jour."
          : `${ALL_COMBOS.length - failed}/${ALL_COMBOS.length} configuration(s) sauvegardée(s). Vérifiez la connexion.`,
      );
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.message ?? "Sauvegarde impossible.");
    } finally {
      setSavingComm(false);
    }
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
            SECTION 1 — COMMISSIONS — ✅ v3.0 : 6 configurations
        ══════════════════════════════════════════ */}
        <View style={s.card}>
          <SectionHeader
            icon="pie-chart-outline"
            title="Répartition des Commissions"
            color={T.teal}
            desc="6 configurations : 4 combinaisons agence↔agence + 2 émissions wallet client"
          />

          <View style={csecS.groupLabel}>
            <Ionicons name="git-network-outline" size={13} color={T.inkMuted} />
            <Text style={[csecS.groupLabelTxt, { fontFamily: T.font.sans }]}>RETRAIT ENTRE AGENCES</Text>
          </View>
          {AGENCY_COMBOS.map((combo) => (
            <ComboCard
              key={combo.key}
              combo={combo}
              shares={shares[combo.key]}
              onChange={(key, next) => setShares((prev) => ({ ...prev, [key]: next }))}
            />
          ))}

          <View style={csecS.groupLabel}>
            <Ionicons name="phone-portrait-outline" size={13} color={T.inkMuted} />
            <Text style={[csecS.groupLabelTxt, { fontFamily: T.font.sans }]}>ÉMISSION DE CODE PAR UN CLIENT WALLET</Text>
          </View>
          <Text style={[csecS.groupHint, { fontFamily: T.font.sans }]}>
            Pas d'agence d'origine ici — seules l'agence de retrait et la plateforme se partagent la commission.
          </Text>
          {WALLET_COMBOS.map((combo) => (
            <ComboCard
              key={combo.key}
              combo={combo}
              shares={shares[combo.key]}
              onChange={(key, next) => setShares((prev) => ({ ...prev, [key]: next }))}
            />
          ))}

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
                    SAUVEGARDER LES 6 CONFIGURATIONS
                  </Text>
                </>
            }
          </TouchableOpacity>
        </View>

        {/* ══════════════════════════════════════════
            SECTION 2 — TAUX DE CHANGE (inchangé)
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
    borderRadius: T.radius.lg, paddingVertical: 16, marginTop: 4,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  saveBtnTxt: { color: T.white, fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
});