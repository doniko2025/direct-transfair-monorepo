// apps/direct-transfair-mobile/app/(tabs)/send.tsx
// =========================================================
// SEND MONEY v2.3 — Direct Transf'air
// ✅ v2.1 : fmt() max 2 décimales
// ✅ v2.2 : fond blanc neutre #FAFAFA
//    - bg #F0FDF9 → #FAFAFA (suppression teinte verte)
//    - tabsWrap : fond #F0F0F0 neutre
//    - amountInput fontSize 32→24, amountReceived 28→22
//    - CTA shadow neutre (shadowColor #000)
// ✅ v2.3 : FIX taux hardcodé 1,5%
//    - cashFeeRate et cashFeeLabel chargés depuis GET /commissions/fees
//    - feesRate = mode === "WALLET" ? 0 : cashFeeRate (plus hardcodé)
//    - Label "Frais (X %)" dynamique
//    - Fallback silencieux à 1,5% si endpoint inaccessible
// =========================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Pressable,
  ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform,
  ScrollView, Alert, Modal, FlatList, StatusBar, Animated,
  Dimensions,
} from "react-native";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";
import type { Beneficiary, ExchangeRate } from "../../services/types";
import { countriesList, CountryData } from "../../data/countries";

const { width: W } = Dimensions.get("window");

const F = {
  display: Platform.select({ ios: "Georgia",    android: "serif",         default: "serif"      }),
  body:    Platform.select({ ios: "System",      android: "sans-serif",    default: "sans-serif" }),
};

const C = {
  g1: "#022C22", g2: "#064E3B", g3: "#065F46", g4: "#059669",
  g5: "#10B981", g6: "#34D399", gSoft: "#ECFDF5", gBorder: "#A7F3D0",
  white: "#FFFFFF",
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  border: "#E5E5EA",
  borderLight: "#F0F0F0",
  text: "#0F172A", textSub: "#374151", textMuted: "#64748B", textFaint: "#9CA3AF",
  danger: "#EF4444", dangerSoft: "#FEF2F2",
  amber: "#D97706", amberSoft: "#FFFBEB",
  blue: "#2563EB", blueSoft: "#EFF6FF",
  orange: "#EA580C", orangeSoft: "#FFF7ED",
};

// ─── Helpers ──────────────────────────────────────────────
const getCountryData = (countryName: string): CountryData => {
  const normalized = (countryName || "").toLowerCase();
  return (
    countriesList.find((c) => c.name.toLowerCase().includes(normalized)) ||
    countriesList.find((c) => c.code === "SN")!
  );
};

const fmt = (val: number) =>
  val.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  if (v && typeof (v as any).toNumber === "function") return (v as any).toNumber();
  return 0;
}

// ─── Mode Tab ─────────────────────────────────────────────
function ModeTab({ label, icon, active, onPress }: {
  label: string; icon: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[tS.tab, active && tS.tabActive]}
      onPress={onPress} activeOpacity={0.85}
    >
      <Ionicons name={icon as any} size={17} color={active ? C.g4 : C.textMuted} style={{ marginBottom: 4 }} />
      <Text style={[tS.txt, { fontFamily: F.body }, active && tS.txtActive]}>{label}</Text>
    </TouchableOpacity>
  );
}
const tS = StyleSheet.create({
  tab:       { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 14, gap: 2 },
  tabActive: {
    backgroundColor: C.white,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.09, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  txt:       { fontSize: 12, fontWeight: "600", color: C.textMuted },
  txtActive: { color: C.g4, fontWeight: "800" },
});

// ─── Beneficiary Card ─────────────────────────────────────
function BeneficiaryCard({ item, selected, onPress }: {
  item: Beneficiary; selected: boolean; onPress: () => void;
}) {
  const scale    = useRef(new Animated.Value(1)).current;
  const cd       = getCountryData(item.country);
  const initials = item.fullName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[bS.card, selected && bS.cardSelected]}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30 }).start()}
        activeOpacity={1}
      >
        <View style={[bS.avatar, selected && bS.avatarSelected]}>
          <Text style={[bS.avatarTxt, { fontFamily: F.display }, selected && { color: C.g4 }]}>{initials}</Text>
        </View>
        <Text style={[bS.name, { fontFamily: F.body }, selected && { color: C.g4 }]} numberOfLines={1}>
          {item.fullName.split(" ")[0]}
        </Text>
        <Text style={bS.flag}>{cd.flag}</Text>
        {selected && (
          <View style={bS.check}><Ionicons name="checkmark" size={10} color={C.white} /></View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
const bS = StyleSheet.create({
  card:           { width: 76, alignItems: "center", marginRight: 12, padding: 12, backgroundColor: C.surface, borderRadius: 20, borderWidth: 1.5, borderColor: C.border },
  cardSelected:   { borderColor: C.g4, backgroundColor: C.gSoft },
  avatar:         { width: 44, height: 44, borderRadius: 14, backgroundColor: "#E0F2FE", justifyContent: "center", alignItems: "center", marginBottom: 6 },
  avatarSelected: { backgroundColor: `${C.g4}20` },
  avatarTxt:      { fontSize: 16, fontWeight: "900", color: "#0284C7" },
  name:           { fontSize: 11, fontWeight: "700", color: C.textSub, textAlign: "center" },
  flag:           { fontSize: 14, marginTop: 4 },
  check:          { position: "absolute", top: -5, right: -5, backgroundColor: C.g4, borderRadius: 99, width: 20, height: 20, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: C.white },
});

// ─── Summary Row ──────────────────────────────────────────
function SummaryRow({ label, value, valueColor, large }: {
  label: string; value: string; valueColor?: string; large?: boolean;
}) {
  return (
    <View style={srS.row}>
      <Text style={[srS.label, { fontFamily: F.body }, large && srS.labelLarge]}>{label}</Text>
      <Text style={[srS.value, { fontFamily: large ? F.display : F.body }, large && srS.valueLarge, valueColor ? { color: valueColor } : {}]}>
        {value}
      </Text>
    </View>
  );
}
const srS = StyleSheet.create({
  row:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  label:      { fontSize: 13, color: C.textMuted, fontWeight: "600" },
  value:      { fontSize: 14, color: C.text, fontWeight: "700" },
  labelLarge: { fontSize: 14, color: C.text, fontWeight: "800" },
  valueLarge: { fontSize: 26, color: C.g4, letterSpacing: -0.5 },
});

// ─── Fallback Modal ───────────────────────────────────────
function FallbackModal({ visible, missing, currency, onClose, onOrangeMoney, onCard }: {
  visible: boolean; missing: number; currency: string;
  onClose: () => void; onOrangeMoney: () => void; onCard: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={fbS.overlay}>
        <View style={fbS.sheet}>
          <View style={fbS.handle} />
          <View style={fbS.warningBox}>
            <Ionicons name="wallet-outline" size={24} color={C.amber} />
            <View style={{ flex: 1 }}>
              <Text style={[fbS.warnTitle, { fontFamily: F.body }]}>Solde insuffisant</Text>
              <Text style={[fbS.warnSub, { fontFamily: F.body }]}>
                Il vous manque <Text style={fbS.warnAmount}>{fmt(missing)} {currency}</Text>
              </Text>
            </View>
          </View>
          <Text style={[fbS.chooseTitle, { fontFamily: F.body }]}>Choisissez un moyen de paiement</Text>
          <TouchableOpacity style={[fbS.option, { borderColor: "#F97316" }]} onPress={onOrangeMoney} activeOpacity={0.85}>
            <View style={[fbS.optIcon, { backgroundColor: "#FFF7ED" }]}><Text style={{ fontSize: 24 }}>🟠</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[fbS.optTitle, { fontFamily: F.body, color: C.orange }]}>Orange Money</Text>
              <Text style={[fbS.optSub, { fontFamily: F.body }]}>Payer depuis votre compte Orange</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.orange} />
          </TouchableOpacity>
          <TouchableOpacity style={[fbS.option, { borderColor: C.blue }]} onPress={onCard} activeOpacity={0.85}>
            <View style={[fbS.optIcon, { backgroundColor: C.blueSoft }]}><Ionicons name="card-outline" size={22} color={C.blue} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[fbS.optTitle, { fontFamily: F.body, color: C.blue }]}>Carte bancaire</Text>
              <Text style={[fbS.optSub, { fontFamily: F.body }]}>Visa, Mastercard, CB</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.blue} />
          </TouchableOpacity>
          <TouchableOpacity style={fbS.cancelBtn} onPress={onClose}>
            <Text style={[fbS.cancelTxt, { fontFamily: F.body }]}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: Platform.OS === "ios" ? 24 : 12 }} />
        </View>
      </View>
    </Modal>
  );
}
const fbS = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:      { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  handle:     { width: 40, height: 4, borderRadius: 99, backgroundColor: C.border, alignSelf: "center", marginBottom: 20 },
  warningBox: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.amberSoft, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#FDE68A" },
  warnTitle:  { fontSize: 15, fontWeight: "800", color: C.text, marginBottom: 3 },
  warnSub:    { fontSize: 13, color: C.textMuted, fontWeight: "600" },
  warnAmount: { color: C.amber, fontWeight: "900" },
  chooseTitle:{ fontSize: 13, fontWeight: "900", color: C.textMuted, letterSpacing: 0.8, marginBottom: 14 },
  option:     { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, borderWidth: 1.5, marginBottom: 12, backgroundColor: C.white },
  optIcon:    { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  optTitle:   { fontSize: 15, fontWeight: "800", marginBottom: 3 },
  optSub:     { fontSize: 12, color: C.textMuted, fontWeight: "600" },
  cancelBtn:  { alignItems: "center", paddingVertical: 14 },
  cancelTxt:  { fontSize: 15, fontWeight: "700", color: C.textMuted },
});

// ─── Main ─────────────────────────────────────────────────
export default function SendMoneyScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const [loading,          setLoading]         = useState(true);
  const [beneficiaries,    setBeneficiaries]    = useState<Beneficiary[]>([]);
  const [allRates,         setAllRates]         = useState<ExchangeRate[]>([]);
  const [sending,          setSending]          = useState(false);
  const [showBalance,      setShowBalance]      = useState(true);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showFallback,     setShowFallback]     = useState(false);
  const [walletBalance,    setWalletBalance]    = useState(0);
  const [loadingWallet,    setLoadingWallet]    = useState(true);

  const userCurrency = (user as any)?.primaryCurrency || (user as any)?.currency || "XOF";

  const [mode,         setMode]        = useState<"WALLET" | "CASH">("WALLET");
  const [isModeLocked, setIsModeLocked]= useState(false);
  const [walletInput,         setWalletInput]        = useState("");
  const [detectedBeneficiary, setDetectedBeneficiary]= useState<Beneficiary | null>(null);
  const [selectedCashId,      setSelectedCashId]     = useState<string | null>(null);
  const [targetCurrency,    setTargetCurrency]   = useState("XOF");
  const [targetCountryData, setTargetCountryData]= useState<CountryData>(getCountryData("Sénégal"));
  const [rate,              setRate]             = useState<number>(1);
  const [rawAmount,         setRawAmount]        = useState("");
  const [countrySearch,     setCountrySearch]    = useState("");

  // ✅ v2.3 FIX : taux dynamique (défaut 1,5% si GET /commissions/fees inaccessible)
  const [cashFeeRate,  setCashFeeRate]  = useState(0.015);
  const [cashFeeLabel, setCashFeeLabel] = useState("1,5");

  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 4 }),
      Animated.spring(cardAnim,   { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 4 }),
    ]).start();
  }, []);

  useEffect(() => {
    if (params.mode) {
      const m = params.mode as "WALLET" | "CASH";
      setMode(m); setIsModeLocked(true);
      if (m === "WALLET" && params.phone) setWalletInput(params.phone as string);
      if (m === "CASH" && params.beneficiaryId) setSelectedCashId(params.beneficiaryId as string);
    }
  }, [params]);

  // ✅ v2.3 FIX : charge le taux CASH_PICKUP depuis /commissions/fees
  // Endpoint public (tous rôles authentifiés), fallback silencieux à 1,5%
  useEffect(() => {
    (api.http as any).get("/commissions/fees")
      .then((res: any) => {
        const list: any[] = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        const r = list.find((c: any) => c.payoutMethod === "CASH_PICKUP");
        if (r) {
          const raw = Number(r.feeRate ?? 1.5);
          setCashFeeRate(raw / 100);
          setCashFeeLabel(raw.toFixed(1).replace(".", ","));
        }
      })
      .catch(() => {
        // Fallback silencieux → 1,5% par défaut
      });
  }, []);

  const fetchWalletBalance = useCallback(async () => {
    setLoadingWallet(true);
    try {
      const wallets = await api.getMyWallets();
      const w = wallets.find((w) => w.currency === userCurrency) ?? wallets.find((w) => (w as any).isDefault) ?? wallets[0];
      if (w) setWalletBalance(toNum(w.balance) - toNum((w as any).reservedBalance ?? 0));
      else {
        const uw = ((user as any)?.wallets ?? []).find((w: any) => w.currency === userCurrency) ?? (user as any)?.wallets?.[0];
        setWalletBalance(uw ? toNum(uw.balance) - toNum(uw.reservedBalance ?? 0) : 0);
      }
    } catch {
      const uw = ((user as any)?.wallets ?? []).find((w: any) => w.currency === userCurrency) ?? (user as any)?.wallets?.[0];
      setWalletBalance(uw ? toNum(uw.balance) - toNum(uw.reservedBalance ?? 0) : 0);
    } finally { setLoadingWallet(false); }
  }, [userCurrency, user]);

  useFocusEffect(useCallback(() => {
    const init = async () => {
      try {
        const [rates, list] = await Promise.all([api.getExchangeRates(), api.getBeneficiaries()]);
        setAllRates(rates); setBeneficiaries(list);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    void init();
    void fetchWalletBalance();
  }, [fetchWalletBalance]));

  const updateCurrencyContext = useCallback((countryName: string) => {
    const cd = getCountryData(countryName);
    setTargetCountryData(cd);
    let tCurr = "XOF";
    const cn = cd.name.toLowerCase();
    if (cn.includes("guinée") && !cn.includes("bissau") && !cn.includes("équat")) tCurr = "GNF";
    else if (cn.includes("maroc")) tCurr = "MAD";
    else if (
      cn.includes("france") || cn.includes("belgi") || cn.includes("allem") ||
      cn.includes("espagne") || cn.includes("itali") || cn.includes("portug")
    ) tCurr = "EUR";
    setTargetCurrency(tCurr);
    const getR = (pair: string, fb: number) => allRates.find((r) => r.pair === pair)?.rate ?? fb;
    const toEurUser   = userCurrency === "EUR" ? 1 : getR(`EUR_${userCurrency}`, userCurrency === "XOF" ? 655.95 : 1);
    const toEurTarget = tCurr === "EUR" ? 1 : getR(`EUR_${tCurr}`, tCurr === "XOF" ? 655.95 : tCurr === "GNF" ? 8600 : 1);
    setRate(toEurTarget / toEurUser);
  }, [allRates, userCurrency]);

  useEffect(() => {
    if (mode === "WALLET" && walletInput.length >= 3) {
      const q = walletInput.toLowerCase().trim();
      const cleanPhone = walletInput.replace(/^\+?\d{1,3}/, "").replace(/^0+/, "").replace(/\s/g, "");
      const found = beneficiaries.find((b) =>
        (b.phone && b.phone.includes(cleanPhone)) ||
        (b.email && b.email.toLowerCase().includes(q)) ||
        (b.fullName && b.fullName.toLowerCase().includes(q))
      );
      if (found) { setDetectedBeneficiary(found); updateCurrencyContext(found.country); }
      else setDetectedBeneficiary(null);
    } else setDetectedBeneficiary(null);
  }, [walletInput, beneficiaries, mode, updateCurrencyContext]);

  useEffect(() => {
    if (mode === "CASH" && selectedCashId) {
      const found = beneficiaries.find((b) => String(b.id) === selectedCashId);
      if (found) updateCurrencyContext(found.country);
    }
  }, [selectedCashId, mode, beneficiaries, updateCurrencyContext]);

  const sendAmount = parseFloat(rawAmount.replace(/\s/g, "").replace(",", ".")) || 0;

  // ✅ v2.3 FIX : cashFeeRate dynamique (plus 0.015 hardcodé)
  const feesRate    = mode === "WALLET" ? 0 : cashFeeRate;
  const feesAmt     = sendAmount * feesRate;
  const totalAmt    = sendAmount + feesAmt;
  const receivedAmt = sendAmount * rate;
  const insufficient   = totalAmt > walletBalance && sendAmount > 0;
  const missingAmount  = Math.max(0, totalAmt - walletBalance);
  const isNumericInput = walletInput.trim() === "" || /^[0-9+\s]+$/.test(walletInput);
  const canSend = sendAmount > 0 && !insufficient && (mode === "WALLET" ? walletInput.length >= 3 : !!selectedCashId);

  const handleAction = async () => {
    if (insufficient) { setShowFallback(true); return; }
    if (sendAmount <= 0) return Alert.alert("Montant invalide", "Saisissez un montant valide.");
    setSending(true);
    try {
      if (mode === "WALLET") {
        if (!detectedBeneficiary && walletInput.length < 7) {
          setSending(false);
          return Alert.alert("Erreur", "Numéro trop court ou contact introuvable.");
        }
        await api.createTransaction({
          amount:          sendAmount,
          currency:        userCurrency,
          beneficiaryId:   detectedBeneficiary ? String(detectedBeneficiary.id) : undefined,
          payoutMethod:    "MOBILE_MONEY",
        });
        Alert.alert("✓ Envoyé", "Transfert wallet effectué avec succès !");
      } else {
        if (!selectedCashId) {
          setSending(false);
          return Alert.alert("Erreur", "Sélectionnez un bénéficiaire.");
        }
        await api.createTransaction({
          amount:        sendAmount,
          currency:      userCurrency,
          beneficiaryId: selectedCashId,
          payoutMethod:  "CASH_PICKUP",
        });
        Alert.alert("✓ Code généré", "Le bénéficiaire peut retirer l'argent avec le code.");
      }
      void fetchWalletBalance();
      router.push("/(tabs)/transactions");
    } catch (e: any) {
      const msg = e.response?.data?.message || "Une erreur est survenue.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally { setSending(false); }
  };

  const filteredCountries = countriesList.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={C.g4} />
        <Text style={[s.loaderTxt, { fontFamily: F.body }]}>Chargement…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.g2} />

      {/* ══ HEADER ══ */}
      <Animated.View style={[s.header, {
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0,1], outputRange: [-20,0] }) }],
      }]}>
        <View style={s.hdeco1} />
        <View style={s.hdeco2} />

        <View style={s.headerTop}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { fontFamily: F.display }]}>
            {mode === "WALLET" ? "Transfert Wallet" : "Envoi d'Argent"}
          </Text>
          <TouchableOpacity style={s.eyeBtn} onPress={() => setShowBalance(!showBalance)}>
            <Ionicons name={showBalance ? "eye-outline" : "eye-off-outline"} size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>

        {/* Balance */}
        <View style={s.balanceHero}>
          <Text style={[s.balanceLbl, { fontFamily: F.body }]}>Solde disponible</Text>
          {loadingWallet
            ? <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />
            : <Text style={[s.balanceVal, { fontFamily: F.display }]}>
                {showBalance ? `${fmt(walletBalance)} ${userCurrency}` : "• • • • •"}
              </Text>
          }
          {insufficient && sendAmount > 0 && (
            <View style={s.insufficientBadge}>
              <Ionicons name="warning-outline" size={11} color={C.amber} />
              <Text style={[s.insufficientTxt, { fontFamily: F.body }]}>Solde insuffisant</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* ══ CONTENU ══ */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{
            opacity: cardAnim,
            transform: [{ translateY: cardAnim.interpolate({ inputRange: [0,1], outputRange: [30,0] }) }],
          }}>

            {/* ── Onglets mode ── */}
            {!isModeLocked && (
              <View style={s.tabsWrap}>
                <ModeTab label="Wallet"      icon="phone-portrait-outline" active={mode === "WALLET"} onPress={() => setMode("WALLET")} />
                <ModeTab label="Cash Pickup" icon="cash-outline"           active={mode === "CASH"}   onPress={() => setMode("CASH")}   />
              </View>
            )}

            {/* ── Bénéficiaire ── */}
            <View style={s.block}>
              <View style={s.blockHeader}>
                <View style={[s.blockNum, { backgroundColor: C.gSoft }]}>
                  <Ionicons name="person-outline" size={14} color={C.g4} />
                </View>
                <Text style={[s.blockTitle, { fontFamily: F.body }]}>Bénéficiaire</Text>
              </View>

              {mode === "WALLET" ? (
                <>
                  <View style={s.phoneWrap}>
                    <TouchableOpacity style={s.dialBtn} onPress={() => setShowCountryModal(true)}>
                      <Text style={s.dialFlag}>{targetCountryData.flag}</Text>
                      <Text style={[s.dialCode, { fontFamily: F.body }]}>+{targetCountryData.dialCode}</Text>
                      <Ionicons name="chevron-down" size={12} color={C.textMuted} />
                    </TouchableOpacity>
                    <TextInput
                      style={[s.phoneInput, { fontFamily: F.body }]}
                      value={walletInput}
                      onChangeText={setWalletInput}
                      placeholder="Téléphone, email ou nom…"
                      placeholderTextColor={C.textFaint}
                      keyboardType={isNumericInput ? "phone-pad" : "default"}
                      autoCapitalize="none"
                    />
                    {walletInput.length > 0 && (
                      <TouchableOpacity style={s.clearInputBtn} onPress={() => setWalletInput("")}>
                        <Ionicons name="close-circle" size={18} color={C.textFaint} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {detectedBeneficiary ? (
                    <View style={s.detectedCard}>
                      <View style={s.detectedAvatar}>
                        <Text style={[s.detectedAvatarTxt, { fontFamily: F.display }]}>{detectedBeneficiary.fullName[0]}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.detectedLabel, { fontFamily: F.body }]}>TROUVÉ</Text>
                        <Text style={[s.detectedName,  { fontFamily: F.body }]}>{detectedBeneficiary.fullName}</Text>
                        {detectedBeneficiary.phone && (
                          <Text style={[s.detectedPhone, { fontFamily: F.body }]}>{detectedBeneficiary.phone}</Text>
                        )}
                      </View>
                      <View style={s.detectedCheck}>
                        <Ionicons name="checkmark" size={14} color={C.white} />
                      </View>
                      <Text style={s.detectedFlag}>{getCountryData(detectedBeneficiary.country).flag}</Text>
                    </View>
                  ) : walletInput.length >= 3 ? (
                    <View style={s.addHint}>
                      <View style={s.addHintIcon}>
                        <Ionicons name="person-add-outline" size={16} color={C.g4} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.addHintTxt, { fontFamily: F.body }]}>
                          Aucun contact trouvé pour "{walletInput}"
                        </Text>
                        <Text
                          style={[s.addHintLink, { fontFamily: F.body }]}
                          onPress={() => router.push("/(tabs)/beneficiaries")}
                        >
                          + Ajouter comme bénéficiaire
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
                    {beneficiaries.map((item) => (
                      <BeneficiaryCard
                        key={String(item.id)}
                        item={item}
                        selected={selectedCashId === String(item.id)}
                        onPress={() => setSelectedCashId(String(item.id))}
                      />
                    ))}
                  </ScrollView>

                  {(() => {
                    const sel = beneficiaries.find((b) => String(b.id) === selectedCashId);
                    const cd  = sel ? getCountryData(sel.country) : null;
                    return sel ? (
                      <View style={s.detectedCard}>
                        <View style={s.detectedAvatar}>
                          <Text style={[s.detectedAvatarTxt, { fontFamily: F.display }]}>{sel.fullName[0]}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.detectedLabel, { fontFamily: F.body }]}>SÉLECTIONNÉ</Text>
                          <Text style={[s.detectedName,  { fontFamily: F.body }]}>{sel.fullName}</Text>
                        </View>
                        {cd && <Text style={s.detectedFlag}>{cd.flag}</Text>}
                      </View>
                    ) : null;
                  })()}
                </>
              )}
            </View>

            {/* ── Montant ── */}
            <View style={s.block}>
              <View style={s.blockHeader}>
                <View style={[s.blockNum, { backgroundColor: C.gSoft }]}>
                  <Ionicons name="cash-outline" size={14} color={C.g4} />
                </View>
                {/* ✅ v2.3 FIX : cashFeeLabel dynamique (plus "1,5" hardcodé) */}
                <Text style={[s.blockTitle, { fontFamily: F.body }]}>
                  Montant{feesRate > 0 && (
                    <Text style={{ color: C.amber }}> (Frais {cashFeeLabel} %)</Text>
                  )}
                </Text>
              </View>
              <View style={s.amountCard}>
                <View style={s.amountSide}>
                  <Text style={[s.amountSideLabel, { fontFamily: F.body }]}>VOUS ENVOYEZ</Text>
                  <View style={s.amountInputRow}>
                    <TextInput
                      style={[s.amountInput, { fontFamily: F.display }]}
                      value={rawAmount} onChangeText={setRawAmount}
                      keyboardType="numeric" placeholder="000" placeholderTextColor={C.textFaint}
                    />
                    <View style={[s.currBadge, { backgroundColor: C.gSoft }]}>
                      <Text style={[s.currTxt, { color: C.g4, fontFamily: F.body }]}>{userCurrency}</Text>
                    </View>
                  </View>
                </View>
                <View style={s.amountArrow}>
                  <Ionicons name="swap-horizontal-outline" size={18} color={C.g4} />
                </View>
                <View style={s.amountSide}>
                  <Text style={[s.amountSideLabel, { fontFamily: F.body }]}>
                    {detectedBeneficiary?.fullName?.split(" ")[0] ??
                      (selectedCashId
                        ? (beneficiaries.find((b) => String(b.id) === selectedCashId)?.fullName?.split(" ")[0] ?? "")
                        : "REÇOIT")}
                  </Text>
                  <View style={s.amountInputRow}>
                    <Text style={[s.amountReceived, { fontFamily: F.display }]}>
                      {sendAmount > 0 ? fmt(Math.round(receivedAmt)) : "0"}
                    </Text>
                    <View style={[s.currBadge, { backgroundColor: C.blueSoft }]}>
                      <Text style={[s.currTxt, { color: C.blue, fontFamily: F.body }]}>{targetCurrency}</Text>
                    </View>
                  </View>
                </View>
              </View>
              {sendAmount > 0 && rate !== 1 && (
                <View style={s.rateChip}>
                  <Ionicons name="trending-up-outline" size={13} color={C.g4} />
                  <Text style={[s.rateTxt, { fontFamily: F.body }]}>
                    1 {userCurrency} = {rate.toFixed(4)} {targetCurrency}
                  </Text>
                </View>
              )}
            </View>

            {/* ── Récapitulatif ── */}
            {sendAmount > 0 && (
              <View style={s.block}>
                <View style={s.blockHeader}>
                  <View style={[s.blockNum, { backgroundColor: C.gSoft }]}>
                    <Ionicons name="receipt-outline" size={14} color={C.g4} />
                  </View>
                  <Text style={[s.blockTitle, { fontFamily: F.body }]}>Récapitulatif</Text>
                </View>
                <SummaryRow label="Montant envoyé" value={`${fmt(sendAmount)} ${userCurrency}`} />
                <View style={s.summaryDivider} />
                <SummaryRow
                  label="Frais de transfert"
                  value={feesAmt === 0 ? "Offerts ✓" : `${fmt(feesAmt)} ${userCurrency}`}
                  valueColor={feesAmt === 0 ? C.g4 : undefined}
                />
                {targetCurrency !== userCurrency && (
                  <>
                    <View style={s.summaryDivider} />
                    <SummaryRow label="Montant reçu" value={`${fmt(Math.round(receivedAmt))} ${targetCurrency}`} valueColor={C.blue} />
                  </>
                )}
                <View style={[s.summaryDivider, { backgroundColor: C.gBorder, height: 1.5 }]} />
                <SummaryRow
                  label="TOTAL À PAYER"
                  value={`${fmt(totalAmt)} ${userCurrency}`}
                  valueColor={insufficient ? C.danger : C.g4}
                  large
                />
                {insufficient && (
                  <View style={s.insufficientBar}>
                    <Ionicons name="wallet-outline" size={16} color={C.amber} />
                    <Text style={[s.insufficientBarTxt, { fontFamily: F.body }]}>
                      Il vous manque <Text style={{ fontWeight: "800" }}>{fmt(missingAmount)} {userCurrency}</Text>
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── CTA ── */}
            <Pressable
              style={({ pressed }) => [
                s.cta,
                insufficient && s.ctaAlt,
                !canSend && !insufficient && s.ctaDisabled,
                pressed && { opacity: 0.92 },
              ]}
              onPress={handleAction}
              disabled={sending || (!canSend && !insufficient)}
            >
              {sending ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <View style={s.ctaIcon}>
                    <Ionicons
                      name={insufficient ? "options-outline" : mode === "WALLET" ? "phone-portrait-outline" : "cash-outline"}
                      size={20} color={C.white}
                    />
                  </View>
                  <Text style={[s.ctaTxt, { fontFamily: F.body }]}>
                    {insufficient
                      ? "AUTRE MOYEN DE PAIEMENT"
                      : mode === "WALLET"
                        ? "CONFIRMER LE TRANSFERT"
                        : "GÉNÉRER LE CODE DE RETRAIT"}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={C.white} style={{ opacity: 0.7 }} />
                </>
              )}
            </Pressable>

            <View style={s.secNote}>
              <Ionicons name="shield-checkmark-outline" size={13} color={C.g5} />
              <Text style={[s.secTxt, { fontFamily: F.body }]}>Transfert sécurisé · Crypté de bout en bout</Text>
            </View>
            <View style={{ height: 120 }} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Country Picker ── */}
      <Modal visible={showCountryModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeaderRow}>
              <Text style={[s.modalTitle, { fontFamily: F.display }]}>Indicatif pays</Text>
              <TouchableOpacity style={s.modalClose} onPress={() => { setShowCountryModal(false); setCountrySearch(""); }}>
                <Ionicons name="close" size={18} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <View style={s.modalSearch}>
              <Ionicons name="search-outline" size={15} color={C.textFaint} />
              <TextInput
                style={[s.modalSearchInput, { fontFamily: F.body }]}
                value={countrySearch} onChangeText={setCountrySearch}
                placeholder="Rechercher…" placeholderTextColor={C.textFaint}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredCountries} keyExtractor={(item) => item.code}
              style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.modalItem}
                  onPress={() => {
                    setTargetCountryData(item);
                    updateCurrencyContext(item.name);
                    setShowCountryModal(false);
                    setCountrySearch("");
                  }}
                >
                  <Text style={s.modalItemFlag}>{item.flag}</Text>
                  <Text style={[s.modalItemName, { fontFamily: F.body }]}>{item.name}</Text>
                  <Text style={[s.modalItemCode, { fontFamily: F.body }]}>+{item.dialCode}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <FallbackModal
        visible={showFallback} missing={missingAmount} currency={userCurrency}
        onClose={() => setShowFallback(false)}
        onOrangeMoney={() => { setShowFallback(false); router.push("/topup?method=orange" as any); }}
        onCard={() => { setShowFallback(false); router.push("/topup?method=card" as any); }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: C.bg },
  loader:    { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg, gap: 12 },
  loaderTxt: { fontSize: 14, color: C.textMuted, fontWeight: "600" },

  header: {
    backgroundColor: C.g3,
    paddingTop: Platform.OS === "android" ? 44 : 10,
    paddingBottom: 28, paddingHorizontal: 20, overflow: "hidden",
  },
  hdeco1: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.05)", top: -60, right: -40 },
  hdeco2: { position: "absolute", width: 120, height: 120, borderRadius: 60,  backgroundColor: "rgba(255,255,255,0.04)", bottom: -30, left: 20 },
  headerTop:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  backBtn:     { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, color: C.white, letterSpacing: -0.2 },
  eyeBtn:      { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  balanceHero: { alignItems: "center", gap: 4 },
  balanceLbl:  { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  balanceVal:  { color: C.white, fontSize: 36, letterSpacing: -0.8 },
  insufficientBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.amberSoft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  insufficientTxt:   { fontSize: 11, color: C.amber, fontWeight: "700" },

  scroll:   { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  tabsWrap: { flexDirection: "row", backgroundColor: "#F0F0F0", borderRadius: 18, padding: 6, marginBottom: 16 },

  block: {
    backgroundColor: C.surface, borderRadius: 22, borderWidth: 1, borderColor: C.border,
    padding: 18, marginBottom: 14,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  blockHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  blockNum:    { width: 30, height: 30, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  blockTitle:  { fontSize: 14, fontWeight: "800", color: C.text },

  phoneWrap:     { flexDirection: "row", alignItems: "center", backgroundColor: C.bg, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, overflow: "hidden" },
  dialBtn:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 14, borderRightWidth: 1, borderRightColor: C.border },
  dialFlag:      { fontSize: 18 },
  dialCode:      { fontSize: 13, fontWeight: "700", color: C.text },
  phoneInput:    { flex: 1, paddingHorizontal: 12, paddingVertical: 14, fontSize: 15, color: C.text },
  clearInputBtn: { paddingHorizontal: 12 },

  detectedCard:      { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, backgroundColor: C.gSoft, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.gBorder },
  detectedAvatar:    { width: 40, height: 40, borderRadius: 12, backgroundColor: `${C.g4}20`, justifyContent: "center", alignItems: "center" },
  detectedAvatarTxt: { fontSize: 18, fontWeight: "900", color: C.g4 },
  detectedLabel:     { fontSize: 10, fontWeight: "900", color: C.g4, letterSpacing: 0.8, marginBottom: 2 },
  detectedName:      { fontSize: 14, fontWeight: "800", color: C.text },
  detectedPhone:     { fontSize: 12, color: C.textMuted, fontWeight: "600", marginTop: 2 },
  detectedCheck:     { width: 28, height: 28, borderRadius: 99, backgroundColor: C.g4, justifyContent: "center", alignItems: "center" },
  detectedFlag:      { fontSize: 24 },
  addHint:     { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, padding: 12, backgroundColor: C.gSoft, borderRadius: 14, borderWidth: 1, borderColor: C.gBorder, borderStyle: "dashed" },
  addHintIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: `${C.g4}20`, justifyContent: "center", alignItems: "center" },
  addHintTxt:  { fontSize: 12, color: C.textMuted, fontWeight: "600" },
  addHintLink: { fontSize: 13, color: C.g4, fontWeight: "800" },

  amountCard:      { flexDirection: "row", alignItems: "center", backgroundColor: C.bg, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, padding: 16, gap: 8 },
  amountSide:      { flex: 1 },
  amountSideLabel: { fontSize: 10, fontWeight: "900", color: C.textFaint, letterSpacing: 0.8, marginBottom: 6 },
  amountInputRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  amountInput:     { fontSize: 24, color: C.text, letterSpacing: -0.5, minWidth: 60 },
  amountReceived:  { fontSize: 22, color: C.text, letterSpacing: -0.5 },
  amountArrow:     { width: 36, height: 36, borderRadius: 10, backgroundColor: C.gSoft, justifyContent: "center", alignItems: "center" },
  currBadge:       { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  currTxt:         { fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },

  rateChip: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, alignSelf: "flex-start", backgroundColor: C.gSoft, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  rateTxt:  { fontSize: 12, color: C.g4, fontWeight: "700" },

  summaryDivider:     { height: 1, backgroundColor: C.borderLight, marginVertical: 2 },
  insufficientBar:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.amberSoft, borderRadius: 10, padding: 10, marginTop: 8 },
  insufficientBarTxt: { fontSize: 13, color: C.amber, fontWeight: "600", flex: 1 },

  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: C.g4, borderRadius: 18, paddingVertical: 18, marginTop: 8,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.20, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  ctaAlt:      { backgroundColor: C.amber },
  ctaDisabled: { backgroundColor: C.border },
  ctaIcon:     { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  ctaTxt:      { fontSize: 15, fontWeight: "900", color: C.white, letterSpacing: 0.3 },

  secNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 },
  secTxt:  { fontSize: 11, color: C.textFaint, fontWeight: "600" },

  modalOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet:       { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "70%" },
  modalHandle:      { width: 40, height: 4, borderRadius: 99, backgroundColor: C.border, alignSelf: "center", marginBottom: 16 },
  modalHeaderRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalTitle:       { fontSize: 18, color: C.text },
  modalClose:       { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F5F5F5", justifyContent: "center", alignItems: "center" },
  modalSearch:      { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F5F5F5", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  modalSearchInput: { flex: 1, fontSize: 14, color: C.text },
  modalItem:        { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  modalItemFlag:    { fontSize: 22 },
  modalItemName:    { flex: 1, fontSize: 14, color: C.text, fontWeight: "600" },
  modalItemCode:    { fontSize: 13, color: C.textMuted, fontWeight: "700" },
});