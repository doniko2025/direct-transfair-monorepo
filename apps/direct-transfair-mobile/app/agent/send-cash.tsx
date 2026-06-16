// apps/direct-transfair-mobile/app/agent/send-cash.tsx
// =========================================================
// AGENT SEND CASH (GUICHET) v7.4 — Direct Transf'air
// ✅ v5.0 : Envoi espèces, frais auto, résumé, code retrait
// ✅ v6.0 : Bleu #2563EB, arc concave, sélecteurs indicatif
// ✅ v7.0 : Héro pill, arc concave, reçu imprimable, user context
// ✅ v7.1 : Taux de frais dynamique (GET /commissions/fees)
// ✅ v7.2 : Route /commissions/fees sans restriction de rôle
// ✅ v7.3 : Montant reçu dans la devise du destinataire
// ✅ v7.4 : ZÉRO code en dur — tout est détecté automatiquement
//
//   PROBLÈME v7.3 : devise envoyée hardcodée "XOF"
//     → un agent guinéen (GNF) envoyait currency:"XOF"
//     → le backend cherchait un wallet XOF agence → solde 0 → 403
//
//   CORRECTIFS v7.4 :
//   A) agentCurrency : chargé depuis user.country/primaryCurrency
//      + confirmé via api.getMyWallets() → premier wallet de l'agence
//   B) Indicatif téléphonique expéditeur : initialisé sur le pays
//      de l'agence (Guinée → +224, Sénégal → +221…)
//   C) Devise de l'expéditeur dans le reçu = agentCurrency
//   D) Taux d'échange : calculé depuis agentCurrency (pas XOF)
//   E) Précision adaptative du taux affiché :
//      < 0.01 → 6 décimales | < 1 → 4 décimales | sinon → 2
// =========================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView,
  Platform, ScrollView, Modal, FlatList, StatusBar,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Rect } from "react-native-svg";
import { useAuth } from "../../providers/AuthProvider";
import { countriesList, type CountryData } from "../../data/countries";
import { api } from "../../services/api";

const { width: SW } = Dimensions.get("window");

// ─── Couleur agent ────────────────────────────────────────
const AGENT_BLUE = "#2563EB";
const CONCAVE_H  = 60;

// ─── Design System ───────────────────────────────────────
const C = {
  violet:       AGENT_BLUE,
  violetLight:  "#EFF6FF",
  violetBorder: "#DBEAFE",
  heroGlass:    "rgba(255,255,255,0.14)",
  heroGlassBdr: "rgba(255,255,255,0.22)",
  heroDim:      "rgba(255,255,255,0.65)",
  heroGlow:     "rgba(255,255,255,0.07)",
  pageBg:       "#EFF6FF",
  white:        "#FFFFFF",
  cardBorder:   "#DBEAFE",
  inputBg:      "#F4F7FF",
  ink:          "#0F172A",
  inkMid:       "#374151",
  inkSoft:      "#6B7280",
  green:        "#10B981", greenBg: "#ECFDF5", greenBorder: "#A7F3D0", greenDark: "#065F46",
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

// ─── Helpers ──────────────────────────────────────────────

/** Formate un nombre selon la devise (0 décimales pour GNF/XOF, 2 pour EUR…) */
function fmt(n: number, currency = "XOF"): string {
  const decimals = currency === "EUR" || currency === "GBP" || currency === "USD" ? 2 : 0;
  try {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  } catch { return Math.round(n).toString(); }
}

/**
 * Déduit la devise locale depuis le nom de pays de l'agence.
 * Utilisé pour initialiser agentCurrency avant confirmation via API.
 */
function getCurrencyFromCountry(country: string): string {
  const cn = (country || "").toLowerCase().trim();
  if (cn.includes("guinée") && !cn.includes("bissau") && !cn.includes("équat")) return "GNF";
  if (cn.includes("maroc"))                                                        return "MAD";
  if (cn.includes("grande-bretagne") || cn.includes("royaume-uni"))               return "GBP";
  if (cn.includes("états-unis")      || cn.includes("usa"))                       return "USD";
  if (
    cn.includes("france")   || cn.includes("belgi")   || cn.includes("allem")  ||
    cn.includes("espagne")  || cn.includes("italie")  || cn.includes("portug") ||
    cn.includes("pays-bas") || cn.includes("autriche")
  ) return "EUR";
  return "XOF"; // Zone UEMOA par défaut
}

/**
 * Précision adaptative pour l'affichage du taux de change.
 * Évite "0.0015" (trompeur) pour des taux très petits comme GNF→EUR.
 */
function rateDecimals(rate: number): number {
  if (rate < 0.01)  return 6; // ex: GNF→EUR  = 0.000104
  if (rate < 1)     return 4; // ex: XOF→EUR  = 0.0015
  if (rate >= 100)  return 2; // ex: EUR→XOF  = 655.96
  return 4;                    // ex: XOF→GNF = 14.4000
}

// ─── Arc concave ──────────────────────────────────────────
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

// ─── Field ────────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, keyboardType, editable = true }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={f.wrap}>
      <Text style={[f.label, { fontFamily: C.font.sans }]}>{label}</Text>
      <View style={[f.box, focused && f.focused, !editable && { opacity: 0.5 }]}>
        <TextInput
          style={[f.input, { fontFamily: C.font.sans }]}
          value={value} onChangeText={onChangeText}
          placeholder={placeholder} placeholderTextColor={C.inkSoft}
          keyboardType={keyboardType} editable={editable}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}
const f = StyleSheet.create({
  wrap:    { marginBottom: 14 },
  label:   { fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  box:     { backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md },
  focused: { borderColor: AGENT_BLUE, backgroundColor: C.white },
  input:   { paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.ink, fontWeight: "600" },
});

// ─── PickerModal ──────────────────────────────────────────
function PickerModal({ visible, onClose, title, data, onSelect }: {
  visible: boolean; onClose: () => void; title: string;
  data: CountryData[]; onSelect: (c: CountryData) => void;
}) {
  const [q, setQ] = useState("");
  const filtered  = q.trim()
    ? data.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
    : data;
  const close = () => { onClose(); setQ(""); };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={pm.overlay}>
        <View style={pm.sheet}>
          <View style={pm.handle} />
          <View style={pm.head}>
            <Text style={[pm.title, { fontFamily: C.font.serif }]}>{title}</Text>
            <TouchableOpacity style={pm.closeBtn} onPress={close}>
              <Ionicons name="close" size={17} color={C.inkSoft} />
            </TouchableOpacity>
          </View>
          <View style={pm.search}>
            <Ionicons name="search" size={14} color={C.inkSoft} />
            <TextInput
              style={[pm.searchInput, { fontFamily: C.font.sans }]}
              value={q} onChangeText={setQ}
              placeholder="Rechercher…" placeholderTextColor={C.inkSoft}
              autoFocus
            />
            {!!q && (
              <TouchableOpacity onPress={() => setQ("")}>
                <Ionicons name="close" size={13} color={C.inkSoft} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.code}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 30 }}
            renderItem={({ item: c }) => (
              <TouchableOpacity
                style={pm.item}
                onPress={() => { onSelect(c); close(); }}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 22, marginRight: 12 }}>{c.flag}</Text>
                <Text style={[pm.itemTxt, { fontFamily: C.font.sans }]}>{c.name}</Text>
                <View style={pm.dialChip}>
                  <Text style={[pm.dial, { fontFamily: C.font.mono }]}>+{c.dialCode}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
const pm = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet:      { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "78%", borderWidth: 1, borderColor: C.cardBorder },
  handle:     { width: 36, height: 4, borderRadius: C.r.pill, backgroundColor: C.cardBorder, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  head:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  title:      { color: C.ink, fontSize: 18, fontWeight: "700" },
  closeBtn:   { width: 32, height: 32, borderRadius: 9, backgroundColor: C.pageBg, justifyContent: "center", alignItems: "center" },
  search:     { flexDirection: "row", alignItems: "center", gap: 10, margin: 16, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 12, height: 42 },
  searchInput:{ flex: 1, fontSize: 14, color: C.ink, fontWeight: "600" },
  item:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  itemTxt:    { flex: 1, color: C.ink, fontSize: 14, fontWeight: "600" },
  dialChip:   { backgroundColor: C.violetLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.violetBorder },
  dial:       { color: AGENT_BLUE, fontSize: 11, fontWeight: "900" },
});

// ─── Section Header ───────────────────────────────────────
function SectionHeader({ step, title, icon, color }: {
  step: string; title: string; icon: string; color: string;
}) {
  return (
    <View style={sh.row}>
      <View style={[sh.stepBox, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
        <Text style={[sh.stepTxt, { color, fontFamily: C.font.mono }]}>{step}</Text>
      </View>
      <Text style={[sh.title, { fontFamily: C.font.sans }]}>{title}</Text>
      <Ionicons name={icon as any} size={14} color={color} />
    </View>
  );
}
const sh = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  stepBox: { width: 28, height: 28, borderRadius: 9, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  stepTxt: { fontSize: 11, fontWeight: "900" },
  title:   { flex: 1, fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1.5, textTransform: "uppercase" },
});

// ─── Main ─────────────────────────────────────────────────
export default function AgentSendCashScreen() {
  const router                = useRouter();
  const { refreshUser, user } = useAuth();

  // ── Expéditeur ────────────────────────────────────────
  const [senderFirstName, setSenderFirstName] = useState("");
  const [senderLastName,  setSenderLastName]  = useState("");
  const [senderPhone,     setSenderPhone]     = useState("");
  // Initialisé sur countriesList[0] puis mis à jour depuis le profil agent
  const [senderPhoneCode, setSenderPhoneCode] = useState<CountryData>(countriesList[0]);

  // ── Bénéficiaire ──────────────────────────────────────
  const [receiverFirstName, setReceiverFirstName] = useState("");
  const [receiverLastName,  setReceiverLastName]  = useState("");
  const [receiverCountry,   setReceiverCountry]   = useState<CountryData>(countriesList[0]);
  const [receiverPhone,     setReceiverPhone]     = useState("");

  // ── Montant & frais ───────────────────────────────────
  const [amount,  setAmount]  = useState("");
  const [fees,    setFees]    = useState(0);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);

  // ── Taux de frais (dynamique, via /commissions/fees) ──
  const [feeRate,  setFeeRate]  = useState(0.015);
  const [feeLabel, setFeeLabel] = useState("1,5");

  // ── Devise de l'agent (dynamique) ─────────────────────
  // ✅ v7.4 : déduite du profil agent, confirmée via les wallets
  // Plus "XOF" hardcodé : un agent guinéen → "GNF", etc.
  const [agentCurrency, setAgentCurrency] = useState("XOF");

  // ── Taux de change & montant reçu ─────────────────────
  const [allRates,       setAllRates]       = useState<any[]>([]);
  const [targetCurrency, setTargetCurrency] = useState("XOF");
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [exchangeRate,   setExchangeRate]   = useState(1);

  const [showSenderModal,   setShowSenderModal]   = useState(false);
  const [showReceiverModal, setShowReceiverModal] = useState(false);

  // ─────────────────────────────────────────────────────
  // ✅ v7.4 — Auto-détection devise et pays de l'agence
  // Étape 1 : depuis user.country ou user.agency.country (synchrone)
  // Étape 2 : confirmé via api.getMyWallets() (asynchrone)
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    // Étape 1 : depuis le profil utilisateur
    const country =
      (user as any)?.country            ||
      (user as any)?.agency?.country    ||
      (user as any)?.primaryCountry     ||
      "";

    if (country) {
      const currency = getCurrencyFromCountry(country);
      setAgentCurrency(currency);

      // Pré-sélectionner l'indicatif téléphonique du pays de l'agence
      const countryData = countriesList.find((c) =>
        c.name.toLowerCase().includes(
          country.toLowerCase().split(",")[0].trim(),
        ),
      );
      if (countryData) setSenderPhoneCode(countryData);
    }

    // Étape 2 : confirmation via les wallets (le plus fiable)
    api.getMyWallets()
      .then((wallets) => {
        // Le wallet de l'agence est souvent le premier ou celui avec agencyId
        const agencyWallet =
          wallets.find((w: any) => w.agencyId) ??
          wallets.find((w: any) => w.isDefault) ??
          wallets[0];

        if (agencyWallet?.currency) {
          setAgentCurrency(agencyWallet.currency);
        }
      })
      .catch(() => {
        // Garde la valeur déduite du pays en étape 1
      });
  }, [user]);

  // ✅ v7.2 : taux de frais depuis /commissions/fees (accessible AGENT)
  useEffect(() => {
    (api.http as any).get("/commissions/fees")
      .then((res: any) => {
        const list: any[] = Array.isArray(res.data) ? res.data : [];
        const r = list.find((c: any) => c.payoutMethod === "CASH_PICKUP");
        if (r) {
          const raw = Number(r.feeRate ?? 1.5);
          setFeeRate(raw / 100);
          setFeeLabel(raw.toFixed(1).replace(".", ","));
        }
      })
      .catch(() => {});
  }, []);

  // ✅ v7.3 : taux de change au mount
  useEffect(() => {
    api.getExchangeRates()
      .then((rates: any[]) => setAllRates(rates))
      .catch(() => {});
  }, []);

  // ✅ v7.3 : devise cible depuis le pays du bénéficiaire
  useEffect(() => {
    const cn = receiverCountry.name.toLowerCase();
    let curr = "XOF";
    if (cn.includes("guinée") && !cn.includes("bissau") && !cn.includes("équat")) curr = "GNF";
    else if (cn.includes("maroc"))                                                  curr = "MAD";
    else if (cn.includes("grande-bretagne") || cn.includes("royaume-uni"))         curr = "GBP";
    else if (cn.includes("états-unis")      || cn.includes("usa"))                 curr = "USD";
    else if (
      cn.includes("france")   || cn.includes("belgi")   || cn.includes("allem")  ||
      cn.includes("espagne")  || cn.includes("italie")  || cn.includes("portug") ||
      cn.includes("pays-bas") || cn.includes("autriche")
    ) curr = "EUR";
    setTargetCurrency(curr);
  }, [receiverCountry]);

  // ✅ v7.4 : taux agentCurrency → targetCurrency (plus XOF hardcodé)
  useEffect(() => {
    if (targetCurrency === agentCurrency) {
      setExchangeRate(1);
      return;
    }
    const getR = (pair: string, fb: number): number =>
      (allRates as any[]).find((r: any) => r.pair === pair)?.rate ?? fb;

    const FALLBACKS: Record<string, number> = {
      EUR_XOF: 655.957, EUR_GNF: 9600, EUR_GBP: 0.85,
      EUR_USD: 1.08,    EUR_MAD: 10.8,
    };

    // agentCurrency → EUR
    const agentToEur = agentCurrency === "EUR"
      ? 1
      : 1 / getR(`EUR_${agentCurrency}`, FALLBACKS[`EUR_${agentCurrency}`] ?? 1);

    // EUR → targetCurrency
    const eurToTarget = targetCurrency === "EUR"
      ? 1
      : getR(`EUR_${targetCurrency}`, FALLBACKS[`EUR_${targetCurrency}`] ?? 1);

    setExchangeRate(agentToEur * eurToTarget);
  }, [allRates, targetCurrency, agentCurrency]);

  // ✅ calcul frais + montant reçu
  useEffect(() => {
    const val = parseFloat(amount) || 0;
    const fee = Math.ceil(val * feeRate);
    setFees(fee);
    setTotal(val + fee);
    setReceivedAmount(Math.round(val * exchangeRate));
  }, [amount, feeRate, exchangeRate]);

  const canSubmit =
    senderFirstName.trim()   && senderLastName.trim()   && senderPhone.trim() &&
    receiverFirstName.trim() && receiverLastName.trim() && receiverPhone.trim() &&
    parseFloat(amount) > 0;

  const handleSend = async () => {
    if (!canSubmit) { Alert.alert("Erreur", "Veuillez remplir tous les champs."); return; }
    setLoading(true);
    try {
      const beneficiary = await api.createBeneficiary({
        fullName: `${receiverFirstName.trim()} ${receiverLastName.trim()}`,
        phone:    `${receiverCountry.dialCode}${receiverPhone.trim()}`,
        country:  receiverCountry.name,
        city:     "Inconnue",
      });

      // ✅ v7.4 : currency = agentCurrency (plus "XOF" hardcodé)
      const transaction = await api.createTransaction({
        amount:          parseFloat(amount),
        currency:        agentCurrency,
        beneficiaryId:   String(beneficiary.id),
        payoutMethod:    "CASH_PICKUP",
        senderFirstName: senderFirstName.trim(),
        senderLastName:  senderLastName.trim(),
        senderPhone:     `${senderPhoneCode.dialCode}${senderPhone.trim()}`,
      });

      await refreshUser();

      // ✅ v7.4 : reçu avec devise dynamique + montant reçu
      const receiptData = {
        type:               "ENVOI" as const,
        reference:          transaction.reference,
        date:               new Date().toISOString(),
        amount:             parseFloat(amount),
        currency:           agentCurrency,
        fees,
        totalAmount:        total,
        receivedAmount,
        targetCurrency,
        exchangeRate,
        beneficiaryName:    `${receiverFirstName.trim()} ${receiverLastName.trim()}`,
        beneficiaryPhone:   `+${receiverCountry.dialCode}${receiverPhone.trim()}`,
        beneficiaryCountry: receiverCountry.name,
        senderName:         `${senderFirstName.trim()} ${senderLastName.trim()}`,
        senderPhone:        `+${senderPhoneCode.dialCode}${senderPhone.trim()}`,
        code:               transaction.reference,
        agencyName:         (user as any)?.agency?.name || undefined,
        agentName:          `${(user as any)?.firstName ?? ""} ${(user as any)?.lastName ?? ""}`.trim() || undefined,
      };

      router.push(
        `/agent/receipt?data=${encodeURIComponent(JSON.stringify(receiptData))}`,
      );
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Erreur lors de l'envoi.";
      Alert.alert("Échec", Array.isArray(msg) ? msg[0] : msg);
    } finally { setLoading(false); }
  };

  const amtNum = parseFloat(amount) || 0;
  // ✅ v7.4 : précision adaptative (plus "toFixed(4)" qui tronquait 0.0001...)
  const rateDisplay = exchangeRate.toFixed(rateDecimals(exchangeRate));

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={AGENT_BLUE} />

      {/* ══ HÉRO + ARC CONCAVE ══ */}
      <View>
        <View style={s.hero}>
          <View style={s.glow} />
          <View style={s.heroTopRow}>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="arrow-back" size={18} color={C.white} />
            </TouchableOpacity>
            <View style={s.agentPill}>
              <View style={s.pillDot} />
              <Text style={[s.pillTxt, { fontFamily: C.font.sans }]}>AGENT</Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={s.newBadge}>
              <Text style={[s.newBadgeTxt, { fontFamily: C.font.sans }]}>NOUVEAU</Text>
            </View>
          </View>
          <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Envoi Espèces</Text>
          <Text style={[s.heroSub,   { fontFamily: C.font.sans  }]}>Guichet · Cash-Out</Text>
        </View>
        <HeroConcave />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── ÉTAPE 1 : Expéditeur ── */}
          <View style={s.card}>
            <SectionHeader step="1" title="Expéditeur (sur place)" icon="person-outline" color={AGENT_BLUE} />
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Field label="Prénom" value={senderFirstName} onChangeText={setSenderFirstName} placeholder="Moussa" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Nom" value={senderLastName} onChangeText={setSenderLastName} placeholder="Diop" />
              </View>
            </View>
            <Text style={[f.label, { fontFamily: C.font.sans }]}>Téléphone</Text>
            <View style={s.phoneRow}>
              {/* ✅ v7.4 : indicatif pré-sélectionné sur le pays de l'agence */}
              <TouchableOpacity style={s.dialBtn} onPress={() => setShowSenderModal(true)} activeOpacity={0.75}>
                <Text style={{ fontSize: 18 }}>{senderPhoneCode.flag}</Text>
                <Text style={[s.dialCode, { fontFamily: C.font.mono }]}>+{senderPhoneCode.dialCode}</Text>
                <Ionicons name="caret-down" size={10} color={C.inkSoft} />
              </TouchableOpacity>
              <View style={[f.box, { flex: 1 }]}>
                <TextInput
                  style={[f.input, { fontFamily: C.font.sans }]}
                  value={senderPhone} onChangeText={setSenderPhone}
                  placeholder="620 000 000" placeholderTextColor={C.inkSoft}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>

          {/* ── ÉTAPE 2 : Bénéficiaire ── */}
          <View style={s.card}>
            <SectionHeader step="2" title="Bénéficiaire" icon="location-outline" color={C.blue} />

            <Text style={[f.label, { fontFamily: C.font.sans }]}>Pays de destination</Text>
            <TouchableOpacity style={s.countryBtn} onPress={() => setShowReceiverModal(true)} activeOpacity={0.75}>
              <Text style={{ fontSize: 22 }}>{receiverCountry.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.countryName, { fontFamily: C.font.sans }]}>{receiverCountry.name}</Text>
                <Text style={[s.countryDial, { fontFamily: C.font.mono }]}>+{receiverCountry.dialCode}</Text>
              </View>
              <View style={[s.chevron, { backgroundColor: C.blueBg }]}>
                <Ionicons name="chevron-down" size={13} color={C.blue} />
              </View>
            </TouchableOpacity>

            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Field label="Prénom" value={receiverFirstName} onChangeText={setReceiverFirstName} placeholder="Abdoul" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Nom" value={receiverLastName} onChangeText={setReceiverLastName} placeholder="Diallo" />
              </View>
            </View>

            <Text style={[f.label, { fontFamily: C.font.sans }]}>Téléphone bénéficiaire</Text>
            <View style={s.phoneRow}>
              <View style={s.dialBtnStatic}>
                <Text style={{ fontSize: 18 }}>{receiverCountry.flag}</Text>
                <Text style={[s.dialCode, { fontFamily: C.font.mono }]}>+{receiverCountry.dialCode}</Text>
              </View>
              <View style={[f.box, { flex: 1 }]}>
                <TextInput
                  style={[f.input, { fontFamily: C.font.sans }]}
                  value={receiverPhone} onChangeText={setReceiverPhone}
                  placeholder="77 000 0000" placeholderTextColor={C.inkSoft}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>

          {/* ── ÉTAPE 3 : Montant & Frais ── */}
          <View style={s.card}>
            <SectionHeader step="3" title="Montant & Frais" icon="cash-outline" color={C.green} />

            {/* ✅ v7.4 : label devise dynamique (agentCurrency) */}
            <View style={[s.amtBox, amtNum > 0 && { borderColor: AGENT_BLUE }]}>
              <TextInput
                style={[s.amtInput, { fontFamily: C.font.serif }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={C.inkSoft}
                keyboardType="numeric"
              />
              <View style={s.curBox}>
                <Text style={[s.curTxt, { fontFamily: C.font.mono }]}>{agentCurrency}</Text>
              </View>
            </View>

            {/* Tableau (visible dès qu'un montant est saisi) */}
            {amtNum > 0 && (
              <View style={s.feesCard}>
                {/* Montant envoyé */}
                <View style={s.feesRow}>
                  <Text style={[s.feesLbl, { fontFamily: C.font.sans }]}>Montant envoyé</Text>
                  <Text style={[s.feesVal, { fontFamily: C.font.mono }]}>
                    {fmt(amtNum, agentCurrency)} {agentCurrency}
                  </Text>
                </View>

                {/* Frais */}
                <View style={s.feesRow}>
                  <Text style={[s.feesLbl, { fontFamily: C.font.sans }]}>Frais ({feeLabel} %)</Text>
                  <Text style={[s.feesVal, { fontFamily: C.font.mono }]}>
                    {fmt(fees, agentCurrency)} {agentCurrency}
                  </Text>
                </View>

                {/* ✅ v7.3 + v7.4 : montant reçu dans la devise du destinataire */}
                {receivedAmount > 0 && (
                  <>
                    <View style={s.feesRowDivider} />
                    <View style={s.feesRow}>
                      <View style={s.receivedLblWrap}>
                        <Ionicons name="arrow-down-circle-outline" size={12} color={C.green} />
                        <Text style={[s.receivedLbl, { fontFamily: C.font.sans }]}>
                          Reçoit ({targetCurrency})
                        </Text>
                      </View>
                      <Text style={[s.receivedVal, { fontFamily: C.font.mono }]}>
                        {fmt(receivedAmount, targetCurrency)} {targetCurrency}
                      </Text>
                    </View>
                    {/* ✅ v7.4 : précision adaptive (toFixed dynamique) */}
                    {targetCurrency !== agentCurrency && (
                      <View style={s.rateChip}>
                        <Ionicons name="swap-horizontal-outline" size={11} color={C.green} />
                        <Text style={[s.rateChipTxt, { fontFamily: C.font.mono }]}>
                          1 {agentCurrency} = {rateDisplay} {targetCurrency}
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {/* Total */}
                <View style={[s.feesRow, s.totalRow]}>
                  <Text style={[s.totalLbl, { fontFamily: C.font.sans }]}>Total à débiter</Text>
                  <Text style={[s.totalVal, { fontFamily: C.font.mono }]}>
                    {fmt(total, agentCurrency)} {agentCurrency}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ── CTA ── */}
          <TouchableOpacity
            style={[s.cta, (!canSubmit || loading) && { opacity: 0.6 }]}
            onPress={handleSend}
            disabled={!canSubmit || loading}
            activeOpacity={0.85}
          >
            <View style={s.ctaInner}>
              {loading
                ? <ActivityIndicator color={C.white} size="small" />
                : <>
                    <Ionicons name="paper-plane-outline" size={16} color={C.white} />
                    {/* ✅ v7.4 : devise dynamique dans le CTA */}
                    <Text style={[s.ctaTxt, { fontFamily: C.font.sans }]}>
                      ENVOYER — {fmt(total, agentCurrency)} {agentCurrency}
                    </Text>
                  </>
              }
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
            <Text style={[s.cancelTxt, { fontFamily: C.font.sans }]}>Annuler</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      <PickerModal
        visible={showSenderModal}
        onClose={() => setShowSenderModal(false)}
        title="Indicatif expéditeur"
        data={countriesList}
        onSelect={setSenderPhoneCode}
      />
      <PickerModal
        visible={showReceiverModal}
        onClose={() => setShowReceiverModal(false)}
        title="Pays de destination"
        data={countriesList}
        onSelect={setReceiverCountry}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  hero: {
    backgroundColor: AGENT_BLUE,
    paddingHorizontal: 20,
    paddingTop:    Platform.OS === "android" ? 32 : 6,
    paddingBottom: 16,
    overflow:      "hidden",
  },
  glow:        { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: C.heroGlow, top: -50, right: -30 },
  heroTopRow:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  iconBtn:     { width: 30, height: 30, borderRadius: 9, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center" },
  agentPill:   { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pillDot:     { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.green },
  pillTxt:     { fontSize: 8, fontWeight: "700", color: C.white, letterSpacing: 1 },
  newBadge:    { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  newBadgeTxt: { fontSize: 8, fontWeight: "900", color: C.white, letterSpacing: 1 },
  heroTitle:   { color: C.white, fontSize: 26, fontWeight: "700", marginBottom: 3 },
  heroSub:     { color: C.heroDim, fontSize: 11, fontWeight: "600" },

  scroll: { paddingHorizontal: 18, paddingTop: 16 },

  card:  { backgroundColor: C.white, borderRadius: C.r.lg, padding: 17, marginBottom: 14, borderWidth: 1, borderColor: C.cardBorder, shadowColor: AGENT_BLUE, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  row2:  { flexDirection: "row", gap: 10 },

  phoneRow:     { flexDirection: "row", gap: 8, marginBottom: 14 },
  dialBtn:      { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 10, paddingVertical: 12, flexShrink: 0 },
  dialBtnStatic:{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 10, paddingVertical: 12, flexShrink: 0 },
  dialCode:     { color: C.ink, fontSize: 12, fontWeight: "800" },

  countryBtn:  { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, padding: 13, marginBottom: 14 },
  countryName: { fontSize: 14, fontWeight: "700", color: C.ink },
  countryDial: { fontSize: 11, color: C.inkSoft, fontWeight: "600", marginTop: 1 },
  chevron:     { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },

  amtBox:   { flexDirection: "row", alignItems: "center", backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, overflow: "hidden", marginBottom: 14 },
  amtInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 22, color: C.ink, fontWeight: "800" },
  curBox:   { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.violetLight, borderLeftWidth: 1, borderLeftColor: C.violetBorder, justifyContent: "center" },
  curTxt:   { color: AGENT_BLUE, fontSize: 12, fontWeight: "900", letterSpacing: 1 },

  feesCard:       { backgroundColor: C.blueBg, borderRadius: C.r.md, padding: 14, borderWidth: 1, borderColor: C.blueBorder },
  feesRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  feesRowDivider: { height: 1, backgroundColor: C.blueBorder, marginVertical: 4 },
  feesLbl:        { fontSize: 11, color: C.inkSoft, fontWeight: "600" },
  feesVal:        { fontSize: 12, color: C.ink, fontWeight: "700" },

  receivedLblWrap:{ flexDirection: "row", alignItems: "center", gap: 5 },
  receivedLbl:    { fontSize: 11, color: C.green, fontWeight: "700" },
  receivedVal:    { fontSize: 13, color: C.green, fontWeight: "900" },
  rateChip:       { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-end", backgroundColor: `${C.green}12`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: C.r.pill, marginBottom: 6 },
  rateChipTxt:    { fontSize: 9, color: C.green, fontWeight: "700" },

  totalRow: { borderTopWidth: 1, borderTopColor: C.blueBorder, marginTop: 4, paddingTop: 10, marginBottom: 0 },
  totalLbl: { fontSize: 12, fontWeight: "900", color: C.ink },
  totalVal: { fontSize: 18, fontWeight: "900", color: AGENT_BLUE },

  cta:       { borderRadius: C.r.md, overflow: "hidden", marginBottom: 10 },
  ctaInner:  { backgroundColor: AGENT_BLUE, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 17, gap: 8, borderRadius: C.r.md },
  ctaTxt:    { color: C.white, fontWeight: "900", fontSize: 13, letterSpacing: 0.8 },
  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelTxt: { color: C.inkSoft, fontWeight: "800", fontSize: 14 },
});