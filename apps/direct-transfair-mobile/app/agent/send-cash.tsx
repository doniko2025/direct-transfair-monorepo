// apps/direct-transfair-mobile/app/agent/send-cash.tsx
// =========================================================
// AGENT SEND CASH (GUICHET) v5.0 — Direct Transf'air
// Design: Thème clair · Violet #6C47FF · Ultra-moderne
// ✅ Envoi espèces : expéditeur + bénéficiaire
// ✅ Calcul frais auto, résumé, code de retrait
// =========================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView,
  Platform, ScrollView, Modal, FlatList, StatusBar, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { countriesList, CountryData } from "../../data/countries";
import { api } from "../../services/api";

// ─── Design System ──────────────────────────────────────
const C = {
  violet:       "#6C47FF",
  violetLight:  "#F5F3FF",
  violetBorder: "#EDE9FE",

  heroGlass:    "rgba(255,255,255,0.14)",
  heroGlassBdr: "rgba(255,255,255,0.22)",
  heroDim:      "rgba(255,255,255,0.60)",
  heroGlow:     "rgba(255,255,255,0.08)",

  pageBg:       "#F4F2FF",
  white:        "#FFFFFF",
  cardBorder:   "#EDE9FE",
  inputBg:      "#F8F7FF",

  ink:          "#12082E",
  inkMid:       "#4B3F72",
  inkSoft:      "#8B80A8",

  green:        "#10B981",
  greenBg:      "#ECFDF5",
  greenBorder:  "#A7F3D0",
  greenDark:    "#065F46",

  red:          "#EF4444",
  blue:         "#3B82F6",
  blueBg:       "#EFF6FF",
  blueBorder:   "#BFDBFE",

  amber:        "#F59E0B",
  amberBg:      "#FFFBEB",
  amberBorder:  "#FDE68A",

  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

function fmt(n: number): string {
  try { return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n); }
  catch { return Math.round(n).toString(); }
}

// ─── Field ──────────────────────────────────────────────
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
  focused: { borderColor: C.violet, backgroundColor: C.white },
  input:   { paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.ink, fontWeight: "600" },
});

// ─── Picker Modal ───────────────────────────────────────
function PickerModal({ visible, onClose, title, data, onSelect }: {
  visible: boolean; onClose: () => void; title: string;
  data: CountryData[]; onSelect: (c: CountryData) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = q.trim() ? data.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : data;
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
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 30 }}
            renderItem={({ item: c }) => (
              <TouchableOpacity style={pm.item} onPress={() => { onSelect(c); close(); }}>
                <Text style={{ fontSize: 22, marginRight: 12 }}>{c.flag}</Text>
                <Text style={[pm.itemTxt, { fontFamily: C.font.sans }]}>{c.name}</Text>
                <Text style={[pm.dial, { fontFamily: C.font.mono }]}>{c.dialCode}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
const pm = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: "rgba(18,8,46,0.45)", justifyContent: "flex-end" },
  sheet:       { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "78%", borderWidth: 1, borderColor: C.cardBorder },
  handle:      { width: 36, height: 4, borderRadius: C.r.pill, backgroundColor: C.cardBorder, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  head:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  title:       { color: C.ink, fontSize: 18, fontWeight: "700" },
  closeBtn:    { width: 32, height: 32, borderRadius: 9, backgroundColor: C.pageBg, justifyContent: "center", alignItems: "center" },
  search:      { flexDirection: "row", alignItems: "center", gap: 10, margin: 16, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, fontSize: 14, color: C.ink, fontWeight: "600" },
  item:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  itemTxt:     { flex: 1, color: C.ink, fontSize: 14, fontWeight: "600" },
  dial:        { color: C.violet, fontSize: 12, fontWeight: "900" },
});

// ─── Section Header ─────────────────────────────────────
function SectionHeader({ step, title, icon, color }: { step: string; title: string; icon: string; color: string }) {
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

// ─── Success Modal ──────────────────────────────────────
function SuccessModal({ visible, data, onClose }: {
  visible: boolean;
  data: { code: string; amount: number; receiver: string; country: string } | null;
  onClose: () => void;
}) {
  const scaleAnim   = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [visible]);
  if (!data) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={sm.overlay}>
        <Animated.View style={[sm.sheet, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <View style={sm.header}>
            <View style={sm.checkBox}>
              <Ionicons name="checkmark" size={36} color={C.green} />
            </View>
            <Text style={[sm.title, { fontFamily: C.font.serif }]}>Envoi Réussi !</Text>
            <Text style={[sm.sub, { fontFamily: C.font.sans }]}>Transaction validée avec succès</Text>
          </View>
          <View style={sm.codeBox}>
            <Text style={[sm.codeLbl, { fontFamily: C.font.sans }]}>CODE DE RETRAIT</Text>
            <Text style={[sm.code, { fontFamily: C.font.mono }]}>{data.code}</Text>
            <Text style={[sm.codeTip, { fontFamily: C.font.sans }]}>Communiquer ce code au bénéficiaire</Text>
          </View>
          <View style={sm.details}>
            {[
              { label: "Montant",      value: `${fmt(data.amount)} XOF` },
              { label: "Bénéficiaire", value: data.receiver },
              { label: "Pays",         value: data.country },
            ].map(({ label, value }) => (
              <View key={label} style={sm.detailRow}>
                <Text style={[sm.dLbl, { fontFamily: C.font.sans }]}>{label}</Text>
                <Text style={[sm.dVal, { fontFamily: C.font.sans }]}>{value}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={sm.doneBtn} onPress={onClose} activeOpacity={0.88}>
            <View style={sm.doneBtnInner}>
              <Text style={[sm.doneTxt, { fontFamily: C.font.sans }]}>TERMINER</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}
const sm = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: "rgba(18,8,46,0.50)", justifyContent: "center", alignItems: "center", padding: 24 },
  sheet:       { backgroundColor: C.white, borderRadius: C.r.xl, overflow: "hidden", width: "100%", maxWidth: 400, borderWidth: 1, borderColor: C.cardBorder, shadowColor: C.violet, shadowOpacity: 0.16, shadowRadius: 24, elevation: 12 },
  header:      { backgroundColor: C.greenBg, padding: 28, alignItems: "center", borderBottomWidth: 1, borderBottomColor: C.greenBorder },
  checkBox:    { width: 64, height: 64, borderRadius: 20, marginBottom: 14, backgroundColor: "#D1FAE5", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: C.greenBorder },
  title:       { color: C.ink, fontSize: 24, fontWeight: "700", marginBottom: 4 },
  sub:         { color: C.inkSoft, fontSize: 12, fontWeight: "600" },
  codeBox:     { padding: 20, alignItems: "center", borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  codeLbl:     { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" },
  code:        { color: C.violet, fontSize: 30, fontWeight: "900", letterSpacing: 4, marginBottom: 6 },
  codeTip:     { color: C.inkSoft, fontSize: 10, fontWeight: "600" },
  details:     { padding: 20, gap: 10 },
  detailRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dLbl:        { color: C.inkSoft, fontSize: 12, fontWeight: "700" },
  dVal:        { color: C.ink, fontSize: 14, fontWeight: "700" },
  doneBtn:     { margin: 16, borderRadius: C.r.md, overflow: "hidden" },
  doneBtnInner:{ backgroundColor: C.violet, paddingVertical: 16, alignItems: "center", borderRadius: C.r.md },
  doneTxt:     { color: C.white, fontWeight: "900", fontSize: 14, letterSpacing: 1 },
});

// ─── Main ───────────────────────────────────────────────
export default function AgentSendCashScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [senderFirstName,  setSenderFirstName]  = useState("");
  const [senderLastName,   setSenderLastName]   = useState("");
  const [senderPhone,      setSenderPhone]      = useState("");
  const [senderPhoneCode,  setSenderPhoneCode]  = useState<CountryData>(countriesList[0]);

  const [receiverFirstName,  setReceiverFirstName]  = useState("");
  const [receiverLastName,   setReceiverLastName]   = useState("");
  const [receiverCountry,    setReceiverCountry]    = useState<CountryData>(countriesList[0]);
  const [receiverPhone,      setReceiverPhone]      = useState("");

  const [amount,   setAmount]   = useState("");
  const [fees,     setFees]     = useState(0);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(false);

  const [showSenderModal,   setShowSenderModal]   = useState(false);
  const [showReceiverModal, setShowReceiverModal] = useState(false);
  const [showSuccess,       setShowSuccess]       = useState(false);
  const [successData,       setSuccessData]       = useState<any>(null);

  useEffect(() => {
    const val = parseFloat(amount) || 0;
    const f = Math.ceil(val * 0.015);
    setFees(f); setTotal(val + f);
  }, [amount]);

  const canSubmit = senderFirstName.trim() && senderLastName.trim() && senderPhone.trim()
    && receiverFirstName.trim() && receiverLastName.trim() && receiverPhone.trim()
    && parseFloat(amount) > 0;

  const handleSend = async () => {
    if (!canSubmit) { Alert.alert("Erreur", "Veuillez remplir tous les champs."); return; }
    setLoading(true);
    try {
      const beneficiary = await api.createBeneficiary({
        fullName: `${receiverFirstName.trim()} ${receiverLastName.trim()}`,
        phone: `${receiverCountry.dialCode}${receiverPhone.trim()}`,
        country: receiverCountry.name, city: "Inconnue",
      });
      const transaction = await api.createTransaction({
        amount: parseFloat(amount), currency: "XOF",
        beneficiaryId: String(beneficiary.id), payoutMethod: "CASH_PICKUP",
        senderFirstName: senderFirstName.trim(), senderLastName: senderLastName.trim(),
        senderPhone: `${senderPhoneCode.dialCode}${senderPhone.trim()}`,
      });
      await refreshUser();
      setSuccessData({ code: transaction.reference, amount: transaction.amount, receiver: `${receiverFirstName.trim()} ${receiverLastName.trim()}`, country: receiverCountry.name });
      setShowSuccess(true);
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Erreur lors de l'envoi.";
      Alert.alert("Échec", Array.isArray(msg) ? msg[0] : msg);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.violet} />

      {/* ── Hero ── */}
      <View style={s.hero}>
        <View style={s.glow} />
        <View style={s.heroRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Envoi Espèces</Text>
            <Text style={[s.heroSub,   { fontFamily: C.font.sans  }]}>Guichet · Cash-Out</Text>
          </View>
          <View style={s.heroBadge}>
            <View style={s.heroBadgeDot} />
            <Text style={[s.heroBadgeTxt, { fontFamily: C.font.sans }]}>NOUVEAU</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── Expéditeur ── */}
          <View style={s.card}>
            <SectionHeader step="1" title="Expéditeur (sur place)" icon="person-outline" color={C.violet} />
            <View style={s.row2}>
              <View style={{ flex: 1 }}><Field label="Prénom" value={senderFirstName} onChangeText={setSenderFirstName} placeholder="Moussa" /></View>
              <View style={{ flex: 1 }}><Field label="Nom"    value={senderLastName}  onChangeText={setSenderLastName}  placeholder="Diop" /></View>
            </View>
            <Text style={[f.label, { fontFamily: C.font.sans }]}>Téléphone</Text>
            <View style={s.phoneRow}>
              <TouchableOpacity style={s.dialBtn} onPress={() => setShowSenderModal(true)}>
                <Text style={{ fontSize: 18 }}>{senderPhoneCode.flag}</Text>
                <Text style={[s.dialCode, { fontFamily: C.font.mono }]}>{senderPhoneCode.dialCode}</Text>
                <Ionicons name="caret-down" size={10} color={C.inkSoft} />
              </TouchableOpacity>
              <View style={[f.box, { flex: 1 }]}>
                <TextInput style={[f.input, { fontFamily: C.font.sans }]} value={senderPhone} onChangeText={setSenderPhone} placeholder="620 000 000" placeholderTextColor={C.inkSoft} keyboardType="phone-pad" />
              </View>
            </View>
          </View>

          {/* ── Bénéficiaire ── */}
          <View style={s.card}>
            <SectionHeader step="2" title="Bénéficiaire" icon="location-outline" color={C.blue} />
            <Text style={[f.label, { fontFamily: C.font.sans }]}>Pays de destination</Text>
            <TouchableOpacity style={s.countryBtn} onPress={() => setShowReceiverModal(true)}>
              <Text style={{ fontSize: 22 }}>{receiverCountry.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.countryName, { fontFamily: C.font.sans }]}>{receiverCountry.name}</Text>
                <Text style={[s.countryDial, { fontFamily: C.font.mono }]}>{receiverCountry.dialCode}</Text>
              </View>
              <View style={[s.chevron, { backgroundColor: C.blueBg }]}>
                <Ionicons name="chevron-down" size={13} color={C.blue} />
              </View>
            </TouchableOpacity>
            <View style={s.row2}>
              <View style={{ flex: 1 }}><Field label="Prénom" value={receiverFirstName} onChangeText={setReceiverFirstName} placeholder="Fatou" /></View>
              <View style={{ flex: 1 }}><Field label="Nom"    value={receiverLastName}  onChangeText={setReceiverLastName}  placeholder="Ndiaye" /></View>
            </View>
            <Text style={[f.label, { fontFamily: C.font.sans }]}>Téléphone bénéficiaire</Text>
            <View style={s.phoneRow}>
              <View style={[s.dialBtn, { opacity: 0.65 }]}>
                <Text style={{ fontSize: 16 }}>{receiverCountry.flag}</Text>
                <Text style={[s.dialCode, { fontFamily: C.font.mono }]}>{receiverCountry.dialCode}</Text>
              </View>
              <View style={[f.box, { flex: 1 }]}>
                <TextInput style={[f.input, { fontFamily: C.font.sans }]} value={receiverPhone} onChangeText={setReceiverPhone} placeholder="Numéro sans indicatif" placeholderTextColor={C.inkSoft} keyboardType="phone-pad" />
              </View>
            </View>
          </View>

          {/* ── Montant ── */}
          <View style={s.card}>
            <SectionHeader step="3" title="Transaction" icon="cash-outline" color={C.green} />
            <Text style={[f.label, { fontFamily: C.font.sans }]}>Montant à envoyer</Text>
            <View style={[s.amtBox, (parseFloat(amount) || 0) > 0 && { borderColor: C.violet }]}>
              <TextInput
                style={[s.amtInput, { fontFamily: C.font.serif }]}
                value={amount} onChangeText={setAmount}
                placeholder="0" placeholderTextColor={C.inkSoft}
                keyboardType="numeric"
              />
              <View style={s.curBox}>
                <Text style={[s.curTxt, { fontFamily: C.font.mono }]}>XOF</Text>
              </View>
            </View>
          </View>

          {/* ── Résumé ── */}
          {(parseFloat(amount) || 0) > 0 && (
            <View style={s.summary}>
              <View style={s.summaryHead}>
                <View style={[s.summaryIcon, { backgroundColor: C.violetLight }]}>
                  <Ionicons name="receipt-outline" size={15} color={C.violet} />
                </View>
                <Text style={[s.summaryTitle, { fontFamily: C.font.sans }]}>Récapitulatif</Text>
              </View>
              <View style={s.sumRow}>
                <Text style={[s.sumLbl, { fontFamily: C.font.sans }]}>Montant envoyé</Text>
                <Text style={[s.sumVal, { fontFamily: C.font.mono }]}>{fmt(parseFloat(amount) || 0)} XOF</Text>
              </View>
              <View style={s.sumRow}>
                <Text style={[s.sumLbl, { fontFamily: C.font.sans }]}>Frais (1.5%)</Text>
                <Text style={[s.sumVal, { fontFamily: C.font.mono }]}>{fmt(fees)} XOF</Text>
              </View>
              <View style={s.sumDivider} />
              <View style={s.sumRow}>
                <Text style={[s.totalLbl, { fontFamily: C.font.sans }]}>TOTAL À ENCAISSER</Text>
                <Text style={[s.totalVal, { fontFamily: C.font.serif }]}>{fmt(total)} XOF</Text>
              </View>
            </View>
          )}

          {/* CTA */}
          <TouchableOpacity
            style={[s.cta, (!canSubmit || loading) && { opacity: 0.4 }]}
            onPress={handleSend} disabled={!canSubmit || loading} activeOpacity={0.88}
          >
            <View style={s.ctaInner}>
              {loading
                ? <ActivityIndicator color={C.white} />
                : <>
                    <Ionicons name="paper-plane-outline" size={18} color={C.white} />
                    <Text style={[s.ctaTxt, { fontFamily: C.font.sans }]}>VALIDER L'ENVOI</Text>
                  </>
              }
            </View>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerModal visible={showSenderModal}   onClose={() => setShowSenderModal(false)}   title="Indicatif expéditeur"  data={countriesList} onSelect={(c) => { setSenderPhoneCode(c);  setShowSenderModal(false); }} />
      <PickerModal visible={showReceiverModal} onClose={() => setShowReceiverModal(false)} title="Pays du bénéficiaire" data={countriesList} onSelect={(c) => { setReceiverCountry(c); setShowReceiverModal(false); }} />
      <SuccessModal visible={showSuccess} data={successData} onClose={() => { setShowSuccess(false); router.back(); }} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  hero: {
    backgroundColor: C.violet,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 48 : 16,
    paddingBottom: 24, overflow: "hidden",
  },
  glow:      { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: C.heroGlow, top: -60, right: -40 },
  heroRow:   { flexDirection: "row", alignItems: "center", gap: 14 },
  backBtn: {
    width: 38, height: 38, borderRadius: C.r.sm,
    backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr,
    justifyContent: "center", alignItems: "center",
  },
  heroTitle: { color: C.white, fontSize: 22, fontWeight: "700" },
  heroSub:   { color: C.heroDim, fontSize: 11, fontWeight: "600", marginTop: 2 },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, borderRadius: C.r.pill, paddingHorizontal: 10, paddingVertical: 5 },
  heroBadgeDot: { width: 5, height: 5, borderRadius: C.r.pill, backgroundColor: "#A5F3FC" },
  heroBadgeTxt: { color: "#E8E0FF", fontSize: 9, fontWeight: "900", letterSpacing: 1 },

  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  card: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.violet, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  row2: { flexDirection: "row", gap: 12 },

  phoneRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  dialBtn:  { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 12, paddingVertical: 12 },
  dialCode: { color: C.ink, fontSize: 12, fontWeight: "800" },

  countryBtn: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, padding: 12, marginBottom: 14 },
  countryName:{ color: C.ink, fontSize: 14, fontWeight: "700" },
  countryDial:{ color: C.inkSoft, fontSize: 10, fontWeight: "800", marginTop: 2 },
  chevron:    { width: 26, height: 26, borderRadius: 8, justifyContent: "center", alignItems: "center" },

  amtBox:   { flexDirection: "row", alignItems: "center", backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, overflow: "hidden" },
  amtInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 28, color: C.ink, fontWeight: "800" },
  curBox:   { paddingHorizontal: 14, paddingVertical: 14, backgroundColor: C.violetLight, borderLeftWidth: 1, borderLeftColor: C.violetBorder },
  curTxt:   { color: C.violet, fontSize: 12, fontWeight: "900", letterSpacing: 1 },

  summary: { backgroundColor: C.white, borderRadius: C.r.lg, padding: 18, marginBottom: 14, borderWidth: 1.5, borderColor: C.violetBorder, shadowColor: C.violet, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  summaryHead:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  summaryIcon:  { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  summaryTitle: { fontSize: 12, fontWeight: "900", color: C.violet, letterSpacing: 0.5 },
  sumRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  sumLbl:       { color: C.inkSoft, fontSize: 12, fontWeight: "700" },
  sumVal:       { color: C.ink, fontSize: 13, fontWeight: "700" },
  sumDivider:   { height: 1, backgroundColor: C.violetBorder, marginVertical: 10 },
  totalLbl:     { color: C.ink, fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  totalVal:     { fontSize: 24, fontWeight: "900", color: C.violet },

  cta:      { borderRadius: C.r.md, overflow: "hidden", marginBottom: 10 },
  ctaInner: { backgroundColor: C.violet, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8, borderRadius: C.r.md },
  ctaTxt:   { color: C.white, fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});