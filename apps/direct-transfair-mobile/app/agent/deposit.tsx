// apps/direct-transfair-mobile/app/agent/deposit.tsx
// =========================================================
// AGENT DEPOSIT (CASH-IN) v5.0 — Direct Transf'air
// Design: Thème clair · Violet #6C47FF · Ultra-moderne
// ✅ Dépôt client via numéro de téléphone
// =========================================================

import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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

  red:          "#EF4444",
  redBg:        "#FEF2F2",

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
  focused: { borderColor: C.violet, backgroundColor: C.white },
  input:   { paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.ink, fontWeight: "600" },
});

const QUICK = [1_000, 2_000, 5_000, 10_000, 25_000, 50_000];

export default function AgentDepositScreen() {
  const router = useRouter();
  const [phone,   setPhone]   = useState("");
  const [amount,  setAmount]  = useState("");
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const numAmount = parseFloat(amount) || 0;
  const canSubmit = phone.trim().length >= 8 && numAmount > 0;

  const showAlert = (title: string, msg: string, onOk?: () => void) => {
    if (Platform.OS === "web") { setTimeout(() => { window.alert(`${title}\n\n${msg}`); if (onOk) onOk(); }, 100); }
    else Alert.alert(title, msg, [{ text: "OK", onPress: onOk }]);
  };

  const handleDeposit = () => {
    if (!canSubmit) { showAlert("Champs manquants", "Veuillez remplir le numéro et le montant."); return; }
    const msg = `Créditer ${fmt(numAmount)} XOF sur le wallet du client ${phone.trim()} ?`;
    if (Platform.OS === "web") { if (window.confirm(msg)) void process(); }
    else Alert.alert("Confirmation Dépôt", msg, [
      { text: "Annuler", style: "cancel" },
      { text: "CONFIRMER", onPress: () => void process() },
    ]);
  };

  const process = async () => {
    setLoading(true);
    try {
      await api.http.post("/transactions/deposit", { userPhone: phone.trim(), amount: numAmount });
      showAlert("✅ Dépôt effectué", `${fmt(numAmount)} XOF crédités sur ${phone.trim()}.`, () => router.back());
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Le dépôt a échoué.";
      showAlert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally { setLoading(false); }
  };

  // Anime l'apparition du résumé
  const onAmountChange = (v: string) => {
    setAmount(v);
    const n = parseFloat(v) || 0;
    Animated.timing(fadeAnim, { toValue: n > 0 && phone.trim().length >= 8 ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  };
  const onPhoneChange = (v: string) => {
    setPhone(v);
    Animated.timing(fadeAnim, { toValue: numAmount > 0 && v.trim().length >= 8 ? 1 : 0, duration: 200, useNativeDriver: true }).start();
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
            <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Dépôt Client</Text>
            <Text style={[s.heroSub,   { fontFamily: C.font.sans  }]}>Cash-In · Crédit Wallet</Text>
          </View>
          <View style={s.heroBadge}>
            <Ionicons name="arrow-down-circle-outline" size={20} color={C.white} />
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Bannière info */}
          <View style={s.banner}>
            <View style={[s.bannerIcon, { backgroundColor: C.blueBg }]}>
              <Ionicons name="wallet-outline" size={17} color={C.blue} />
            </View>
            <Text style={[s.bannerTxt, { fontFamily: C.font.sans }]}>
              Les fonds sont crédités <Text style={{ fontWeight: "800" }}>instantanément</Text> sur le Wallet du client.
            </Text>
          </View>

          {/* Formulaire */}
          <View style={s.card}>
            <View style={s.secRow}>
              <View style={[s.secDot, { backgroundColor: C.violet }]} />
              <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>INFORMATIONS DÉPÔT</Text>
            </View>

            <Field label="Numéro du client" value={phone} onChangeText={onPhoneChange} placeholder="620 000 000" keyboardType="phone-pad" required />

            {/* Montant */}
            <Text style={[f.label, { fontFamily: C.font.sans }]}>Montant <Text style={{ color: C.red }}>*</Text></Text>
            <View style={[s.amtBox, numAmount > 0 && { borderColor: C.violet }]}>
              <TextInput
                style={[s.amtInput, { fontFamily: C.font.serif }]}
                value={amount} onChangeText={onAmountChange}
                placeholder="0" placeholderTextColor={C.inkSoft}
                keyboardType="numeric"
              />
              <View style={s.curBox}>
                <Text style={[s.curTxt, { fontFamily: C.font.mono }]}>XOF</Text>
              </View>
            </View>

            {/* Montants rapides */}
            <Text style={[s.quickLbl, { fontFamily: C.font.sans }]}>MONTANTS RAPIDES</Text>
            <View style={s.quickRow}>
              {QUICK.map((v) => {
                const active = numAmount === v;
                return (
                  <TouchableOpacity
                    key={v}
                    style={[s.quickPill, active && { backgroundColor: C.violetLight, borderColor: C.violet }]}
                    onPress={() => { setAmount(String(v)); onAmountChange(String(v)); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.quickTxt, { color: active ? C.violet : C.inkSoft, fontFamily: C.font.mono }]}>
                      {fmt(v)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Résumé animé */}
          <Animated.View style={[s.summary, { opacity: fadeAnim }]}>
            <View style={s.summaryHead}>
              <View style={[s.summaryIconBox, { backgroundColor: C.violetLight }]}>
                <Ionicons name="receipt-outline" size={15} color={C.violet} />
              </View>
              <Text style={[s.summaryTitle, { fontFamily: C.font.sans }]}>Récapitulatif</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={[s.sumLbl, { fontFamily: C.font.sans }]}>Client</Text>
              <Text style={[s.sumVal, { fontFamily: C.font.mono }]}>{phone.trim()}</Text>
            </View>
            <View style={s.sumDivider} />
            <View style={s.summaryRow}>
              <Text style={[s.sumLbl, { fontFamily: C.font.sans }]}>Montant à créditer</Text>
              <Text style={[s.sumAmt, { fontFamily: C.font.serif }]}>{fmt(numAmount)} XOF</Text>
            </View>
          </Animated.View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.cta, (!canSubmit || loading) && { opacity: 0.4 }]}
            onPress={handleDeposit} disabled={!canSubmit || loading} activeOpacity={0.88}
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
  heroBadge: {
    width: 42, height: 42, borderRadius: C.r.sm,
    backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr,
    justifyContent: "center", alignItems: "center",
  },

  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  banner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.blueBg, borderRadius: C.r.md,
    padding: 14, borderWidth: 1, borderColor: C.blueBorder, marginBottom: 18,
  },
  bannerIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  bannerTxt:  { flex: 1, color: C.blue, fontSize: 12, fontWeight: "600", lineHeight: 18 },

  card: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.violet, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  secRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18 },
  secDot: { width: 5, height: 5, borderRadius: C.r.pill },
  secLbl: { fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1.5 },

  amtBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder,
    borderRadius: C.r.md, overflow: "hidden", marginBottom: 18,
  },
  amtInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 30, color: C.ink, fontWeight: "800" },
  curBox:   { paddingHorizontal: 14, paddingVertical: 14, backgroundColor: C.violetLight, borderLeftWidth: 1, borderLeftColor: C.violetBorder },
  curTxt:   { color: C.violet, fontSize: 12, fontWeight: "900", letterSpacing: 1 },

  quickLbl:  { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" },
  quickRow:  { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: C.r.md, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder },
  quickTxt:  { fontSize: 11, fontWeight: "800" },

  summary: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    padding: 18, marginBottom: 16,
    borderWidth: 1.5, borderColor: C.violetBorder,
    shadowColor: C.violet, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  summaryHead:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  summaryIconBox: { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  summaryTitle:   { fontSize: 12, fontWeight: "900", color: C.violet, letterSpacing: 0.5 },
  summaryRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sumLbl:         { color: C.inkSoft, fontSize: 12, fontWeight: "700" },
  sumVal:         { color: C.ink, fontSize: 14, fontWeight: "800" },
  sumDivider:     { height: 1, backgroundColor: C.violetBorder, marginVertical: 10 },
  sumAmt:         { fontSize: 22, fontWeight: "900", color: C.violet },

  cta:       { borderRadius: C.r.md, overflow: "hidden", marginBottom: 10 },
  ctaInner:  { backgroundColor: C.violet, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8, borderRadius: C.r.md },
  ctaTxt:    { color: C.white, fontWeight: "900", fontSize: 13, letterSpacing: 1 },
  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelTxt: { color: C.inkSoft, fontWeight: "800", fontSize: 14 },
});