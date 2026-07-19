// apps/direct-transfair-mobile/app/agent/remit-to-admin.tsx
// =========================================================
// AGENT REMIT TO ADMIN v1.0 — Direct Transf'air
// Fichier indépendant — nouvel écran, ne modifie aucun écran agent
// existant (send-cash, deposit, withdraw, commissions restent
// strictement inchangés).
//
// Formulaire agent : montant + libellé, pas de sélection de devise
// (une agence = une devise) ni d'agence (toujours celle de l'agent
// connecté). Appelle api.agentRemitToAdmin() → POST
// /transactions/agency/remit (backend : agency-treasury.controller.ts).
//
// Même traitement de héro (dégradé sombre heroFrom → heroTo) que le
// Client Dashboard / beneficiaries/create.tsx v6.5 / send.tsx v2.14,
// pour rester cohérent avec le reste de l'app.
// =========================================================

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
  ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, StatusBar, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../services/api";
import { useAuth } from "../../providers/AuthProvider";

const C = {
  blue: "#2563EB",
  bluePale: "#EFF6FF",
  blueBorder: "#BFDBFE",
  heroFrom: "#0A0F0D",
  heroTo: "#123324",
  heroGlass: "rgba(255,255,255,0.08)",
  heroGlassBdr: "rgba(255,255,255,0.14)",
  heroDim: "rgba(255,255,255,0.65)",
  heroGlow: "rgba(23,164,95,0.16)",
  pageBg: "#FAFAFA",
  white: "#FFFFFF",
  cardBorder: "#E5E5EA",
  inputBg: "#F8F8F8",
  ink: "#0D2B1F",
  inkMid: "#1F5C3A",
  inkSoft: "#6B9E85",
  red: "#EF4444",
  r: { sm: 12, md: 14, lg: 18, xl: 24, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans: Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono: Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

function fmt(n: number, currency: string): string {
  const d = currency === "GNF" || currency === "XOF" ? 0 : 2;
  try { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
  catch { return n.toFixed(d); }
}

export default function RemitToAdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const agencyName = (user as any)?.agency?.name ?? "Mon agence";
  const currency = (user as any)?.agency?.primaryCurrency ?? (user as any)?.primaryCurrency ?? "XOF";
  const numericAmount = parseFloat(amount.replace(/\s/g, "").replace(",", ".")) || 0;
  const canSubmit = numericAmount > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.agentRemitToAdmin(numericAmount, note.trim() || undefined);
      Alert.alert(
        "✅ Envoyé",
        `${fmt(numericAmount, currency)} ${currency} envoyés vers le compte de la société.`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Une erreur est survenue.";
      Alert.alert("Erreur", Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.heroFrom} />

      <LinearGradient
        colors={[C.heroFrom, C.heroTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingTop: insets.top + 8 }]}
      >
        <View style={s.glow} pointerEvents="none" />
        <View style={s.heroRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={18} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Envoyer vers Admin</Text>
            <Text style={[s.heroSub, { fontFamily: C.font.sans }]}>Remontée de fonds — {agencyName}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={s.sheet}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <View style={s.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color={C.blue} />
              <Text style={[s.infoTxt, { fontFamily: C.font.sans }]}>
                Ce montant sera débité du solde de votre agence ({agencyName}) et crédité sur le compte de la société.
              </Text>
            </View>

            <View style={s.secRow}>
              <View style={s.secDot} />
              <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>MONTANT</Text>
            </View>
            <View style={s.card}>
              <View style={s.amountRow}>
                <TextInput
                  style={[s.amountInput, { fontFamily: C.font.serif }]}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={C.inkSoft}
                  editable={!submitting}
                />
                <View style={s.currBadge}>
                  <Text style={[s.currTxt, { fontFamily: C.font.sans }]}>{currency}</Text>
                </View>
              </View>
            </View>

            <View style={s.secRow}>
              <View style={s.secDot} />
              <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>LIBELLÉ <Text style={{ color: C.inkSoft, fontSize: 8 }}>(optionnel)</Text></Text>
            </View>
            <View style={s.card}>
              <TextInput
                style={[s.noteInput, { fontFamily: C.font.sans }]}
                value={note}
                onChangeText={setNote}
                placeholder="Ex : Remontée de caisse hebdomadaire"
                placeholderTextColor={C.inkSoft}
                multiline
                editable={!submitting}
              />
            </View>

            <TouchableOpacity
              style={[s.cta, !canSubmit && { opacity: 0.4 }]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.88}
            >
              {submitting ? <ActivityIndicator color={C.white} /> : (
                <>
                  <Ionicons name="paper-plane-outline" size={17} color={C.white} />
                  <Text style={[s.ctaTxt, { fontFamily: C.font.sans }]}>ENVOYER VERS ADMIN</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 60 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.heroFrom },

  hero: {
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    paddingHorizontal: 18, paddingBottom: 44, overflow: "hidden",
  },
  glow: { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: C.heroGlow, top: -55, right: -35 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 34, height: 34, borderRadius: C.r.sm, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center" },
  heroTitle: { color: C.white, fontSize: 20, fontWeight: "700" },
  heroSub: { color: C.heroDim, fontSize: 11, fontWeight: "600", marginTop: 2 },

  sheet: { flex: 1, backgroundColor: C.pageBg, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28, overflow: "hidden" },
  scroll: { paddingHorizontal: 16, paddingTop: 20 },

  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: C.bluePale, borderWidth: 1, borderColor: C.blueBorder, borderRadius: C.r.md, padding: 14, marginBottom: 18 },
  infoTxt: { flex: 1, fontSize: 12, color: "#1E40AF", fontWeight: "600", lineHeight: 18 },

  secRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  secDot: { width: 4, height: 4, borderRadius: C.r.pill, backgroundColor: C.blue },
  secLbl: { fontSize: 9, fontWeight: "900", color: C.inkMid, letterSpacing: 1.2 },

  card: {
    backgroundColor: C.white, borderRadius: C.r.lg, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },

  amountRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  amountInput: { flex: 1, fontSize: 26, color: C.ink, letterSpacing: -0.5 },
  currBadge: { backgroundColor: C.bluePale, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  currTxt: { fontSize: 13, fontWeight: "900", color: C.blue, letterSpacing: 0.5 },

  noteInput: { fontSize: 14, color: C.ink, minHeight: 44, textAlignVertical: "top" },

  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: C.blue, borderRadius: C.r.md, paddingVertical: 16, marginTop: 8,
    ...Platform.select({
      ios: { shadowColor: C.blue, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 5 },
    }),
  },
  ctaTxt: { color: C.white, fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
});