// apps/direct-transfair-mobile/app/agent/deposit.tsx
// =========================================================
// AGENT DEPOSIT (CASH-IN) v6.0 — Direct Transf'air
// ✅ v5.1 : devise dynamique depuis wallets
// ✅ v6.0 :
//    - Violet #6C47FF → Bleu #2563EB (cohérent tous héros)
//    - Arc concave (react-native-svg) remplace borderRadius
//    - Indicatif pays + sélecteur sur le champ téléphone
//    - Champ montant compact (30→20px, padding 14→11)
//    - Montants rapides : ScrollView horizontal
//    - pageBg + cardBorder bleu pâle
// =========================================================

import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar, Animated, Modal, FlatList,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Rect } from "react-native-svg";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import { countriesList, type CountryData } from "../../data/countries";

const { width: SW } = Dimensions.get("window");

// ─── Bleu agent ──────────────────────────────────────────
const AGENT_BLUE = "#2563EB";
const CONCAVE_H  = 60;
const DEFAULT_COUNTRY = countriesList.find(c => c.code === "SN") ?? countriesList[0];

// ─── Design System ──────────────────────────────────────
const C = {
  violet:       AGENT_BLUE,        // ✅ bleu au lieu de violet
  violetLight:  "#EFF6FF",
  violetBorder: "#DBEAFE",
  heroGlass:    "rgba(255,255,255,0.14)",
  heroGlassBdr: "rgba(255,255,255,0.22)",
  heroDim:      "rgba(255,255,255,0.65)",
  heroGlow:     "rgba(255,255,255,0.07)",
  pageBg:       "#EFF6FF",         // ✅ bleu pâle
  white:        "#FFFFFF",
  cardBorder:   "#DBEAFE",
  inputBg:      "#F4F7FF",
  ink:          "#0F172A",
  inkMid:       "#374151",
  inkSoft:      "#6B7280",
  green:        "#10B981", greenBg: "#ECFDF5", greenBorder: "#A7F3D0",
  red:          "#EF4444",
  blue:         "#3B82F6", blueBg: "#EFF6FF", blueBorder: "#BFDBFE",
  amber:        "#F59E0B", amberBg: "#FFFBEB", amberBorder: "#FDE68A",
  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia",     android: "serif",             default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace" }),
  },
};

// ─── Montants rapides par devise ─────────────────────────
const QUICK_BY_CURRENCY: Record<string, number[]> = {
  XOF: [1_000, 2_000, 5_000, 10_000, 25_000, 50_000, 100_000],
  GNF: [10_000, 20_000, 50_000, 100_000, 250_000, 500_000, 1_000_000],
  EUR: [10, 20, 50, 100, 200, 500],
  USD: [10, 20, 50, 100, 200, 500],
  GBP: [10, 20, 50, 100, 200, 500],
};

function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

// ─── Arc concave ─────────────────────────────────────────
function HeroConcave() {
  const d  = `M 0 0 L 0 ${CONCAVE_H} Q ${SW / 2} 0 ${SW} ${CONCAVE_H} L ${SW} 0 Z`;
  const bd = `M 0 ${CONCAVE_H} Q ${SW / 2} 0 ${SW} ${CONCAVE_H}`;
  return (
    <Svg width={SW} height={CONCAVE_H} style={{ marginTop: -1 }}>
      <Rect x={0} y={0} width={SW} height={CONCAVE_H} fill={C.pageBg} />
      <Path d={d} fill={AGENT_BLUE} />
      <Path d={bd} fill="none" stroke="rgba(37,99,235,0.22)" strokeWidth={1.5} />
    </Svg>
  );
}

// ─── Sélecteur pays (indicatif) ──────────────────────────
function CountryPickerModal({ visible, onClose, onSelect }: {
  visible: boolean; onClose: () => void; onSelect: (c: CountryData) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? countriesList.filter(c =>
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.dialCode.includes(q.replace("+", ""))
      )
    : countriesList;
  const close = () => { onClose(); setQ(""); };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={cp.overlay}>
        <View style={cp.sheet}>
          <View style={cp.handle} />
          <View style={cp.head}>
            <Text style={[cp.title, { fontFamily: C.font.sans }]}>Indicatif pays</Text>
            <TouchableOpacity style={cp.closeBtn} onPress={close}>
              <Ionicons name="close" size={17} color={C.inkSoft} />
            </TouchableOpacity>
          </View>
          <View style={cp.search}>
            <Ionicons name="search" size={14} color={C.inkSoft} />
            <TextInput
              style={[cp.searchInput, { fontFamily: C.font.sans }]}
              value={q} onChangeText={setQ}
              placeholder="Pays ou indicatif…" placeholderTextColor={C.inkSoft}
              autoFocus
            />
            {!!q && (
              <TouchableOpacity onPress={() => setQ("")} hitSlop={8}>
                <Ionicons name="close" size={13} color={C.inkSoft} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={filtered} keyExtractor={(c) => c.code}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 30 }}
            renderItem={({ item: c }) => (
              <TouchableOpacity style={cp.item} onPress={() => { onSelect(c); close(); }} activeOpacity={0.75}>
                <Text style={{ fontSize: 22, marginRight: 12 }}>{c.flag}</Text>
                <Text style={[cp.itemName, { fontFamily: C.font.sans }]}>{c.name}</Text>
                <View style={cp.chip}>
                  <Text style={[cp.chipTxt, { fontFamily: C.font.mono }]}>+{c.dialCode}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={[cp.empty, { fontFamily: C.font.sans }]}>Aucun résultat</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}
const cp = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet:     { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "78%", borderWidth: 1, borderColor: C.cardBorder },
  handle:    { width: 36, height: 4, borderRadius: C.r.pill, backgroundColor: C.cardBorder, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  head:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  title:     { color: C.ink, fontSize: 17, fontWeight: "700" },
  closeBtn:  { width: 30, height: 30, borderRadius: 9, backgroundColor: C.pageBg, justifyContent: "center", alignItems: "center" },
  search:    { flexDirection: "row", alignItems: "center", gap: 10, margin: 14, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 12, height: 42 },
  searchInput:{ flex: 1, fontSize: 14, color: C.ink, fontWeight: "600" },
  item:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  itemName:  { flex: 1, color: C.ink, fontSize: 14, fontWeight: "600" },
  chip:      { backgroundColor: C.violetLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.violetBorder },
  chipTxt:   { color: AGENT_BLUE, fontSize: 11, fontWeight: "900" },
  empty:     { color: C.inkSoft, textAlign: "center", padding: 24, fontWeight: "600" },
});

// ─── Field ──────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, keyboardType, required }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={f.wrap}>
      <Text style={[f.label, { fontFamily: C.font.sans }]}>
        {label}{required && <Text style={{ color: C.red }}> *</Text>}
      </Text>
      <View style={[f.box, focused && f.focused]}>
        <TextInput
          style={[f.input, { fontFamily: C.font.sans }]}
          value={value} onChangeText={onChangeText}
          placeholder={placeholder} placeholderTextColor={C.inkSoft}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}
const f = StyleSheet.create({
  wrap:    { marginBottom: 16 },
  label:   { fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  box:     { backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md },
  focused: { borderColor: AGENT_BLUE, backgroundColor: C.white }, // ✅ bleu
  input:   { paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.ink, fontWeight: "600" },
});

// ─── Main ───────────────────────────────────────────────
export default function AgentDepositScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // ── Indicatif pays ──
  const [country,     setCountry]     = useState<CountryData>(DEFAULT_COUNTRY);
  const [showPicker,  setShowPicker]  = useState(false);

  const [phone,          setPhone]          = useState("");
  const [amount,         setAmount]         = useState("");
  const [loading,        setLoading]        = useState(false);
  const [agentCurrency,  setAgentCurrency]  = useState<string>(
    (user as any)?.primaryCurrency ?? "XOF"
  );
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Charge la devise de l'agence ──────────────────────
  useEffect(() => {
    const loadCurrency = async () => {
      try {
        const wallets = await api.getMyWallets();
        if (Array.isArray(wallets) && wallets.length > 0) {
          const primary = wallets.find((w) => w.isDefault) ?? wallets[0];
          if (primary?.currency) setAgentCurrency(primary.currency);
        }
      } catch {
        const primary = (user as any)?.primaryCurrency;
        if (primary) setAgentCurrency(primary);
      }
    };
    void loadCurrency();
  }, []);

  const numAmount    = parseFloat(amount) || 0;
  const fullPhone    = `${country.dialCode}${phone.trim()}`;
  const canSubmit    = phone.trim().length >= 6 && numAmount > 0;
  const quickAmounts = QUICK_BY_CURRENCY[agentCurrency] ?? QUICK_BY_CURRENCY.XOF;

  // ── Animation résumé ──────────────────────────────────
  const updateAnim = (phoneVal: string, amtVal: string) => {
    const n = parseFloat(amtVal) || 0;
    Animated.timing(fadeAnim, {
      toValue: n > 0 && phoneVal.trim().length >= 6 ? 1 : 0,
      duration: 200, useNativeDriver: true,
    }).start();
  };
  const onAmountChange = (v: string) => { setAmount(v); updateAnim(phone, v); };
  const onPhoneChange  = (v: string) => { setPhone(v);  updateAnim(v, amount); };

  const showAlertCross = (title: string, msg: string, onOk?: () => void) => {
    if (Platform.OS === "web") {
      setTimeout(() => { window.alert(`${title}\n\n${msg}`); if (onOk) onOk(); }, 100);
    } else {
      Alert.alert(title, msg, [{ text: "OK", onPress: onOk }]);
    }
  };

  const handleDeposit = () => {
    if (!canSubmit) {
      showAlertCross("Champs manquants", "Veuillez remplir le numéro et le montant.");
      return;
    }
    const msg = `Créditer ${fmt(numAmount, agentCurrency)} ${agentCurrency} sur le wallet ${fullPhone} ?`;
    if (Platform.OS === "web") {
      if (window.confirm(msg)) void process();
    } else {
      Alert.alert("Confirmation Dépôt", msg, [
        { text: "Annuler", style: "cancel" },
        { text: "CONFIRMER", onPress: () => void process() },
      ]);
    }
  };

  const process = async () => {
    setLoading(true);
    try {
      const result = await api.http.post("/transactions/deposit", {
        userPhone: fullPhone,
        amount:    numAmount,
      });
      const creditedCurrency: string = result?.data?.currency ?? agentCurrency;
      const creditedAmount:   number = result?.data?.amount   ?? numAmount;
      showAlertCross(
        "✅ Dépôt effectué",
        `${fmt(creditedAmount, creditedCurrency)} ${creditedCurrency} crédités sur ${fullPhone}.`,
        () => router.back(),
      );
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Le dépôt a échoué.";
      showAlertCross("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={AGENT_BLUE} />

      {/* ══ HÉRO + ARC CONCAVE ══ */}
      <View>
        <View style={s.hero}>
          <View style={s.glow} />
          <View style={s.heroRow}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="arrow-back" size={20} color={C.white} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Dépôt Client</Text>
              <Text style={[s.heroSub, { fontFamily: C.font.sans }]}>Cash-In · Crédit Wallet</Text>
            </View>
            {/* Badge devise dynamique */}
            <View style={s.heroBadge}>
              <Text style={[s.heroBadgeTxt, { fontFamily: C.font.mono }]}>{agentCurrency}</Text>
            </View>
          </View>
        </View>
        <HeroConcave />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Bannière info */}
          <View style={s.banner}>
            <View style={s.bannerIconBox}>
              <Ionicons name="wallet-outline" size={16} color={C.blue} />
            </View>
            <Text style={[s.bannerTxt, { fontFamily: C.font.sans }]}>
              Les fonds sont crédités{" "}
              <Text style={{ fontWeight: "800" }}>instantanément</Text>
              {" "}en{" "}
              <Text style={{ fontWeight: "800" }}>{agentCurrency}</Text>
              {" "}sur le Wallet du client.
            </Text>
          </View>

          {/* Formulaire */}
          <View style={s.card}>
            <View style={s.secRow}>
              <View style={[s.secDot, { backgroundColor: AGENT_BLUE }]} />
              <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>INFORMATIONS DÉPÔT</Text>
            </View>

            {/* ── Téléphone + indicatif pays ── */}
            <Text style={[f.label, { fontFamily: C.font.sans }]}>
              Numéro du client <Text style={{ color: C.red }}>*</Text>
            </Text>
            <View style={s.phoneRow}>
              {/* Bouton indicatif */}
              <TouchableOpacity style={s.dialBtn} onPress={() => setShowPicker(true)} activeOpacity={0.75}>
                <Text style={{ fontSize: 18 }}>{country.flag}</Text>
                <Text style={[s.dialCode, { fontFamily: C.font.mono }]}>+{country.dialCode}</Text>
                <Ionicons name="caret-down" size={10} color={C.inkSoft} />
              </TouchableOpacity>
              {/* Champ numéro */}
              <View style={s.phoneInput}>
                <TextInput
                  style={[s.phoneInputTxt, { fontFamily: C.font.sans }]}
                  value={phone}
                  onChangeText={onPhoneChange}
                  placeholder="620 000 000"
                  placeholderTextColor={C.inkSoft}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={s.divider} />

            {/* ── Montant compact ── */}
            <Text style={[f.label, { fontFamily: C.font.sans, marginBottom: 8 }]}>
              Montant <Text style={{ color: C.red }}>*</Text>
            </Text>
            <View style={[s.amtBox, numAmount > 0 && { borderColor: AGENT_BLUE }]}>
              <TextInput
                style={[s.amtInput, { fontFamily: C.font.serif }]}
                value={amount}
                onChangeText={onAmountChange}
                placeholder="0"
                placeholderTextColor={C.inkSoft}
                keyboardType="numeric"
              />
              <View style={s.curBox}>
                <Text style={[s.curTxt, { fontFamily: C.font.mono }]}>{agentCurrency}</Text>
              </View>
            </View>

            {/* ── Montants rapides — ScrollView horizontal ── */}
            <Text style={[s.quickLbl, { fontFamily: C.font.sans }]}>MONTANTS RAPIDES</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.quickRow}
            >
              {quickAmounts.map((v) => {
                const active = numAmount === v;
                return (
                  <TouchableOpacity
                    key={v}
                    style={[s.quickPill, active && s.quickPillActive]}
                    onPress={() => { setAmount(String(v)); onAmountChange(String(v)); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      s.quickTxt, { fontFamily: C.font.mono },
                      active && { color: AGENT_BLUE, fontWeight: "900" },
                    ]}>
                      {fmt(v, agentCurrency)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Résumé animé */}
          <Animated.View style={[s.summary, { opacity: fadeAnim }]}>
            <View style={s.summaryHead}>
              <View style={s.summaryIconBox}>
                <Ionicons name="receipt-outline" size={14} color={AGENT_BLUE} />
              </View>
              <Text style={[s.summaryTitle, { fontFamily: C.font.sans }]}>Récapitulatif</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={[s.sumLbl, { fontFamily: C.font.sans }]}>Client</Text>
              <Text style={[s.sumVal, { fontFamily: C.font.mono }]}>{fullPhone || "—"}</Text>
            </View>
            <View style={s.sumDivider} />
            <View style={s.summaryRow}>
              <Text style={[s.sumLbl, { fontFamily: C.font.sans }]}>Montant à créditer</Text>
              <Text style={[s.sumAmt, { fontFamily: C.font.serif }]}>
                {fmt(numAmount, agentCurrency)} {agentCurrency}
              </Text>
            </View>
          </Animated.View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.cta, (!canSubmit || loading) && { opacity: 0.4 }]}
            onPress={handleDeposit}
            disabled={!canSubmit || loading}
            activeOpacity={0.88}
          >
            <View style={s.ctaInner}>
              {loading
                ? <ActivityIndicator color={C.white} />
                : <>
                    <Ionicons name="checkmark-circle-outline" size={20} color={C.white} />
                    <Text style={[s.ctaTxt, { fontFamily: C.font.sans }]}>VALIDER LE DÉPÔT</Text>
                  </>
              }
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()} disabled={loading}>
            <Text style={[s.cancelTxt, { fontFamily: C.font.sans }]}>Annuler</Text>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sélecteur indicatif */}
      <CountryPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={(c) => { setCountry(c); setShowPicker(false); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  // ✅ Héro bleu compact + sans borderRadius (arc)
  hero: {
    backgroundColor: AGENT_BLUE,
    paddingHorizontal: 20,
    paddingTop:    Platform.OS === "android" ? 44 : 16,
    paddingBottom: 16,  // ✅ réduit (24→16)
    overflow:      "hidden",
  },
  glow:     { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: C.heroGlow, top: -60, right: -40 },
  heroRow:  { flexDirection: "row", alignItems: "center", gap: 14 },
  backBtn:  { width: 38, height: 38, borderRadius: C.r.sm, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center" },
  heroTitle:{ color: C.white, fontSize: 22, fontWeight: "700" },
  heroSub:  { color: C.heroDim, fontSize: 11, fontWeight: "600", marginTop: 2 },
  heroBadge:{ height: 38, paddingHorizontal: 12, borderRadius: C.r.sm, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center" },
  heroBadgeTxt: { color: C.white, fontSize: 11, fontWeight: "900", letterSpacing: 1 },

  scroll: { paddingHorizontal: 18, paddingTop: 16 },

  banner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.blueBg, borderRadius: C.r.md,
    padding: 13, borderWidth: 1, borderColor: C.blueBorder, marginBottom: 16,
  },
  bannerIconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: "#DBEAFE", justifyContent: "center", alignItems: "center", flexShrink: 0 },
  bannerTxt:     { flex: 1, color: "#1D4ED8", fontSize: 12, fontWeight: "600", lineHeight: 18 },

  card: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    padding: 17, marginBottom: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: AGENT_BLUE, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  secRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  secDot: { width: 5, height: 5, borderRadius: C.r.pill },
  secLbl: { fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1.5 },

  // ── Téléphone + indicatif ──
  phoneRow:     { flexDirection: "row", gap: 8, marginBottom: 14 },
  dialBtn:      { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 10, paddingVertical: 12, flexShrink: 0 },
  dialCode:     { color: C.ink, fontSize: 12, fontWeight: "800" },
  phoneInput:   { flex: 1, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, overflow: "hidden" },
  phoneInputTxt:{ paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: C.ink, fontWeight: "600" },

  divider: { height: 1, backgroundColor: "#F1F5F9", marginBottom: 14 },

  // ── Montant compact ✅ ──
  amtBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder,
    borderRadius: C.r.md, overflow: "hidden", marginBottom: 16,
  },
  amtInput: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 11,  // ✅ 14→11
    fontSize: 20, color: C.ink, fontWeight: "800",         // ✅ 30→20
  },
  curBox: {
    paddingHorizontal: 14, paddingVertical: 11,
    backgroundColor: C.violetLight, borderLeftWidth: 1, borderLeftColor: C.violetBorder,
    justifyContent: "center",
  },
  curTxt: { color: AGENT_BLUE, fontSize: 12, fontWeight: "900", letterSpacing: 1 },

  // ── Montants rapides horizontaux ──
  quickLbl:      { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" },
  quickRow:      { gap: 7, paddingBottom: 2 },
  quickPill:     { paddingHorizontal: 12, paddingVertical: 8, borderRadius: C.r.md, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder },
  quickPillActive:{ backgroundColor: C.violetLight, borderColor: `${AGENT_BLUE}50` },
  quickTxt:      { fontSize: 11, fontWeight: "700", color: C.inkSoft },

  summary: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    padding: 17, marginBottom: 14,
    borderWidth: 1.5, borderColor: C.violetBorder,
    shadowColor: AGENT_BLUE, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  summaryHead:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 13 },
  summaryIconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.violetLight, justifyContent: "center", alignItems: "center" },
  summaryTitle:   { fontSize: 12, fontWeight: "900", color: AGENT_BLUE, letterSpacing: 0.5 },
  summaryRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sumLbl:         { color: C.inkSoft, fontSize: 12, fontWeight: "700" },
  sumVal:         { color: C.ink, fontSize: 13, fontWeight: "800" },
  sumDivider:     { height: 1, backgroundColor: C.violetBorder, marginVertical: 10 },
  sumAmt:         { fontSize: 20, fontWeight: "900", color: AGENT_BLUE },

  cta:       { borderRadius: C.r.md, overflow: "hidden", marginBottom: 10 },
  ctaInner:  { backgroundColor: AGENT_BLUE, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 17, gap: 8, borderRadius: C.r.md },
  ctaTxt:    { color: C.white, fontWeight: "900", fontSize: 13, letterSpacing: 1 },
  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelTxt: { color: C.inkSoft, fontWeight: "800", fontSize: 14 },
});