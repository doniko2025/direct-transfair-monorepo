//apps/direct-transfair-mobile/app/agent/send-cash.tsx
// apps/direct-transfair-mobile/app/agent/send-cash.tsx
// =========================================================
// AGENT SEND CASH (GUICHET) v4.0 — Direct Transf'air
// Design: Forge & Ambre — thème AGENT
// ✅ Envoi espèces depuis guichet : expéditeur + bénéficiaire
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
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../providers/AuthProvider";
import { countriesList, CountryData } from "../../data/countries";
import { api } from "../../services/api";

// ─── Design Tokens ──────────────────────────────────────
const T = {
  g1: "#1A0E00",
  g2: "#211200",
  accent: "#F59E0B",
  accentSoft: "#FCD34D",
  accentGlow: "rgba(245,158,11,0.15)",
  ghost: "rgba(255,255,255,0.06)",
  ghostMid: "rgba(255,255,255,0.10)",
  inkBorder: "rgba(255,255,255,0.08)",
  inkLight: "#261800",
  white: "#FFFFFF",
  dim: "#A89070",
  green: "#22C55E",
  blue: "#60A5FA",
  red: "#EF4444",
  radius: { sm: 10, md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

function fmt(n: number): string {
  try { return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n); }
  catch { return Math.round(n).toString(); }
}

// ─── Field ────────────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, keyboardType, editable = true,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fS.wrap}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <View style={[fS.box, focused && fS.boxFocused, !editable && fS.disabled]}>
        <TextInput
          style={[fS.input, { fontFamily: T.font.sans }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.dim + "55"}
          keyboardType={keyboardType}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}
const fS = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 6 },
  box: { backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder, borderRadius: T.radius.md },
  boxFocused: { borderColor: `${T.accent}45` },
  disabled: { opacity: 0.5 },
  input: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.white, fontWeight: "600" },
});

// ─── Picker Modal ─────────────────────────────────────────
function PickerModal({ visible, onClose, title, data, onSelect }: {
  visible: boolean; onClose: () => void; title: string;
  data: CountryData[]; onSelect: (c: CountryData) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = q.trim() ? data.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : data;
  const close = () => { onClose(); setQ(""); };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={pmS.overlay}>
        <View style={pmS.sheet}>
          <View style={pmS.handle} />
          <View style={pmS.headerRow}>
            <Text style={[pmS.title, { fontFamily: T.font.display }]}>{title}</Text>
            <TouchableOpacity style={pmS.closeBtn} onPress={close}>
              <Ionicons name="close" size={18} color={T.dim} />
            </TouchableOpacity>
          </View>
          <View style={pmS.searchBox}>
            <Ionicons name="search" size={14} color={T.dim} />
            <TextInput
              style={[pmS.searchInput, { fontFamily: T.font.sans }]}
              value={q} onChangeText={setQ}
              placeholder="Rechercher…"
              placeholderTextColor={T.dim + "55"}
              autoFocus
            />
            {!!q && <TouchableOpacity onPress={() => setQ("")}><Ionicons name="close" size={13} color={T.dim} /></TouchableOpacity>}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.code}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 30 }}
            renderItem={({ item: c }) => (
              <TouchableOpacity
                style={pmS.item}
                onPress={() => { onSelect(c); close(); }}
              >
                <Text style={{ fontSize: 22, marginRight: 12 }}>{c.flag}</Text>
                <Text style={[pmS.itemTxt, { fontFamily: T.font.sans }]}>{c.name}</Text>
                <Text style={[pmS.dialCode, { fontFamily: T.font.mono }]}>{c.dialCode}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
const pmS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(5,5,10,0.88)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#1A0E00", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "75%", borderWidth: 1, borderColor: T.inkBorder },
  handle: { width: 36, height: 4, borderRadius: 99, backgroundColor: T.inkBorder, alignSelf: "center", marginTop: 14, marginBottom: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: T.inkBorder },
  title: { color: T.white, fontSize: 18, fontWeight: "700" },
  closeBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: T.ghost, justifyContent: "center", alignItems: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, margin: 16, backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder, borderRadius: T.radius.md, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, fontSize: 14, color: T.white, fontWeight: "600" },
  item: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.inkBorder },
  itemTxt: { flex: 1, color: T.white, fontSize: 14, fontWeight: "600" },
  dialCode: { color: T.accent, fontSize: 12, fontWeight: "900" },
});

// ─── Section Header ───────────────────────────────────────
function SectionHeader({ step, title, icon, color }: { step: string; title: string; icon: string; color: string }) {
  return (
    <View style={shS.row}>
      <View style={[shS.stepBox, { backgroundColor: `${color}15`, borderColor: `${color}25` }]}>
        <Text style={[shS.stepTxt, { color, fontFamily: T.font.mono }]}>{step}</Text>
      </View>
      <Text style={[shS.title, { fontFamily: T.font.sans }]}>{title}</Text>
      <Ionicons name={icon as any} size={14} color={color} />
    </View>
  );
}
const shS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  stepBox: { width: 28, height: 28, borderRadius: 9, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  stepTxt: { fontSize: 11, fontWeight: "900" },
  title: { flex: 1, fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },
});

// ─── Success Modal ────────────────────────────────────────
function SuccessModal({
  visible, data, onClose,
}: {
  visible: boolean;
  data: { code: string; amount: number; receiver: string; country: string } | null;
  onClose: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!data) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={smS.overlay}>
        <Animated.View style={[smS.sheet, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <LinearGradient colors={["rgba(34,197,94,0.15)", "rgba(34,197,94,0.05)"]} style={smS.headerGrad}>
            <View style={smS.checkBox}>
              <Ionicons name="checkmark" size={36} color={T.green} />
            </View>
            <Text style={[smS.title, { fontFamily: T.font.display }]}>Envoi Réussi !</Text>
            <Text style={[smS.sub, { fontFamily: T.font.sans }]}>Transaction validée avec succès</Text>
          </LinearGradient>

          <View style={smS.codeBox}>
            <Text style={[smS.codeLabel, { fontFamily: T.font.sans }]}>CODE DE RETRAIT</Text>
            <Text style={[smS.code, { fontFamily: T.font.mono }]}>{data.code}</Text>
            <Text style={[smS.codeTip, { fontFamily: T.font.sans }]}>
              Communiquer ce code au bénéficiaire
            </Text>
          </View>

          <View style={smS.detailsBox}>
            {[
              { label: "Montant", value: `${fmt(data.amount)} XOF` },
              { label: "Bénéficiaire", value: data.receiver },
              { label: "Pays", value: data.country },
            ].map(({ label, value }) => (
              <View key={label} style={smS.detailRow}>
                <Text style={[smS.detailLabel, { fontFamily: T.font.sans }]}>{label}</Text>
                <Text style={[smS.detailValue, { fontFamily: T.font.sans }]}>{value}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={smS.doneBtn} onPress={onClose} activeOpacity={0.85}>
            <LinearGradient
              colors={[T.accent, T.accentSoft]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={smS.doneBtnGrad}
            >
              <Text style={[smS.doneTxt, { fontFamily: T.font.sans }]}>TERMINER</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}
const smS = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(5,5,10,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: "#1A0E00",
    borderRadius: T.radius.lg, // ✅ corrigé ici
    overflow: "hidden",
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: T.inkBorder,
  },
  headerGrad: {
    padding: 28,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: T.inkBorder,
  },
  checkBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    marginBottom: 14,
    backgroundColor: "rgba(34,197,94,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
  },
  title: { color: T.white, fontSize: 24, fontWeight: "700", marginBottom: 4 },
  sub: { color: T.dim, fontSize: 12, fontWeight: "600" },
  codeBox: { padding: 20, alignItems: "center", borderBottomWidth: 1, borderBottomColor: T.inkBorder },
  codeLabel: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 8 },
  code: { color: T.accent, fontSize: 30, fontWeight: "900", letterSpacing: 4, marginBottom: 6 },
  codeTip: { color: T.dim, fontSize: 10, fontWeight: "600" },
  detailsBox: { padding: 20, gap: 10 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailLabel: { color: T.dim, fontSize: 12, fontWeight: "700" },
  detailValue: { color: T.white, fontSize: 14, fontWeight: "700" },
  doneBtn: { margin: 16, borderRadius: T.radius.md, overflow: "hidden" },
  doneBtnGrad: { paddingVertical: 16, alignItems: "center" },
  doneTxt: { color: T.g1, fontWeight: "900", fontSize: 14, letterSpacing: 1 },
});

// ─── Main Screen ──────────────────────────────────────────
export default function AgentSendCashScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [senderFirstName, setSenderFirstName] = useState("");
  const [senderLastName, setSenderLastName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderPhoneCode, setSenderPhoneCode] = useState<CountryData>(countriesList[0]);

  const [receiverFirstName, setReceiverFirstName] = useState("");
  const [receiverLastName, setReceiverLastName] = useState("");
  const [receiverCountry, setReceiverCountry] = useState<CountryData>(countriesList[0]);
  const [receiverPhone, setReceiverPhone] = useState("");

  const [amount, setAmount] = useState("");
  const [fees, setFees] = useState(0);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [showSenderCodeModal, setShowSenderCodeModal] = useState(false);
  const [showReceiverCountryModal, setShowReceiverCountryModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);

  useEffect(() => {
    const val = parseFloat(amount) || 0;
    const f = Math.ceil(val * 0.015);
    setFees(f);
    setTotal(val + f);
  }, [amount]);

  const canSubmit =
    senderFirstName.trim() && senderLastName.trim() && senderPhone.trim() &&
    receiverFirstName.trim() && receiverLastName.trim() && receiverPhone.trim() &&
    parseFloat(amount) > 0;

  const handleSend = async () => {
    if (!canSubmit) { Alert.alert("Erreur", "Veuillez remplir tous les champs."); return; }
    setLoading(true);
    try {
      const beneficiary = await api.createBeneficiary({
        fullName: `${receiverFirstName.trim()} ${receiverLastName.trim()}`,
        phone: `${receiverCountry.dialCode}${receiverPhone.trim()}`,
        country: receiverCountry.name,
        city: "Inconnue",
      });
      const transaction = await api.createTransaction({
        amount: parseFloat(amount),
        currency: "XOF",
        beneficiaryId: beneficiary.id,
        payoutMethod: "CASH_PICKUP",
        senderFirstName: senderFirstName.trim(),
        senderLastName: senderLastName.trim(),
        senderPhone: `${senderPhoneCode.dialCode}${senderPhone.trim()}`,
      });
      await refreshUser();
      setSuccessData({
        code: transaction.reference,
        amount: transaction.amount,
        receiver: `${receiverFirstName.trim()} ${receiverLastName.trim()}`,
        country: receiverCountry.name,
      });
      setShowSuccessModal(true);
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Erreur lors de l'envoi.";
      Alert.alert("Échec", Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSuccess = () => { setShowSuccessModal(false); router.back(); };

  return (
    <LinearGradient colors={[T.g1, T.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Envoi Espèces</Text>
            <Text style={[s.headerSub, { color: T.accent, fontFamily: T.font.sans }]}>Guichet · Cash-Out</Text>
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ── Expéditeur ── */}
            <View style={s.card}>
              <SectionHeader step="1" title="EXPÉDITEUR (SUR PLACE)" icon="person-outline" color={T.accent} />

              <View style={s.rowTwo}>
                <View style={{ flex: 1 }}>
                  <Field label="PRÉNOM" value={senderFirstName} onChangeText={setSenderFirstName} placeholder="Moussa" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="NOM" value={senderLastName} onChangeText={setSenderLastName} placeholder="Diop" />
                </View>
              </View>

              <Text style={[fS.label, { fontFamily: T.font.sans }]}>TÉLÉPHONE MOBILE</Text>
              <View style={s.phoneRow}>
                <TouchableOpacity style={s.dialBtn} onPress={() => setShowSenderCodeModal(true)}>
                  <Text style={{ fontSize: 18 }}>{senderPhoneCode.flag}</Text>
                  <Text style={[s.dialCode, { fontFamily: T.font.mono }]}>{senderPhoneCode.dialCode}</Text>
                  <Ionicons name="caret-down" size={10} color={T.dim} />
                </TouchableOpacity>
                <View style={[fS.box, { flex: 1 }]}>
                  <TextInput
                    style={[fS.input, { fontFamily: T.font.sans }]}
                    value={senderPhone} onChangeText={setSenderPhone}
                    placeholder="620 000 000"
                    placeholderTextColor={T.dim + "55"}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </View>

            {/* ── Bénéficiaire ── */}
            <View style={s.card}>
              <SectionHeader step="2" title="BÉNÉFICIAIRE" icon="location-outline" color={T.blue} />

              {/* Pays destination */}
              <Text style={[fS.label, { fontFamily: T.font.sans }]}>PAYS DE DESTINATION</Text>
              <TouchableOpacity
                style={s.countryBtn}
                onPress={() => setShowReceiverCountryModal(true)}
              >
                <Text style={{ fontSize: 22 }}>{receiverCountry.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.countryName, { fontFamily: T.font.sans }]}>{receiverCountry.name}</Text>
                  <Text style={[s.countryDial, { fontFamily: T.font.mono }]}>{receiverCountry.dialCode}</Text>
                </View>
                <View style={[s.chevronBox, { backgroundColor: `${T.blue}15` }]}>
                  <Ionicons name="chevron-down" size={13} color={T.blue} />
                </View>
              </TouchableOpacity>

              <View style={s.rowTwo}>
                <View style={{ flex: 1 }}>
                  <Field label="PRÉNOM" value={receiverFirstName} onChangeText={setReceiverFirstName} placeholder="Fatou" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="NOM" value={receiverLastName} onChangeText={setReceiverLastName} placeholder="Ndiaye" />
                </View>
              </View>

              <Text style={[fS.label, { fontFamily: T.font.sans }]}>TÉLÉPHONE BÉNÉFICIAIRE</Text>
              <View style={s.phoneRow}>
                <View style={[s.dialBtn, { opacity: 0.7 }]}>
                  <Text style={{ fontSize: 16 }}>{receiverCountry.flag}</Text>
                  <Text style={[s.dialCode, { fontFamily: T.font.mono }]}>{receiverCountry.dialCode}</Text>
                </View>
                <View style={[fS.box, { flex: 1 }]}>
                  <TextInput
                    style={[fS.input, { fontFamily: T.font.sans }]}
                    value={receiverPhone} onChangeText={setReceiverPhone}
                    placeholder="Numéro sans indicatif"
                    placeholderTextColor={T.dim + "55"}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </View>

            {/* ── Montant ── */}
            <View style={s.card}>
              <SectionHeader step="3" title="TRANSACTION" icon="cash-outline" color={T.green} />

              <Text style={[fS.label, { fontFamily: T.font.sans }]}>MONTANT À ENVOYER</Text>
              <View style={[fS.box, amount && { borderColor: `${T.accent}45` }]}>
                <TextInput
                  style={[s.amountInput, { fontFamily: T.font.display }]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  placeholderTextColor={T.dim + "55"}
                  keyboardType="numeric"
                />
                <View style={s.currBox}>
                  <Text style={[s.currTxt, { fontFamily: T.font.mono }]}>XOF</Text>
                </View>
              </View>
            </View>

            {/* ── Résumé ── */}
            {(parseFloat(amount) || 0) > 0 && (
              <View style={s.summaryCard}>
                <View style={s.summaryRow}>
                  <Text style={[s.sumLabel, { fontFamily: T.font.sans }]}>Montant envoyé</Text>
                  <Text style={[s.sumValue, { fontFamily: T.font.mono }]}>{fmt(parseFloat(amount) || 0)} XOF</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={[s.sumLabel, { fontFamily: T.font.sans }]}>Frais d'envoi (1.5%)</Text>
                  <Text style={[s.sumValue, { fontFamily: T.font.mono }]}>{fmt(fees)} XOF</Text>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryRow}>
                  <Text style={[s.totalLabel, { fontFamily: T.font.sans }]}>TOTAL À ENCAISSER</Text>
                  <Text style={[s.totalValue, { color: T.accent, fontFamily: T.font.display }]}>{fmt(total)} XOF</Text>
                </View>
              </View>
            )}

            {/* Bouton */}
            <TouchableOpacity
              style={[s.submitBtn, (!canSubmit || loading) && { opacity: 0.5 }]}
              onPress={handleSend}
              disabled={!canSubmit || loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[T.accent, T.accentSoft]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.submitGrad}
              >
                {loading
                  ? <ActivityIndicator color={T.g1} />
                  : <>
                      <Ionicons name="paper-plane-outline" size={18} color={T.g1} />
                      <Text style={[s.submitTxt, { fontFamily: T.font.sans }]}>VALIDER L'ENVOI</Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 60 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Modals */}
        <PickerModal
          visible={showSenderCodeModal}
          onClose={() => setShowSenderCodeModal(false)}
          title="Indicatif expéditeur"
          data={countriesList}
          onSelect={(c) => { setSenderPhoneCode(c); setShowSenderCodeModal(false); }}
        />
        <PickerModal
          visible={showReceiverCountryModal}
          onClose={() => setShowReceiverCountryModal(false)}
          title="Pays du bénéficiaire"
          data={countriesList}
          onSelect={(c) => { setReceiverCountry(c); setShowReceiverCountryModal(false); }}
        />

        <SuccessModal visible={showSuccessModal} data={successData} onClose={handleCloseSuccess} />
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16, gap: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },
  headerTitle: { color: T.white, fontSize: 22, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  card: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 14, borderWidth: 1, borderColor: T.inkBorder,
  },
  rowTwo: { flexDirection: "row", gap: 12 },

  phoneRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  dialBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, paddingHorizontal: 12, paddingVertical: 12,
  },
  dialCode: { color: T.white, fontSize: 12, fontWeight: "800" },

  countryBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, padding: 12, marginBottom: 14,
  },
  countryName: { color: T.white, fontSize: 14, fontWeight: "700" },
  countryDial: { color: T.dim, fontSize: 10, fontWeight: "800", marginTop: 2 },
  chevronBox: { width: 26, height: 26, borderRadius: 8, justifyContent: "center", alignItems: "center" },

  amountInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 28, color: T.white, fontWeight: "800" },
  currBox: { paddingHorizontal: 14, paddingVertical: 14, backgroundColor: T.ghost, borderLeftWidth: 1, borderLeftColor: T.inkBorder },
  currTxt: { color: T.dim, fontSize: 12, fontWeight: "900", letterSpacing: 1 },

  summaryCard: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 14, borderWidth: 1, borderColor: `${T.accent}20`,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  sumLabel: { color: T.dim, fontSize: 12, fontWeight: "700" },
  sumValue: { color: T.white, fontSize: 13, fontWeight: "700" },
  summaryDivider: { height: 1, backgroundColor: T.inkBorder, marginVertical: 10 },
  totalLabel: { color: T.white, fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  totalValue: { fontSize: 24, fontWeight: "900" },

  submitBtn: { borderRadius: T.radius.md, overflow: "hidden", marginBottom: 10 },
  submitGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8 },
  submitTxt: { color: T.g1, fontWeight: "900", fontSize: 13, letterSpacing: 1 },
});