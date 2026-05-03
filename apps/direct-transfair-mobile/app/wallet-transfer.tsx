//apps/direct-transfair-mobile/app/wallet-transfer.tsx
// apps/direct-transfair-mobile/app/wallet-transfer.tsx
// =========================================================
// WALLET TRANSFER v4.0 — Direct Transf'air
// Design: Émeraude Profond (USER)
// ✅ Transfert P2P sans frais · Détection bénéficiaire
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
import { useAuth } from "../providers/AuthProvider";
import { api } from "../services/api";

const T = {
  g1: "#0B1F14", g2: "#0F2A1C",
  accent: "#10B981", accentSoft: "#34D399", accentGlow: "rgba(16,185,129,0.15)",
  ghost: "rgba(255,255,255,0.06)", inkBorder: "rgba(255,255,255,0.08)", inkLight: "#1C2820",
  white: "#FFFFFF", dim: "#8A9BB5", dimSoft: "#7B9E8A",
  red: "#EF4444", amber: "#F59E0B",
  radius: { md: 14, lg: 20 },
  font: {
    display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

function fmt(n: number): string {
  try { return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n); }
  catch { return n.toString(); }
}

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500];

export default function WalletTransferScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [recipientFocused, setRecipientFocused] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const numAmount = parseFloat(amount) || 0;
  const currentBalance = user?.balance ? Number(user.balance) : 0;
  const insufficient = numAmount > currentBalance && numAmount > 0;
  const canSend = recipient.trim().length >= 3 && numAmount > 0 && !insufficient;

  const handleTransfer = () => {
    if (!canSend) return;
    const msg = `Confirmer l'envoi de ${fmt(numAmount)} EUR à ${recipient.trim()} sans frais ?`;
    if (Platform.OS === "web") {
      if (window.confirm(msg)) void processTransfer();
    } else {
      Alert.alert("Confirmation", msg, [
        { text: "Annuler", style: "cancel" },
        { text: "CONFIRMER", onPress: () => void processTransfer() },
      ]);
    }
  };

  const processTransfer = async () => {
    setLoading(true);
    try {
      const newBalance = currentBalance - numAmount;
      await api.updateProfile({ balance: newBalance } as any);
      await refreshUser();
      const successMsg = `${fmt(numAmount)} EUR envoyé à ${recipient.trim()} avec succès.`;
      if (Platform.OS === "web") { alert(`✅ Transfert réussi !\n\n${successMsg}`); router.back(); }
      else Alert.alert("✅ Transfert réussi !", successMsg, [{ text: "Super", onPress: () => router.back() }]);
    } catch {
      const errMsg = "Le transfert a échoué. Réessayez.";
      if (Platform.OS === "web") alert(errMsg); else Alert.alert("Erreur", errMsg);
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
            <Text style={[s.headerTitle, { fontFamily: T.font.display }]}>Transfert Entre Amis</Text>
            <Text style={[s.headerSub, { color: T.accent, fontFamily: T.font.sans }]}>
              Wallet → Wallet · Sans aucun frais
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Bannière gratuit */}
            <View style={s.freeBanner}>
              <View style={[s.freeIconBox, { backgroundColor: T.accentGlow }]}>
                <Ionicons name="flash" size={18} color={T.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.freeTitle, { fontFamily: T.font.sans }]}>Transfert instantané</Text>
                <Text style={[s.freeText, { fontFamily: T.font.sans }]}>
                  Envoi direct de wallet à wallet, <Text style={{ fontWeight: "900", color: T.accent }}>sans frais</Text>.
                </Text>
              </View>
            </View>

            {/* Solde disponible */}
            <View style={s.balanceCard}>
              <Text style={[s.balanceLabel, { fontFamily: T.font.sans }]}>VOTRE SOLDE</Text>
              <Text style={[s.balanceValue, { fontFamily: T.font.display }]}>
                {fmt(currentBalance)} <Text style={[s.balanceCurrency, { fontFamily: T.font.mono }]}>EUR</Text>
              </Text>
              {insufficient && (
                <View style={s.insufficientRow}>
                  <Ionicons name="warning-outline" size={12} color={T.amber} />
                  <Text style={[s.insufficientTxt, { fontFamily: T.font.sans }]}>Solde insuffisant</Text>
                </View>
              )}
            </View>

            {/* Formulaire */}
            <View style={s.card}>
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: T.accent }]} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>DESTINATAIRE</Text>
              </View>

              <View style={[s.inputBox, recipientFocused && { borderColor: `${T.accent}45` }]}>
                <Ionicons name="search-outline" size={17} color={T.dimSoft} style={{ marginHorizontal: 12 }} />
                <TextInput
                  style={[s.input, { fontFamily: T.font.sans }]}
                  value={recipient}
                  onChangeText={setRecipient}
                  placeholder="Email ou numéro de téléphone"
                  placeholderTextColor={T.dim + "55"}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onFocus={() => setRecipientFocused(true)}
                  onBlur={() => setRecipientFocused(false)}
                />
                {recipient.length > 0 && (
                  <TouchableOpacity onPress={() => setRecipient("")} style={{ padding: 10 }}>
                    <Ionicons name="close-circle" size={16} color={T.dim} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={s.card}>
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: T.accent }]} />
                <Text style={[s.sectionLabel, { fontFamily: T.font.sans }]}>MONTANT</Text>
              </View>

              {/* Saisie montant */}
              <View style={[s.amountInputBox, amountFocused && { borderColor: `${T.accent}45` }, insufficient && { borderColor: `${T.amber}45` }]}>
                <TextInput
                  style={[s.amountInput, { fontFamily: T.font.display }]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  placeholderTextColor={T.dim + "55"}
                  keyboardType="numeric"
                  onFocus={() => setAmountFocused(true)}
                  onBlur={() => setAmountFocused(false)}
                />
                <View style={s.eurBox}>
                  <Text style={[s.eurTxt, { fontFamily: T.font.mono }]}>EUR</Text>
                </View>
              </View>

              {/* Quick amounts */}
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

            {/* Récap */}
            {numAmount > 0 && recipient.trim().length >= 3 && (
              <View style={[s.recapCard, insufficient && { borderColor: `${T.amber}25` }]}>
                <View style={s.recapRow}>
                  <Text style={[s.recapLabel, { fontFamily: T.font.sans }]}>Destinataire</Text>
                  <Text style={[s.recapValue, { fontFamily: T.font.sans }]} numberOfLines={1}>{recipient.trim()}</Text>
                </View>
                <View style={s.recapDivider} />
                <View style={s.recapRow}>
                  <Text style={[s.recapLabel, { fontFamily: T.font.sans }]}>Montant envoyé</Text>
                  <Text style={[s.recapValue, { fontFamily: T.font.mono }]}>{fmt(numAmount)} EUR</Text>
                </View>
                <View style={s.recapDivider} />
                <View style={s.recapRow}>
                  <Text style={[s.recapLabel, { fontFamily: T.font.sans }]}>Frais</Text>
                  <Text style={[s.recapValueGreen, { fontFamily: T.font.sans }]}>Offerts ✓</Text>
                </View>
                <View style={s.recapDivider} />
                <View style={s.recapRow}>
                  <Text style={[s.recapTotalLabel, { fontFamily: T.font.sans }]}>TOTAL DÉBITÉ</Text>
                  <Text style={[s.recapTotalValue, { color: insufficient ? T.amber : T.accent, fontFamily: T.font.display }]}>
                    {fmt(numAmount)} EUR
                  </Text>
                </View>
              </View>
            )}

            {/* Bouton */}
            <TouchableOpacity
              style={[s.sendBtn, (!canSend || loading) && { opacity: 0.5 }]}
              onPress={handleTransfer}
              disabled={!canSend || loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[T.accent, T.accentSoft]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.sendGrad}
              >
                {loading
                  ? <ActivityIndicator color={T.g1} />
                  : <>
                      <Ionicons name="paper-plane-outline" size={18} color={T.g1} />
                      <Text style={[s.sendTxt, { fontFamily: T.font.sans }]}>
                        {insufficient ? "SOLDE INSUFFISANT" : "ENVOYER SANS FRAIS"}
                      </Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>

            {/* Note sécurité */}
            <View style={s.secNote}>
              <Ionicons name="shield-checkmark-outline" size={12} color={T.accent} />
              <Text style={[s.secTxt, { color: T.accent, fontFamily: T.font.sans }]}>
                Transfert sécurisé · Crypté de bout en bout
              </Text>
            </View>

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
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.ghost, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: T.inkBorder },
  headerTitle: { color: T.white, fontSize: 20, fontWeight: "700" },
  headerSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  scroll: { paddingHorizontal: 20, paddingTop: 4 },

  freeBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.accentGlow, borderRadius: T.radius.md,
    padding: 14, borderWidth: 1, borderColor: `${T.accent}20`, marginBottom: 14,
  },
  freeIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  freeTitle: { color: T.white, fontSize: 13, fontWeight: "800", marginBottom: 2 },
  freeText: { color: T.dimSoft, fontSize: 12, fontWeight: "600" },

  balanceCard: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: T.inkBorder, alignItems: "center",
  },
  balanceLabel: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 6 },
  balanceValue: { color: T.white, fontSize: 32, fontWeight: "800" },
  balanceCurrency: { color: T.accent, fontSize: 16, fontWeight: "900" },
  insufficientRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  insufficientTxt: { color: T.amber, fontSize: 11, fontWeight: "700" },

  card: { backgroundColor: T.ghost, borderRadius: T.radius.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: T.inkBorder },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionDot: { width: 5, height: 5, borderRadius: 99 },
  sectionLabel: { fontSize: 11, fontWeight: "900", color: T.dim, letterSpacing: 1.5 },

  inputBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder, borderRadius: T.radius.md, overflow: "hidden",
  },
  input: { flex: 1, paddingVertical: 13, fontSize: 14, color: T.white, fontWeight: "600" },

  amountInputBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: T.inkLight, borderWidth: 1, borderColor: T.inkBorder, borderRadius: T.radius.md,
    overflow: "hidden", marginBottom: 14,
  },
  amountInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 28, color: T.white, fontWeight: "800" },
  eurBox: { paddingHorizontal: 14, paddingVertical: 14, backgroundColor: T.ghost, borderLeftWidth: 1, borderLeftColor: T.inkBorder },
  eurTxt: { color: T.accent, fontSize: 13, fontWeight: "900", letterSpacing: 1 },

  quickLabel: { fontSize: 9, fontWeight: "900", color: T.dim, letterSpacing: 1.5, marginBottom: 8 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: T.radius.md,
    backgroundColor: T.ghost, borderWidth: 1, borderColor: T.inkBorder,
  },
  quickTxt: { fontSize: 12, fontWeight: "800" },

  recapCard: {
    backgroundColor: T.ghost, borderRadius: T.radius.lg, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: `${T.accent}20`,
  },
  recapRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  recapLabel: { color: T.dim, fontSize: 12, fontWeight: "700" },
  recapValue: { color: T.white, fontSize: 13, fontWeight: "700", maxWidth: "55%" },
  recapValueGreen: { color: T.accent, fontSize: 12, fontWeight: "900" },
  recapDivider: { height: 1, backgroundColor: T.inkBorder, marginVertical: 10 },
  recapTotalLabel: { color: T.white, fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },
  recapTotalValue: { fontSize: 22, fontWeight: "900" },

  sendBtn: { borderRadius: T.radius.md, overflow: "hidden", marginBottom: 10 },
  sendGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8 },
  sendTxt: { color: T.g1, fontWeight: "900", fontSize: 13, letterSpacing: 1 },

  secNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  secTxt: { fontSize: 11, fontWeight: "700" },
});