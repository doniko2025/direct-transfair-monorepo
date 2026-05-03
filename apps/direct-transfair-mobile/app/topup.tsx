//apps/direct-transfair-mobile/app/topup.tsx
// apps/direct-transfair-mobile/app/topup.tsx
// =========================================================
// TOP-UP SCREEN v4.0 — Direct Transf'air
// Design: Émeraude Profond (USER)
// ✅ Carte bancaire + Orange Money · Quick amounts
// =========================================================

import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../providers/AuthProvider";
import { api } from "../services/api";

const T = {
  g1: "#0B1F14", g2: "#0F2A1C",
  accent: "#10B981", accentSoft: "#34D399", accentGlow: "rgba(16,185,129,0.15)",
  ghost: "rgba(255,255,255,0.06)", inkBorder: "rgba(255,255,255,0.08)", inkLight: "#1C2820",
  white: "#FFFFFF", dim: "#8A9BB5", dimSoft: "#7B9E8A",
  orange: "#F97316", blue: "#60A5FA", amber: "#F59E0B", red: "#EF4444",
  radius: { md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500];

function fmt(n: number): string {
  try { return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n); }
  catch { return n.toString(); }
}

// ─── Field ────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder, keyboardType,
  secureTextEntry, maxLength, style,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any;
  secureTextEntry?: boolean; maxLength?: number; style?: any;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[fS.wrap, style]}>
      <Text style={[fS.label, { fontFamily: T.font.sans }]}>{label}</Text>
      <View style={[fS.box, focused && fS.focused]}>
        <TextInput
          style={[fS.input, { fontFamily: T.font.sans }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={T.dim + "55"}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}
const fS = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 10, fontWeight: "900", color: T.dimSoft, letterSpacing: 1, marginBottom: 6 },
  box: { backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder, borderRadius: T.radius.md },
  focused: { borderColor: `${T.accent}45` },
  input: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: T.white, fontWeight: "600" },
});

// ─── Method Tab ───────────────────────────────────────────
function MethodTab({
  icon, label, active, color, onPress,
}: {
  icon: React.ReactNode; label: string; active: boolean; color: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={[
          mtS.tab,
          active && { backgroundColor: `${color}12`, borderColor: `${color}30` },
        ]}
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        {icon}
        <Text style={[mtS.label, { color: active ? color : T.dim, fontFamily: T.font.sans }]}>
          {label}
        </Text>
        {active && <View style={[mtS.dot, { backgroundColor: color }]} />}
      </TouchableOpacity>
    </Animated.View>
  );
}
const mtS = StyleSheet.create({
  tab: {
    alignItems: "center", paddingVertical: 16, borderRadius: T.radius.lg, gap: 8,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder, position: "relative",
  },
  label: { fontSize: 12, fontWeight: "800" },
  dot: { position: "absolute", top: 10, right: 10, width: 6, height: 6, borderRadius: 99 },
});

// ─── Main Screen ──────────────────────────────────────────
export default function TopUpScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [amount, setAmount] = useState("50");
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<"CARD" | "OM">("CARD");

  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  const numAmount = parseFloat(amount) || 0;
  const canPay = numAmount >= 1 && (
    method === "CARD"
      ? cardHolder.trim().length >= 2 && cardNumber.length >= 16 && cardExpiry.length >= 4 && cardCvc.length >= 3
      : mobileNumber.length >= 9
  );

  const handleClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const handleTopUp = () => {
    if (!canPay) {
      Alert.alert("Données manquantes", "Veuillez compléter tous les champs."); return;
    }
    const methodLabel = method === "CARD" ? "par carte" : "par Orange Money";
    Alert.alert(
      "Confirmation",
      `Recharger ${fmt(numAmount)} EUR ${methodLabel} ?`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "PAYER", onPress: () => void processPayment() },
      ]
    );
  };

  const processPayment = async () => {
    setLoading(true);
    // Simulation 2s
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const currentBalance = user?.balance ? Number(user.balance) : 0;
      await api.updateProfile({ balance: currentBalance + numAmount } as any);
      await refreshUser();
      Alert.alert(
        "✅ Paiement réussi",
        `Votre compte a été crédité de ${fmt(numAmount)} EUR.`,
        [{ text: "Super", onPress: handleClose }]
      );
    } catch {
      Alert.alert("Erreur", "Le rechargement a échoué. Réessayez.");
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
          <TouchableOpacity style={s.closeBtn} onPress={handleClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={T.dim} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Recharger le Compte</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ── Montant ── */}
            <View style={s.card}>
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: T.accent }]} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>MONTANT À AJOUTER</Text>
              </View>

              <View style={[s.amountBox, numAmount > 0 && { borderColor: `${T.accent}35` }]}>
                <TextInput
                  style={[s.amountInput, { fontFamily: T.font.display }]}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={T.dim + "55"}
                />
                <View style={s.eurBox}>
                  <Text style={[s.eurTxt, { fontFamily: T.font.mono }]}>EUR</Text>
                </View>
              </View>

              <Text style={[s.quickLabel, { fontFamily: T.font.sans }]}>MONTANTS RAPIDES</Text>
              <View style={s.quickRow}>
                {QUICK_AMOUNTS.map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[s.quickPill, numAmount === v && { backgroundColor: T.accentGlow, borderColor: `${T.accent}40` }]}
                    onPress={() => setAmount(String(v))}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.quickTxt, { color: numAmount === v ? T.accent : T.dim, fontFamily: T.font.mono }]}>
                      {v}€
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Méthode ── */}
            <View style={s.card}>
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: T.blue }]} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>MOYEN DE PAIEMENT</Text>
              </View>

              <View style={s.methodsRow}>
                <MethodTab
                  icon={<Ionicons name="card" size={24} color={method === "CARD" ? T.blue : T.dim} />}
                  label="Carte"
                  active={method === "CARD"}
                  color={T.blue}
                  onPress={() => setMethod("CARD")}
                />
                <MethodTab
                  icon={<MaterialCommunityIcons name="cellphone-nfc" size={24} color={method === "OM" ? T.orange : T.dim} />}
                  label="Orange Money"
                  active={method === "OM"}
                  color={T.orange}
                  onPress={() => setMethod("OM")}
                />
              </View>
            </View>

            {/* ── Formulaire selon méthode ── */}
            <View style={s.card}>
              {method === "CARD" ? (
                <>
                  <View style={s.sectionRow}>
                    <View style={[s.sectionDot, { backgroundColor: T.blue }]} />
                    <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>DÉTAILS DE LA CARTE</Text>
                  </View>
                  <Field label="NOM DU TITULAIRE" value={cardHolder} onChange={setCardHolder} placeholder="Jean DUPONT" />
                  <Field label="NUMÉRO DE CARTE" value={cardNumber} onChange={setCardNumber} placeholder="0000 0000 0000 0000" keyboardType="numeric" maxLength={16} />
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Field label="EXPIRATION" value={cardExpiry} onChange={setCardExpiry} placeholder="MM/AA" keyboardType="numeric" maxLength={5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label="CVV" value={cardCvc} onChange={setCardCvc} placeholder="•••" keyboardType="numeric" maxLength={3} secureTextEntry />
                    </View>
                  </View>
                  <View style={s.secureNote}>
                    <Ionicons name="lock-closed-outline" size={12} color={T.dim} />
                    <Text style={[s.secureNoteTxt, { fontFamily: T.font.sans }]}>
                      Paiement sécurisé par chiffrement 3D Secure
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={s.sectionRow}>
                    <View style={[s.sectionDot, { backgroundColor: T.orange }]} />
                    <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>NUMÉRO À DÉBITER</Text>
                  </View>
                  <Text style={[fS.label, { fontFamily: T.font.sans }]}>NUMÉRO ORANGE MONEY</Text>
                  <View style={[fS.box, { flexDirection: "row", alignItems: "center", marginBottom: 12 }]}>
                    <Text style={{ fontSize: 20, paddingLeft: 12 }}>🇸🇳</Text>
                    <Text style={[s.dialCode, { fontFamily: T.font.mono }]}>+221</Text>
                    <View style={s.dialDivider} />
                    <TextInput
                      style={[fS.input, { flex: 1, fontFamily: T.font.sans }]}
                      value={mobileNumber}
                      onChangeText={setMobileNumber}
                      placeholder="77 000 00 00"
                      placeholderTextColor={T.dim + "55"}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <View style={s.omInfoBox}>
                    <Ionicons name="information-circle-outline" size={15} color={T.orange} />
                    <Text style={[s.omInfoTxt, { fontFamily: T.font.sans }]}>
                      Vous recevrez un SMS pour valider le paiement.
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* ── Bouton payer ── */}
            <TouchableOpacity
              style={[s.payBtn, (!canPay || loading) && { opacity: 0.5 }]}
              onPress={handleTopUp}
              disabled={!canPay || loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={method === "CARD" ? [T.blue, "#93C5FD"] : [T.orange, "#FCA5A5"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.payGrad}
              >
                {loading
                  ? <ActivityIndicator color={T.g1} />
                  : <>
                      <Ionicons
                        name={method === "CARD" ? "card-outline" : "cellphone-nfc" as any}
                        size={18} color={T.g1}
                      />
                      <Text style={[s.payTxt, { fontFamily: T.font.sans }]}>
                        PAYER {numAmount > 0 ? `${fmt(numAmount)} EUR` : ""}{method === "CARD" ? " PAR CARTE" : " PAR OM"}
                      </Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 80 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 44 : 16, paddingBottom: 16,
  },
  closeBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ghost, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.inkBorder },
  headerTitle: { color: T.white, fontSize: 20, fontWeight: "700" },

  scroll: { paddingHorizontal: 20, paddingTop: 4 },

  card: { backgroundColor: T.ghost, borderRadius: T.radius.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: T.inkBorder },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionDot: { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },

  amountBox: { flexDirection: "row", alignItems: "center", backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder, borderRadius: T.radius.md, overflow: "hidden", marginBottom: 14 },
  amountInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 28, color: T.white, fontWeight: "800" },
  eurBox: { paddingHorizontal: 14, backgroundColor: T.ghost, borderLeftWidth: 1, borderLeftColor: T.inkBorder, paddingVertical: 14 },
  eurTxt: { color: T.accent, fontSize: 13, fontWeight: "900", letterSpacing: 1 },

  quickLabel: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 8 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: T.radius.md, backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder },
  quickTxt: { fontSize: 12, fontWeight: "800" },

  methodsRow: { flexDirection: "row", gap: 12 },

  secureNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  secureNoteTxt: { color: T.dim, fontSize: 10, fontWeight: "600" },

  dialCode: { color: T.white, fontSize: 13, fontWeight: "800", paddingHorizontal: 8 },
  dialDivider: { width: 1, height: 20, backgroundColor: T.inkBorder },
  omInfoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: `${T.orange}08`, borderRadius: T.radius.md, padding: 12, borderWidth: 1, borderColor: `${T.orange}20` },
  omInfoTxt: { flex: 1, color: T.orange, fontSize: 11, fontWeight: "600", lineHeight: 16 },

  payBtn: { borderRadius: T.radius.md, overflow: "hidden" },
  payGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8 },
  payTxt: { color: T.g1, fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
});