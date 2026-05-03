//apps/direct-transfair-mobile/app/agent/withdraw.tsx
// apps/direct-transfair-mobile/app/agent/withdraw.tsx
// =========================================================
// AGENT WITHDRAW (RETRAIT ESPÈCES) v4.0 — Direct Transf'air
// Design: Forge & Ambre — thème AGENT
// ✅ Vérification code → Détail → Confirmation paiement
// ✅ Montant converti GNF prioritaire
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
  amber: "#F59E0B",
  radius: { sm: 10, md: 14, lg: 20, xl: 26 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

function toNum(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return isFinite(n) ? n : 0; }
  return 0;
}

function fmt(n: number, currency = "XOF"): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

// ─── Info Row ─────────────────────────────────────────────
function InfoRow({ label, value, icon, color = T.dim }: { label: string; value: string; icon: string; color?: string }) {
  return (
    <View style={irS.row}>
      <View style={[irS.iconBox, { backgroundColor: `${color}12` }]}>
        <Ionicons name={icon as any} size={14} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[irS.label, { fontFamily: T.font.sans }]}>{label}</Text>
        <Text style={[irS.value, { fontFamily: T.font.sans }]} numberOfLines={1}>{value || "—"}</Text>
      </View>
    </View>
  );
}
const irS = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  iconBox: { width: 32, height: 32, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  label: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 0.8, marginBottom: 2 },
  value: { fontSize: 13, fontWeight: "700", color: T.white },
});

// ─── Main Screen ──────────────────────────────────────────
export default function AgentWithdrawScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [paying, setPaying] = useState(false);
  const [transaction, setTransaction] = useState<any>(null);
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const showAlert = (title: string, msg: string, onOk?: () => void) => {
    if (Platform.OS === "web") { setTimeout(() => { window.alert(`${title}\n\n${msg}`); if (onOk) onOk(); }, 100); }
    else Alert.alert(title, msg, [{ text: "OK", onPress: onOk }]);
  };

  const getAmountData = () => {
    if (!transaction) return { val: "0", curr: "XOF" };
    if (toNum(transaction.receivedAmount) > 0) {
      return {
        val: fmt(toNum(transaction.receivedAmount), transaction.targetCurrency ?? "GNF"),
        curr: transaction.targetCurrency ?? "GNF",
      };
    }
    return { val: fmt(toNum(transaction.amount), transaction.currency), curr: transaction.currency ?? "XOF" };
  };

  const handleCheckCode = async () => {
    if (code.trim().length < 6) { showAlert("Erreur", "Le code doit contenir au moins 6 caractères."); return; }
    setChecking(true);
    setTransaction(null);
    try {
      const res = await api.http.post("/withdrawals/agent/check", { code: code.trim() });
      setTransaction(res.data);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 6 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Code invalide ou introuvable.";
      showAlert("Code invalide", Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setChecking(false);
    }
  };

  const handlePayOut = () => {
    const { val, curr } = getAmountData();
    const msg = `Confirmez-vous avoir remis ${val} ${curr} au client ?`;
    if (Platform.OS === "web") { if (window.confirm(msg)) void processPayment(); }
    else Alert.alert("Confirmation", msg, [
      { text: "Annuler", style: "cancel" },
      { text: "CONFIRMER", onPress: () => void processPayment() },
    ]);
  };

  const processPayment = async () => {
    setPaying(true);
    try {
      await api.http.post("/withdrawals/agent/pay", { code: code.trim() });
      showAlert("✅ Paiement validé", "Le retrait a été enregistré et votre commission créditée.", () => router.back());
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Échec de la validation.";
      showAlert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setPaying(false);
    }
  };

  const { val: amountVal, curr: amountCurr } = getAmountData();

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
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Retrait Espèces</Text>
            <Text style={[s.headerSub, { color: T.accent, fontFamily: T.font.sans }]}>
              {transaction ? "Paiement en cours" : "Entrez le code de retrait"}
            </Text>
          </View>
          {transaction && (
            <TouchableOpacity
              style={[s.resetBtn]}
              onPress={() => { setTransaction(null); setCode(""); fadeAnim.setValue(0); }}
            >
              <Ionicons name="close" size={18} color={T.dim} />
            </TouchableOpacity>
          )}
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {!transaction ? (
              /* ── Saisie code ── */
              <View style={s.centerBox}>
                <View style={s.qrIconBox}>
                  <LinearGradient colors={[T.accentGlow, "transparent"]} style={s.qrIconGrad}>
                    <Ionicons name="qr-code-outline" size={54} color={T.accent} />
                  </LinearGradient>
                </View>
                <Text style={[s.codeHint, { fontFamily: T.font.sans }]}>
                  Demandez le code de retrait au client
                </Text>

                <View style={s.codeInputWrap}>
                  <TextInput
                    style={[s.codeInput, { fontFamily: T.font.mono }]}
                    value={code}
                    onChangeText={setCode}
                    placeholder="• • • • • •"
                    placeholderTextColor={T.dim + "55"}
                    keyboardType="default"
                    autoCapitalize="characters"
                    maxLength={20}
                    textAlign="center"
                  />
                </View>

                <TouchableOpacity
                  style={[s.checkBtn, (checking || code.trim().length < 6) && { opacity: 0.5 }]}
                  onPress={() => void handleCheckCode()}
                  disabled={checking || code.trim().length < 6}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[T.accent, T.accentSoft]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.checkBtnGrad}
                  >
                    {checking
                      ? <ActivityIndicator color={T.g1} />
                      : <>
                          <Ionicons name="search-outline" size={18} color={T.g1} />
                          <Text style={[s.checkBtnTxt, { fontFamily: T.font.sans }]}>VÉRIFIER LE CODE</Text>
                        </>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Résultat ── */
              <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
                {/* Valid badge */}
                <View style={s.validBadge}>
                  <View style={s.validIconBox}>
                    <Ionicons name="checkmark-circle" size={22} color={T.green} />
                  </View>
                  <Text style={[s.validLabel, { fontFamily: T.font.sans }]}>CODE VALIDE</Text>
                </View>

                {/* Montant hero */}
                <LinearGradient
                  colors={["rgba(34,197,94,0.15)", "rgba(34,197,94,0.05)"]}
                  style={s.amountCard}
                >
                  <Text style={[s.amountLabel, { fontFamily: T.font.sans }]}>MONTANT À PAYER AU CLIENT</Text>
                  <Text style={[s.amountValue, { fontFamily: T.font.display }]} numberOfLines={1} adjustsFontSizeToFit>
                    {amountVal}
                  </Text>
                  <Text style={[s.amountCurrency, { fontFamily: T.font.mono }]}>{amountCurr}</Text>

                  {/* Taux de change si conversion */}
                  {transaction.receivedAmount && toNum(transaction.receivedAmount) > 0 && transaction.targetCurrency !== transaction.currency && (
                    <View style={s.rateRow}>
                      <Ionicons name="swap-horizontal" size={12} color={T.dim} />
                      <Text style={[s.rateTxt, { fontFamily: T.font.mono }]}>
                        {fmt(toNum(transaction.amount), transaction.currency)} {transaction.currency}
                        {transaction.exchangeRate ? ` · Taux : ${Number(transaction.exchangeRate).toFixed(2)}` : ""}
                      </Text>
                    </View>
                  )}
                </LinearGradient>

                {/* Bénéficiaire */}
                <View style={s.card}>
                  <View style={s.sectionRow}>
                    <View style={[s.sectionDot, { backgroundColor: T.blue }]} />
                    <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>BÉNÉFICIAIRE — VÉRIFIER PIÈCE D'IDENTITÉ</Text>
                  </View>
                  <InfoRow
                    label="NOM COMPLET"
                    value={transaction.beneficiary?.fullName || "Non spécifié"}
                    icon="person-outline"
                    color={T.blue}
                  />
                  <InfoRow
                    label="TÉLÉPHONE"
                    value={transaction.beneficiary?.phone || "—"}
                    icon="call-outline"
                    color={T.blue}
                  />
                </View>

                {/* Expéditeur */}
                <View style={s.card}>
                  <View style={s.sectionRow}>
                    <View style={[s.sectionDot, { backgroundColor: T.accent }]} />
                    <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>EXPÉDITEUR</Text>
                  </View>
                  <InfoRow
                    label="NOM"
                    value={transaction.senderName || `${transaction.sender?.firstName ?? ""} ${transaction.sender?.lastName ?? ""}`.trim() || "—"}
                    icon="person-circle-outline"
                    color={T.accent}
                  />
                  <InfoRow
                    label="PAYS D'ORIGINE"
                    value={transaction.originCountry || transaction.sender?.country || "—"}
                    icon="flag-outline"
                    color={T.accent}
                  />
                  <InfoRow
                    label="RÉFÉRENCE"
                    value={transaction.reference || "—"}
                    icon="document-text-outline"
                    color={T.dim}
                  />
                </View>

                {/* Warning */}
                <View style={s.warningBox}>
                  <Ionicons name="warning-outline" size={16} color={T.amber} />
                  <Text style={[s.warningTxt, { fontFamily: T.font.sans }]}>
                    Vérifiez impérativement la pièce d'identité du bénéficiaire avant de remettre les fonds.
                  </Text>
                </View>

                {/* Confirmer */}
                <TouchableOpacity
                  style={[s.payBtn, paying && { opacity: 0.65 }]}
                  onPress={handlePayOut}
                  disabled={paying}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[T.green, "#34D399"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.payBtnGrad}
                  >
                    {paying
                      ? <ActivityIndicator color={T.g1} />
                      : <>
                          <Ionicons name="checkmark-circle-outline" size={20} color={T.g1} />
                          <Text style={[s.payBtnTxt, { fontFamily: T.font.sans }]}>
                            CONFIRMER LE PAIEMENT DE {amountVal} {amountCurr}
                          </Text>
                        </>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.cancelBtn}
                  onPress={() => { setTransaction(null); setCode(""); fadeAnim.setValue(0); }}
                  disabled={paying}
                >
                  <Text style={[s.cancelTxt, { fontFamily: T.font.sans }]}>Annuler · Nouveau code</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            <View style={{ height: 80 }} />
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
  resetBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.ghost, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: T.inkBorder,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  // ── Saisie code ──
  centerBox: { alignItems: "center", paddingTop: 20 },
  qrIconBox: { marginBottom: 20 },
  qrIconGrad: { width: 100, height: 100, borderRadius: 28, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: `${T.accent}25` },
  codeHint: { color: T.dim, fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 24, lineHeight: 18 },
  codeInputWrap: { width: "100%", marginBottom: 24 },
  codeInput: {
    backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder,
    borderRadius: T.radius.md, paddingVertical: 20, paddingHorizontal: 20,
    fontSize: 28, color: T.white, fontWeight: "900", letterSpacing: 6, textAlign: "center",
  },
  checkBtn: { width: "100%", borderRadius: T.radius.md, overflow: "hidden" },
  checkBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8 },
  checkBtnTxt: { color: T.g1, fontWeight: "900", fontSize: 13, letterSpacing: 1 },

  // ── Result ──
  validBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(34,197,94,0.10)", borderRadius: T.radius.md,
    padding: 12, borderWidth: 1, borderColor: "rgba(34,197,94,0.20)", marginBottom: 14,
  },
  validIconBox: { width: 28, height: 28, borderRadius: 9, backgroundColor: "rgba(34,197,94,0.15)", justifyContent: "center", alignItems: "center" },
  validLabel: { color: T.green, fontSize: 11, fontWeight: "900", letterSpacing: 1 },

  amountCard: {
    borderRadius: T.radius.lg, padding: 22, marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(34,197,94,0.20)",
  },
  amountLabel: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 8 },
  amountValue: { color: T.white, fontSize: 38, fontWeight: "900", letterSpacing: -0.5 },
  amountCurrency: { color: T.green, fontSize: 12, fontWeight: "900", marginTop: 4, letterSpacing: 1 },
  rateRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  rateTxt: { color: T.dim, fontSize: 11, fontWeight: "700" },

  card: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: T.inkBorder,
  },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionDot: { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { fontSize: 10, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },

  warningBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "rgba(245,158,11,0.08)", borderRadius: T.radius.md,
    padding: 14, borderWidth: 1, borderColor: "rgba(245,158,11,0.20)", marginBottom: 16,
  },
  warningTxt: { flex: 1, color: T.amber, fontSize: 12, fontWeight: "600", lineHeight: 17 },

  payBtn: { borderRadius: T.radius.md, overflow: "hidden", marginBottom: 10 },
  payBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8, flexWrap: "wrap" },
  payBtnTxt: { color: T.g1, fontWeight: "900", fontSize: 13, letterSpacing: 0.5, textAlign: "center" },

  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelTxt: { color: T.dim, fontWeight: "800", fontSize: 14 },
});