//apps/direct-transfair-mobile/app/agent/deposit.tsx
// apps/direct-transfair-mobile/app/agent/deposit.tsx
// =========================================================
// AGENT DEPOSIT (CASH-IN) v4.0 — Direct Transf'air
// Design: Forge & Ambre — thème AGENT
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
import { LinearGradient } from "expo-linear-gradient";
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
  label, value, onChangeText, placeholder, keyboardType, prefix, required,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; prefix?: string; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fS.wrap}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>
        {label}
        {required && <Text style={{ color: T.red }}> *</Text>}
      </Text>
      <View style={[fS.box, focused && fS.boxFocused]}>
        {prefix && (
          <View style={fS.prefixBox}>
            <Text style={[fS.prefixTxt, { fontFamily: T.font.mono }]}>{prefix}</Text>
          </View>
        )}
        <TextInput
          style={[fS.input, { fontFamily: prefix ? T.font.display : T.font.sans }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={T.dim + "55"}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}
const fS = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1, marginBottom: 6 },
  box: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, overflow: "hidden",
  },
  boxFocused: { borderColor: `${T.accent}45` },
  prefixBox: {
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: T.ghost, borderRightWidth: 1, borderRightColor: T.inkBorder,
  },
  prefixTxt: { color: T.accent, fontSize: 18, fontWeight: "900" },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: T.white, fontWeight: "700" },
});

// ─── Quick Amount Pills ────────────────────────────────────
const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 25000, 50000];

export default function AgentDepositScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const numAmount = parseFloat(amount) || 0;
  const canSubmit = phone.trim().length >= 8 && numAmount > 0;

  const showAlert = (title: string, msg: string, onOk?: () => void) => {
    if (Platform.OS === "web") { setTimeout(() => { window.alert(`${title}\n\n${msg}`); if (onOk) onOk(); }, 100); }
    else Alert.alert(title, msg, [{ text: "OK", onPress: onOk }]);
  };

  const handleDeposit = () => {
    if (!canSubmit) { showAlert("Champs manquants", "Veuillez remplir le numéro et le montant."); return; }
    const msg = `Créditer ${fmt(numAmount)} XOF sur le wallet du client ${phone.trim()} ?`;
    if (Platform.OS === "web") { if (window.confirm(msg)) void processDeposit(); }
    else Alert.alert("Confirmation Dépôt", msg, [
      { text: "Annuler", style: "cancel" },
      { text: "CONFIRMER", onPress: () => void processDeposit() },
    ]);
  };

  const processDeposit = async () => {
    setLoading(true);
    try {
      await api.http.post("/transactions/deposit", {
        userPhone: phone.trim(),
        amount: numAmount,
      });
      showAlert("✅ Dépôt effectué", `${fmt(numAmount)} XOF crédités sur ${phone.trim()}.`, () => router.back());
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Le dépôt a échoué.";
      showAlert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[T.g1, T.g2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={T.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Dépôt Client</Text>
            <Text style={[s.headerSub, { color: T.accent, fontFamily: T.font.sans }]}>Cash-In · Crédit Wallet</Text>
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Info banner */}
            <View style={s.infoBanner}>
              <View style={[s.infoIconBox, { backgroundColor: `${T.blue}15` }]}>
                <Ionicons name="wallet-outline" size={20} color={T.blue} />
              </View>
              <Text style={[s.infoTxt, { fontFamily: T.font.sans }]}>
                Les fonds seront crédités instantanément sur le Wallet du client.
              </Text>
            </View>

            {/* Formulaire */}
            <View style={s.card}>
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: T.accent }]} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>INFORMATIONS DÉPÔT</Text>
              </View>

              <Field
                label="NUMÉRO DU CLIENT"
                value={phone}
                onChangeText={setPhone}
                placeholder="620 000 000"
                keyboardType="phone-pad"
                required
              />

              {/* Montant avec préfixe */}
              <View style={{ marginBottom: 16 }}>
                <Text style={[fS.label, { fontFamily: T.font.sans }]}>
                  MONTANT <Text style={{ color: T.red }}>*</Text>
                </Text>
                <View style={[fS.box, amount.length > 0 && { borderColor: `${T.accent}45` }]}>
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

              {/* Quick amounts */}
              <Text style={[s.quickLabel, { fontFamily: T.font.sans }]}>MONTANTS RAPIDES</Text>
              <View style={s.quickRow}>
                {QUICK_AMOUNTS.map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[
                      s.quickPill,
                      numAmount === v && { backgroundColor: T.accentGlow, borderColor: `${T.accent}40` },
                    ]}
                    onPress={() => setAmount(String(v))}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      s.quickTxt,
                      { color: numAmount === v ? T.accent : T.dim, fontFamily: T.font.mono },
                    ]}>
                      {fmt(v)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Résumé */}
            {numAmount > 0 && phone.trim().length >= 8 && (
              <View style={s.summaryCard}>
                <View style={s.summaryRow}>
                  <Text style={[s.summaryLabel, { fontFamily: T.font.sans }]}>Client</Text>
                  <Text style={[s.summaryValue, { fontFamily: T.font.mono }]}>{phone.trim()}</Text>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryRow}>
                  <Text style={[s.summaryLabel, { fontFamily: T.font.sans }]}>Montant à créditer</Text>
                  <Text style={[s.summaryAmountTxt, { color: T.accent, fontFamily: T.font.display }]}>
                    {fmt(numAmount)} XOF
                  </Text>
                </View>
              </View>
            )}

            {/* Bouton */}
            <TouchableOpacity
              style={[s.submitBtn, (!canSubmit || loading) && { opacity: 0.5 }]}
              onPress={handleDeposit}
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
                      <Ionicons name="checkmark-circle-outline" size={20} color={T.g1} />
                      <Text style={[s.submitTxt, { fontFamily: T.font.sans }]}>VALIDER LE DÉPÔT</Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()} disabled={loading}>
              <Text style={[s.cancelTxt, { fontFamily: T.font.sans }]}>Annuler</Text>
            </TouchableOpacity>

            <View style={{ height: 60 }} />
          </ScrollView>
        </KeyboardAvoidingView>
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

  infoBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: `${T.blue}10`, borderRadius: T.radius.md,
    padding: 14, borderWidth: 1, borderColor: `${T.blue}20`, marginBottom: 18,
  },
  infoIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  infoTxt: { flex: 1, color: T.blue, fontSize: 12, fontWeight: "600", lineHeight: 17 },

  card: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 16, borderWidth: 1, borderColor: T.inkBorder,
  },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  sectionDot: { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },

  amountInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 28, color: T.white, fontWeight: "800" },
  currBox: {
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: T.ghost, borderLeftWidth: 1, borderLeftColor: T.inkBorder,
  },
  currTxt: { color: T.dim, fontSize: 12, fontWeight: "900", letterSpacing: 1 },

  quickLabel: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 8 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickPill: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: T.radius.md,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
  },
  quickTxt: { fontSize: 11, fontWeight: "800" },

  summaryCard: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 18, marginBottom: 16, borderWidth: 1, borderColor: `${T.accent}20`,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { color: T.dim, fontSize: 12, fontWeight: "700" },
  summaryValue: { color: T.white, fontSize: 14, fontWeight: "800" },
  summaryDivider: { height: 1, backgroundColor: T.inkBorder, marginVertical: 10 },
  summaryAmountTxt: { fontSize: 22, fontWeight: "900" },

  submitBtn: { borderRadius: T.radius.md, overflow: "hidden", marginBottom: 10 },
  submitGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8 },
  submitTxt: { color: T.g1, fontWeight: "900", fontSize: 13, letterSpacing: 1 },

  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelTxt: { color: T.dim, fontWeight: "800", fontSize: 14 },
});