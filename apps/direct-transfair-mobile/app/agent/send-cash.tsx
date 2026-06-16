// apps/direct-transfair-mobile/app/agent/send-cash.tsx
// =========================================================
// AGENT SEND CASH (GUICHET) v7.5 — Direct Transf'air
// ✅ v7.4 : ZÉRO code en dur — devise auto-détectée
// ✅ v7.5 :
//   - Fond blanc pur (#FFFFFF) — plus de bleu pâle
//   - Héro rectangulaire : LinearGradient + borderBottomRadius 28
//     ARC CONCAVE SUPPRIMÉ (croix rouge sur la capture)
//   - Cartes formulaire : ombres accentuées sur fond blanc
//   - inputBg : #F4F7FA (légèrement différent pour contraste sur blanc)
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
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../providers/AuthProvider";
import { countriesList, type CountryData } from "../../data/countries";
import { api } from "../../services/api";

const AGENT_BLUE      = "#2563EB";
const AGENT_BLUE_DARK = "#1D4ED8";

const C = {
  violet:       AGENT_BLUE,
  violetLight:  "#EFF6FF",
  violetBorder: "#DBEAFE",
  heroGlass:    "rgba(255,255,255,0.18)",
  heroGlassBdr: "rgba(255,255,255,0.28)",
  heroDim:      "rgba(255,255,255,0.75)",
  heroGlow:     "rgba(255,255,255,0.07)",
  // ✅ v7.5 : fond blanc pur
  pageBg:       "#FFFFFF",
  white:        "#FFFFFF",
  cardBorder:   "#E8EDF5",    // gris neutre
  inputBg:      "#F4F7FA",    // ✅ v7.5 : légèrement plus neutre
  ink:          "#0F172A",
  inkMid:       "#374151",
  inkSoft:      "#6B7280",
  green:        "#10B981", greenBg: "#ECFDF5", greenBorder: "#A7F3D0", greenDark: "#065F46",
  red:          "#EF4444",
  blue:         "#3B82F6", blueBg: "#EFF6FF", blueBorder: "#BFDBFE",
  amber:        "#F59E0B", amberBg: "#FFFBEB", amberBorder: "#FDE68A",
  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif:  Platform.select({ ios: "Georgia",     android: "serif",             default: "serif"      }),
    sans:   Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:   Platform.select({ ios: "Courier New", android: "monospace",         default: "monospace"  }),
  },
};

function fmt(n: number, currency = "XOF"): string {
  const decimals = currency === "EUR" || currency === "GBP" || currency === "USD" ? 2 : 0;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n); }
  catch { return Math.round(n).toString(); }
}

function getCurrencyFromCountry(country: string): string {
  const cn = (country || "").toLowerCase().trim();
  if (cn.includes("guinée") && !cn.includes("bissau") && !cn.includes("équat")) return "GNF";
  if (cn.includes("maroc"))                                                        return "MAD";
  if (cn.includes("grande-bretagne") || cn.includes("royaume-uni"))               return "GBP";
  if (cn.includes("états-unis")      || cn.includes("usa"))                       return "USD";
  if (cn.includes("france") || cn.includes("belgi") || cn.includes("allem") || cn.includes("espagne") || cn.includes("italie") || cn.includes("portug") || cn.includes("pays-bas") || cn.includes("autriche")) return "EUR";
  return "XOF";
}

function rateDecimals(rate: number): number {
  if (rate < 0.01) return 6;
  if (rate < 1)    return 4;
  if (rate >= 100) return 2;
  return 4;
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

// ─── Picker Modal ─────────────────────────────────────────
function PickerModal({ visible, onClose, title, data, onSelect }: {
  visible: boolean; onClose: () => void; title: string;
  data: CountryData[]; onSelect: (c: CountryData) => void;
}) {
  const [q, setQ] = useState("");
  const filtered  = q.trim() ? data.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : data;
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
            <TextInput style={[pm.searchInput, { fontFamily: C.font.sans }]} value={q} onChangeText={setQ} placeholder="Rechercher…" placeholderTextColor={C.inkSoft} autoFocus />
            {!!q && <TouchableOpacity onPress={() => setQ("")}><Ionicons name="close" size={13} color={C.inkSoft} /></TouchableOpacity>}
          </View>
          <FlatList
            data={filtered} keyExtractor={(c) => c.code}
            showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}
            renderItem={({ item: c }) => (
              <TouchableOpacity style={pm.item} onPress={() => { onSelect(c); close(); }} activeOpacity={0.75}>
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
  closeBtn:   { width: 32, height: 32, borderRadius: 9, backgroundColor: C.inputBg, justifyContent: "center", alignItems: "center" },
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

  const [senderFirstName, setSenderFirstName] = useState("");
  const [senderLastName,  setSenderLastName]  = useState("");
  const [senderPhone,     setSenderPhone]     = useState("");
  const [senderPhoneCode, setSenderPhoneCode] = useState<CountryData>(countriesList[0]);
  const [receiverFirstName, setReceiverFirstName] = useState("");
  const [receiverLastName,  setReceiverLastName]  = useState("");
  const [receiverCountry,   setReceiverCountry]   = useState<CountryData>(countriesList[0]);
  const [receiverPhone,     setReceiverPhone]     = useState("");
  const [amount,  setAmount]  = useState("");
  const [fees,    setFees]    = useState(0);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [feeRate,  setFeeRate]  = useState(0.015);
  const [feeLabel, setFeeLabel] = useState("1,5");
  const [agentCurrency, setAgentCurrency] = useState("XOF");
  const [allRates,       setAllRates]       = useState<any[]>([]);
  const [targetCurrency, setTargetCurrency] = useState("XOF");
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [exchangeRate,   setExchangeRate]   = useState(1);
  const [showSenderModal,   setShowSenderModal]   = useState(false);
  const [showReceiverModal, setShowReceiverModal] = useState(false);

  // ✅ v7.4 — Auto-détection devise agence
  useEffect(() => {
    const country = (user as any)?.country || (user as any)?.agency?.country || (user as any)?.primaryCountry || "";
    if (country) {
      const currency = getCurrencyFromCountry(country);
      setAgentCurrency(currency);
      const countryData = countriesList.find((c) => c.name.toLowerCase().includes(country.toLowerCase().split(",")[0].trim()));
      if (countryData) setSenderPhoneCode(countryData);
    }
    api.getMyWallets().then((wallets) => {
      const agencyWallet = wallets.find((w: any) => w.agencyId) ?? wallets.find((w: any) => w.isDefault) ?? wallets[0];
      if (agencyWallet?.currency) setAgentCurrency(agencyWallet.currency);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    (api.http as any).get("/commissions/fees").then((res: any) => {
      const list: any[] = Array.isArray(res.data) ? res.data : [];
      const r = list.find((c: any) => c.payoutMethod === "CASH_PICKUP");
      if (r) { const raw = Number(r.feeRate ?? 1.5); setFeeRate(raw / 100); setFeeLabel(raw.toFixed(1).replace(".", ",")); }
    }).catch(() => {});
  }, []);

  useEffect(() => { api.getExchangeRates().then((rates: any[]) => setAllRates(rates)).catch(() => {}); }, []);

  useEffect(() => {
    const cn = receiverCountry.name.toLowerCase();
    let curr = "XOF";
    if (cn.includes("guinée") && !cn.includes("bissau") && !cn.includes("équat")) curr = "GNF";
    else if (cn.includes("maroc")) curr = "MAD";
    else if (cn.includes("grande-bretagne") || cn.includes("royaume-uni")) curr = "GBP";
    else if (cn.includes("états-unis") || cn.includes("usa")) curr = "USD";
    else if (cn.includes("france") || cn.includes("belgi") || cn.includes("allem") || cn.includes("espagne") || cn.includes("italie") || cn.includes("portug") || cn.includes("pays-bas") || cn.includes("autriche")) curr = "EUR";
    setTargetCurrency(curr);
  }, [receiverCountry]);

  useEffect(() => {
    if (targetCurrency === agentCurrency) { setExchangeRate(1); return; }
    const getR = (pair: string, fb: number): number => (allRates as any[]).find((r: any) => r.pair === pair)?.rate ?? fb;
    const FALLBACKS: Record<string, number> = { EUR_XOF: 655.957, EUR_GNF: 9600, EUR_GBP: 0.85, EUR_USD: 1.08, EUR_MAD: 10.8 };
    const agentToEur  = agentCurrency === "EUR" ? 1 : 1 / getR(`EUR_${agentCurrency}`, FALLBACKS[`EUR_${agentCurrency}`] ?? 1);
    const eurToTarget = targetCurrency === "EUR" ? 1 : getR(`EUR_${targetCurrency}`, FALLBACKS[`EUR_${targetCurrency}`] ?? 1);
    setExchangeRate(agentToEur * eurToTarget);
  }, [allRates, targetCurrency, agentCurrency]);

  useEffect(() => {
    const val = parseFloat(amount) || 0;
    const fee = Math.ceil(val * feeRate);
    setFees(fee);
    setTotal(val + fee);
    setReceivedAmount(Math.round(val * exchangeRate));
  }, [amount, feeRate, exchangeRate]);

  const canSubmit = senderFirstName.trim() && senderLastName.trim() && senderPhone.trim() && receiverFirstName.trim() && receiverLastName.trim() && receiverPhone.trim() && parseFloat(amount) > 0;

  const handleSend = async () => {
    if (!canSubmit) { Alert.alert("Erreur", "Veuillez remplir tous les champs."); return; }
    setLoading(true);
    try {
      const beneficiary = await api.createBeneficiary({ fullName: `${receiverFirstName.trim()} ${receiverLastName.trim()}`, phone: `${receiverCountry.dialCode}${receiverPhone.trim()}`, country: receiverCountry.name, city: "Inconnue" });
      const transaction = await api.createTransaction({ amount: parseFloat(amount), currency: agentCurrency, beneficiaryId: String(beneficiary.id), payoutMethod: "CASH_PICKUP", senderFirstName: senderFirstName.trim(), senderLastName: senderLastName.trim(), senderPhone: `${senderPhoneCode.dialCode}${senderPhone.trim()}` });
      await refreshUser();
      const receiptData = { type: "ENVOI" as const, reference: transaction.reference, date: new Date().toISOString(), amount: parseFloat(amount), currency: agentCurrency, fees, totalAmount: total, receivedAmount, targetCurrency, exchangeRate, beneficiaryName: `${receiverFirstName.trim()} ${receiverLastName.trim()}`, beneficiaryPhone: `+${receiverCountry.dialCode}${receiverPhone.trim()}`, beneficiaryCountry: receiverCountry.name, senderName: `${senderFirstName.trim()} ${senderLastName.trim()}`, senderPhone: `+${senderPhoneCode.dialCode}${senderPhone.trim()}`, code: transaction.reference, agencyName: (user as any)?.agency?.name || undefined, agentName: `${(user as any)?.firstName ?? ""} ${(user as any)?.lastName ?? ""}`.trim() || undefined };
      router.push(`/agent/receipt?data=${encodeURIComponent(JSON.stringify(receiptData))}`);
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Erreur lors de l'envoi.";
      Alert.alert("Échec", Array.isArray(msg) ? msg[0] : msg);
    } finally { setLoading(false); }
  };

  const amtNum     = parseFloat(amount) || 0;
  const rateDisplay = exchangeRate.toFixed(rateDecimals(exchangeRate));

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={AGENT_BLUE} />

      {/* ✅ v7.5 : Héro rectangulaire LinearGradient — plus d'arc concave */}
      <LinearGradient colors={[AGENT_BLUE, AGENT_BLUE_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
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
      </LinearGradient>
      {/* ✅ v7.5 : HeroConcave supprimé */}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── ÉTAPE 1 : Expéditeur ── */}
          <View style={s.card}>
            <SectionHeader step="1" title="Expéditeur (sur place)" icon="person-outline" color={AGENT_BLUE} />
            <View style={s.row2}>
              <View style={{ flex: 1 }}><Field label="Prénom" value={senderFirstName} onChangeText={setSenderFirstName} placeholder="Moussa" /></View>
              <View style={{ flex: 1 }}><Field label="Nom"    value={senderLastName}  onChangeText={setSenderLastName}  placeholder="Diop"   /></View>
            </View>
            <Text style={[f.label, { fontFamily: C.font.sans }]}>Téléphone</Text>
            <View style={s.phoneRow}>
              <TouchableOpacity style={s.dialBtn} onPress={() => setShowSenderModal(true)} activeOpacity={0.75}>
                <Text style={{ fontSize: 18 }}>{senderPhoneCode.flag}</Text>
                <Text style={[s.dialCode, { fontFamily: C.font.mono }]}>+{senderPhoneCode.dialCode}</Text>
                <Ionicons name="caret-down" size={10} color={C.inkSoft} />
              </TouchableOpacity>
              <View style={[f.box, { flex: 1 }]}>
                <TextInput style={[f.input, { fontFamily: C.font.sans }]} value={senderPhone} onChangeText={setSenderPhone} placeholder="620 000 000" placeholderTextColor={C.inkSoft} keyboardType="phone-pad" />
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
              <View style={{ flex: 1 }}><Field label="Prénom" value={receiverFirstName} onChangeText={setReceiverFirstName} placeholder="Abdoul" /></View>
              <View style={{ flex: 1 }}><Field label="Nom"    value={receiverLastName}  onChangeText={setReceiverLastName}  placeholder="Diallo" /></View>
            </View>
            <Text style={[f.label, { fontFamily: C.font.sans }]}>Téléphone bénéficiaire</Text>
            <View style={s.phoneRow}>
              <View style={s.dialBtnStatic}>
                <Text style={{ fontSize: 18 }}>{receiverCountry.flag}</Text>
                <Text style={[s.dialCode, { fontFamily: C.font.mono }]}>+{receiverCountry.dialCode}</Text>
              </View>
              <View style={[f.box, { flex: 1 }]}>
                <TextInput style={[f.input, { fontFamily: C.font.sans }]} value={receiverPhone} onChangeText={setReceiverPhone} placeholder="77 000 0000" placeholderTextColor={C.inkSoft} keyboardType="phone-pad" />
              </View>
            </View>
          </View>

          {/* ── ÉTAPE 3 : Montant & Frais ── */}
          <View style={s.card}>
            <SectionHeader step="3" title="Montant & Frais" icon="cash-outline" color={C.green} />
            <View style={[s.amtBox, amtNum > 0 && { borderColor: AGENT_BLUE }]}>
              <TextInput style={[s.amtInput, { fontFamily: C.font.serif }]} value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={C.inkSoft} keyboardType="numeric" />
              <View style={s.curBox}>
                <Text style={[s.curTxt, { fontFamily: C.font.mono }]}>{agentCurrency}</Text>
              </View>
            </View>
            {amtNum > 0 && (
              <View style={s.feesCard}>
                <View style={s.feesRow}>
                  <Text style={[s.feesLbl, { fontFamily: C.font.sans }]}>Montant envoyé</Text>
                  <Text style={[s.feesVal, { fontFamily: C.font.mono }]}>{fmt(amtNum, agentCurrency)} {agentCurrency}</Text>
                </View>
                <View style={s.feesRow}>
                  <Text style={[s.feesLbl, { fontFamily: C.font.sans }]}>Frais ({feeLabel} %)</Text>
                  <Text style={[s.feesVal, { fontFamily: C.font.mono }]}>{fmt(fees, agentCurrency)} {agentCurrency}</Text>
                </View>
                {receivedAmount > 0 && (
                  <>
                    <View style={s.feesRowDivider} />
                    <View style={s.feesRow}>
                      <View style={s.receivedLblWrap}>
                        <Ionicons name="arrow-down-circle-outline" size={12} color={C.green} />
                        <Text style={[s.receivedLbl, { fontFamily: C.font.sans }]}>Reçoit ({targetCurrency})</Text>
                      </View>
                      <Text style={[s.receivedVal, { fontFamily: C.font.mono }]}>{fmt(receivedAmount, targetCurrency)} {targetCurrency}</Text>
                    </View>
                    {targetCurrency !== agentCurrency && (
                      <View style={s.rateChip}>
                        <Ionicons name="swap-horizontal-outline" size={11} color={C.green} />
                        <Text style={[s.rateChipTxt, { fontFamily: C.font.mono }]}>1 {agentCurrency} = {rateDisplay} {targetCurrency}</Text>
                      </View>
                    )}
                  </>
                )}
                <View style={[s.feesRow, s.totalRow]}>
                  <Text style={[s.totalLbl, { fontFamily: C.font.sans }]}>Total à débiter</Text>
                  <Text style={[s.totalVal, { fontFamily: C.font.mono }]}>{fmt(total, agentCurrency)} {agentCurrency}</Text>
                </View>
              </View>
            )}
          </View>

          {/* CTA */}
          <TouchableOpacity style={[s.cta, (!canSubmit || loading) && { opacity: 0.6 }]} onPress={handleSend} disabled={!canSubmit || loading} activeOpacity={0.85}>
            <View style={s.ctaInner}>
              {loading
                ? <ActivityIndicator color={C.white} size="small" />
                : <>
                    <Ionicons name="paper-plane-outline" size={16} color={C.white} />
                    <Text style={[s.ctaTxt, { fontFamily: C.font.sans }]}>ENVOYER — {fmt(total, agentCurrency)} {agentCurrency}</Text>
                  </>
              }
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
            <Text style={[s.cancelTxt, { fontFamily: C.font.sans }]}>Annuler</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerModal visible={showSenderModal}   onClose={() => setShowSenderModal(false)}   title="Indicatif expéditeur"  data={countriesList} onSelect={setSenderPhoneCode} />
      <PickerModal visible={showReceiverModal} onClose={() => setShowReceiverModal(false)} title="Pays de destination"   data={countriesList} onSelect={setReceiverCountry} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  // ✅ v7.5 : fond blanc pur
  safe: { flex: 1, backgroundColor: "#FFFFFF" },

  // ✅ v7.5 : héro rectangulaire + ombre portée bleue
  hero: {
    paddingHorizontal: 20,
    paddingTop:    Platform.OS === "android" ? 32 : 8,
    paddingBottom: 22,
    borderBottomLeftRadius:  28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
    shadowColor:   "#1D4ED8",
    shadowOffset:  { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius:  20,
    elevation:     12,
  },
  glow:        { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: C.heroGlow, top: -50, right: -30 },
  heroTopRow:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  iconBtn:     { width: 32, height: 32, borderRadius: 10, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center" },
  agentPill:   { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pillDot:     { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.green },
  pillTxt:     { fontSize: 8, fontWeight: "700", color: C.white, letterSpacing: 1 },
  newBadge:    { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  newBadgeTxt: { fontSize: 8, fontWeight: "900", color: C.white, letterSpacing: 1 },
  heroTitle:   { color: C.white, fontSize: 26, fontWeight: "700", marginBottom: 3 },
  heroSub:     { color: C.heroDim, fontSize: 11, fontWeight: "600" },

  scroll: { paddingHorizontal: 18, paddingTop: 20 },

  // ✅ v7.5 : cards blanches avec ombres accentuées sur fond blanc
  card:  { backgroundColor: C.white, borderRadius: C.r.lg, padding: 17, marginBottom: 14, borderWidth: 1, borderColor: C.cardBorder, shadowColor: "#64748B", shadowOpacity: 0.09, shadowRadius: 14, elevation: 5 },
  row2:  { flexDirection: "row", gap: 10 },

  phoneRow:     { flexDirection: "row", gap: 8, marginBottom: 14 },
  dialBtn:      { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 10, paddingVertical: 12, flexShrink: 0 },
  dialBtnStatic:{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 10, paddingVertical: 12, flexShrink: 0 },
  dialCode:     { color: C.ink, fontSize: 12, fontWeight: "800" },

  countryBtn:  { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, padding: 13, marginBottom: 14 },
  countryName: { fontSize: 14, fontWeight: "700", color: C.ink },
  countryDial: { fontSize: 11, color: C.inkSoft, fontWeight: "600", marginTop: 1 },
  chevron:     { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },

  amtBox:         { flexDirection: "row", alignItems: "center", backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, overflow: "hidden", marginBottom: 14 },
  amtInput:       { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 22, color: C.ink, fontWeight: "800" },
  curBox:         { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.violetLight, borderLeftWidth: 1, borderLeftColor: C.violetBorder, justifyContent: "center" },
  curTxt:         { color: AGENT_BLUE, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
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
  totalRow:       { borderTopWidth: 1, borderTopColor: C.blueBorder, marginTop: 4, paddingTop: 10, marginBottom: 0 },
  totalLbl:       { fontSize: 12, fontWeight: "900", color: C.ink },
  totalVal:       { fontSize: 18, fontWeight: "900", color: AGENT_BLUE },

  cta:       { borderRadius: C.r.md, overflow: "hidden", marginBottom: 10, shadowColor: AGENT_BLUE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 6 },
  ctaInner:  { backgroundColor: AGENT_BLUE, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 17, gap: 8, borderRadius: C.r.md },
  ctaTxt:    { color: C.white, fontWeight: "900", fontSize: 13, letterSpacing: 0.8 },
  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelTxt: { color: C.inkSoft, fontWeight: "800", fontSize: 14 },
});