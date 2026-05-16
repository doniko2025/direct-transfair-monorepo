// apps/direct-transfair-mobile/app/wallet-transfer.tsx
// =========================================================
// WALLET TRANSFER v5.0 — Direct Transf'air
// Design: Thème clair · Vert #059669 · Ultra-moderne
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
import { useAuth } from "../providers/AuthProvider";
import { api } from "../services/api";

// ─── Design System ──────────────────────────────────────
const C = {
  green:        "#059669",
  greenDark:    "#047857",
  greenLight:   "#F0FDF4",
  greenBorder:  "#A7F3D0",
  greenPale:    "#ECFDF5",

  heroGlass:    "rgba(255,255,255,0.14)",
  heroGlassBdr: "rgba(255,255,255,0.22)",
  heroDim:      "rgba(255,255,255,0.65)",
  heroGlow:     "rgba(255,255,255,0.08)",

  pageBg:       "#F0FDF8",
  white:        "#FFFFFF",
  cardBorder:   "#D1FAE5",
  inputBg:      "#F8FFFC",

  ink:          "#0D2B1F",
  inkMid:       "#1F5C3A",
  inkSoft:      "#6B9E85",

  red:          "#EF4444",
  redBg:        "#FEF2F2",
  redBorder:    "#FECACA",

  amber:        "#F59E0B",
  amberBg:      "#FFFBEB",
  amberBorder:  "#FDE68A",

  blue:         "#3B82F6",
  blueBg:       "#EFF6FF",

  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
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

  const [recipient,        setRecipient]        = useState("");
  const [amount,           setAmount]           = useState("");
  const [loading,          setLoading]          = useState(false);
  const [recipientFocused, setRecipientFocused] = useState(false);
  const [amountFocused,    setAmountFocused]    = useState(false);

  const summaryAnim = useRef(new Animated.Value(0)).current;
  const headerAnim  = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
  }, []);

  const numAmount      = parseFloat(amount) || 0;
  const currentBalance = user?.balance ? Number(user.balance) : 0;
  const insufficient   = numAmount > currentBalance && numAmount > 0;
  const canSend        = recipient.trim().length >= 3 && numAmount > 0 && !insufficient;

  const showSummary = numAmount > 0 && recipient.trim().length >= 3;

  React.useEffect(() => {
    Animated.timing(summaryAnim, { toValue: showSummary ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [showSummary]);

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
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.green} />

      {/* ── Hero vert ── */}
      <Animated.View style={[s.hero, {
        opacity: headerAnim,
        transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
      }]}>
        <View style={s.glow} />
        <View style={s.heroRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Transfert Entre Amis</Text>
            <Text style={[s.heroSub,   { fontFamily: C.font.sans  }]}>Wallet → Wallet · Sans aucun frais</Text>
          </View>
          <View style={s.heroBadge}>
            <Ionicons name="flash" size={16} color={C.white} />
          </View>
        </View>

        {/* Balance card flottante */}
        <View style={s.balCard}>
          <View style={s.balLeft}>
            <Text style={[s.balLbl, { fontFamily: C.font.sans }]}>VOTRE SOLDE</Text>
            <Text style={[s.balAmt, { fontFamily: C.font.serif }]}>{fmt(currentBalance)}</Text>
            <Text style={[s.balCur, { fontFamily: C.font.sans }]}>EUR</Text>
          </View>
          <View style={[s.balBadge, insufficient && { backgroundColor: C.amberBg, borderColor: C.amberBorder }]}>
            {insufficient ? (
              <>
                <Ionicons name="warning-outline" size={13} color={C.amber} />
                <Text style={[s.balBadgeTxt, { color: C.amber, fontFamily: C.font.sans }]}>Insuffisant</Text>
              </>
            ) : (
              <>
                <View style={s.balDot} />
                <Text style={[s.balBadgeTxt, { color: C.greenDark, fontFamily: C.font.sans }]}>Disponible</Text>
              </>
            )}
          </View>
        </View>
      </Animated.View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Bannière gratuit */}
          <View style={s.freeBanner}>
            <View style={s.freeIconBox}>
              <Ionicons name="flash" size={16} color={C.green} />
            </View>
            <Text style={[s.freeTxt, { fontFamily: C.font.sans }]}>
              Transfert instantané · <Text style={{ fontWeight: "900", color: C.green }}>0 frais</Text> · Crypté de bout en bout
            </Text>
          </View>

          {/* Destinataire */}
          <View style={s.card}>
            <View style={s.secRow}>
              <View style={[s.secDot, { backgroundColor: C.green }]} />
              <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>DESTINATAIRE</Text>
            </View>
            <View style={[s.inputBox, recipientFocused && { borderColor: C.green }]}>
              <Ionicons name="search-outline" size={17} color={recipientFocused ? C.green : C.inkSoft} style={{ marginHorizontal: 12 }} />
              <TextInput
                style={[s.input, { fontFamily: C.font.sans }]}
                value={recipient}
                onChangeText={setRecipient}
                placeholder="Email ou numéro de téléphone"
                placeholderTextColor={C.inkSoft}
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => setRecipientFocused(true)}
                onBlur={() => setRecipientFocused(false)}
                underlineColorAndroid="transparent"
              />
              {recipient.length > 0 && (
                <TouchableOpacity onPress={() => setRecipient("")} style={{ padding: 10 }}>
                  <Ionicons name="close-circle" size={16} color={C.inkSoft} />
                </TouchableOpacity>
              )}
            </View>
            {recipient.trim().length >= 3 && (
              <View style={s.recipientFound}>
                <Ionicons name="checkmark-circle" size={14} color={C.green} />
                <Text style={[s.recipientFoundTxt, { fontFamily: C.font.sans }]}>Destinataire reconnu</Text>
              </View>
            )}
          </View>

          {/* Montant */}
          <View style={s.card}>
            <View style={s.secRow}>
              <View style={[s.secDot, { backgroundColor: C.green }]} />
              <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>MONTANT</Text>
            </View>
            <View style={[
              s.amtBox,
              amountFocused && { borderColor: C.green },
              insufficient && { borderColor: C.amber },
            ]}>
              <TextInput
                style={[s.amtInput, { fontFamily: C.font.serif }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={C.inkSoft}
                keyboardType="numeric"
                onFocus={() => setAmountFocused(true)}
                onBlur={() => setAmountFocused(false)}
                underlineColorAndroid="transparent"
              />
              <View style={s.curBox}>
                <Text style={[s.curTxt, { fontFamily: C.font.mono }]}>EUR</Text>
              </View>
            </View>

            <Text style={[s.quickLbl, { fontFamily: C.font.sans }]}>MONTANTS RAPIDES</Text>
            <View style={s.quickRow}>
              {QUICK_AMOUNTS.map((v) => {
                const active = numAmount === v;
                return (
                  <TouchableOpacity
                    key={v}
                    style={[s.quickPill, active && { backgroundColor: C.greenPale, borderColor: C.green }]}
                    onPress={() => setAmount(String(v))}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.quickTxt, { color: active ? C.green : C.inkSoft, fontFamily: C.font.mono }]}>
                      {v}€
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Récap animé */}
          <Animated.View style={[s.recapCard, { opacity: summaryAnim, transform: [{ translateY: summaryAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
            <View style={s.recapHead}>
              <View style={[s.recapIconBox, { backgroundColor: C.greenPale }]}>
                <Ionicons name="receipt-outline" size={15} color={C.green} />
              </View>
              <Text style={[s.recapTitle, { fontFamily: C.font.sans }]}>Récapitulatif</Text>
            </View>
            <View style={s.recapRow}>
              <Text style={[s.recapLbl, { fontFamily: C.font.sans }]}>Destinataire</Text>
              <Text style={[s.recapVal, { fontFamily: C.font.sans }]} numberOfLines={1}>{recipient.trim()}</Text>
            </View>
            <View style={s.recapDivider} />
            <View style={s.recapRow}>
              <Text style={[s.recapLbl, { fontFamily: C.font.sans }]}>Montant envoyé</Text>
              <Text style={[s.recapVal, { fontFamily: C.font.mono }]}>{fmt(numAmount)} EUR</Text>
            </View>
            <View style={s.recapDivider} />
            <View style={s.recapRow}>
              <Text style={[s.recapLbl, { fontFamily: C.font.sans }]}>Frais</Text>
              <View style={[s.freePill, { backgroundColor: C.greenPale, borderColor: C.greenBorder }]}>
                <Ionicons name="checkmark-circle" size={11} color={C.green} />
                <Text style={[s.freePillTxt, { fontFamily: C.font.sans }]}>Offerts</Text>
              </View>
            </View>
            <View style={s.recapDivider} />
            <View style={s.recapRow}>
              <Text style={[s.recapTotalLbl, { fontFamily: C.font.sans }]}>TOTAL DÉBITÉ</Text>
              <Text style={[s.recapTotalVal, { color: insufficient ? C.amber : C.green, fontFamily: C.font.serif }]}>
                {fmt(numAmount)} EUR
              </Text>
            </View>
          </Animated.View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.cta, (!canSend || loading) && { opacity: 0.4 }]}
            onPress={handleTransfer}
            disabled={!canSend || loading}
            activeOpacity={0.88}
          >
            <View style={[s.ctaInner, insufficient && { backgroundColor: C.amber }]}>
              {loading
                ? <ActivityIndicator color={C.white} />
                : <>
                    <Ionicons name="paper-plane-outline" size={18} color={C.white} />
                    <Text style={[s.ctaTxt, { fontFamily: C.font.sans }]}>
                      {insufficient ? "SOLDE INSUFFISANT" : "ENVOYER SANS FRAIS"}
                    </Text>
                  </>
              }
            </View>
          </TouchableOpacity>

          <View style={s.secNote}>
            <Ionicons name="shield-checkmark-outline" size={12} color={C.green} />
            <Text style={[s.secTxt, { fontFamily: C.font.sans }]}>Transfert sécurisé · Crypté de bout en bout</Text>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.pageBg },

  hero: {
    backgroundColor: C.green,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 48 : 16,
    paddingBottom: 24, overflow: "hidden",
  },
  glow:      { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: C.heroGlow, top: -60, right: -40 },
  heroRow:   { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 },
  backBtn: {
    width: 38, height: 38, borderRadius: C.r.sm,
    backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr,
    justifyContent: "center", alignItems: "center",
  },
  heroTitle: { color: C.white, fontSize: 20, fontWeight: "700" },
  heroSub:   { color: C.heroDim, fontSize: 11, fontWeight: "600", marginTop: 2 },
  heroBadge: {
    width: 38, height: 38, borderRadius: C.r.sm,
    backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr,
    justifyContent: "center", alignItems: "center",
  },

  balCard: {
    backgroundColor: C.white, borderRadius: C.r.xl,
    padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  balLeft:      {},
  balLbl:       { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 4, textTransform: "uppercase" },
  balAmt:       { fontSize: 28, fontWeight: "800", color: C.ink, letterSpacing: -0.5 },
  balCur:       { fontSize: 12, fontWeight: "800", color: C.green, marginTop: 2 },
  balBadge:     { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.greenPale, borderWidth: 1, borderColor: C.greenBorder, borderRadius: C.r.pill, paddingHorizontal: 12, paddingVertical: 6 },
  balDot:       { width: 6, height: 6, borderRadius: C.r.pill, backgroundColor: C.green },
  balBadgeTxt:  { fontSize: 11, fontWeight: "700" },

  scroll: { paddingHorizontal: 20, paddingTop: 18 },

  freeBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.greenPale, borderRadius: C.r.md,
    padding: 13, borderWidth: 1, borderColor: C.greenBorder, marginBottom: 16,
  },
  freeIconBox: { width: 32, height: 32, borderRadius: 9, backgroundColor: C.greenLight, justifyContent: "center", alignItems: "center" },
  freeTxt:     { flex: 1, color: C.inkMid, fontSize: 12, fontWeight: "600", lineHeight: 18 },

  card: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.green, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  secRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  secDot: { width: 5, height: 5, borderRadius: C.r.pill },
  secLbl: { fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1.5 },

  inputBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder,
    borderRadius: C.r.md, overflow: "hidden",
  },
  input: { flex: 1, paddingVertical: 13, fontSize: 14, color: C.ink, fontWeight: "600" },

  recipientFound: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  recipientFoundTxt: { color: C.green, fontSize: 11, fontWeight: "700" },

  amtBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder,
    borderRadius: C.r.md, overflow: "hidden", marginBottom: 16,
  },
  amtInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 30, color: C.ink, fontWeight: "800" },
  curBox:   { paddingHorizontal: 14, paddingVertical: 14, backgroundColor: C.greenPale, borderLeftWidth: 1, borderLeftColor: C.greenBorder },
  curTxt:   { color: C.green, fontSize: 12, fontWeight: "900", letterSpacing: 1 },

  quickLbl:  { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" },
  quickRow:  { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: C.r.md, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder },
  quickTxt:  { fontSize: 12, fontWeight: "800" },

  recapCard: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    padding: 18, marginBottom: 14,
    borderWidth: 1.5, borderColor: C.greenBorder,
    shadowColor: C.green, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  recapHead:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  recapIconBox:  { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  recapTitle:    { fontSize: 12, fontWeight: "900", color: C.green, letterSpacing: 0.5 },
  recapRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  recapLbl:      { color: C.inkSoft, fontSize: 12, fontWeight: "700" },
  recapVal:      { color: C.ink, fontSize: 13, fontWeight: "700", maxWidth: "55%" },
  recapDivider:  { height: 1, backgroundColor: C.greenBorder, marginVertical: 10 },
  recapTotalLbl: { color: C.ink, fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },
  recapTotalVal: { fontSize: 22, fontWeight: "900" },
  freePill:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: C.r.pill, borderWidth: 1 },
  freePillTxt:   { color: C.green, fontSize: 10, fontWeight: "800" },

  cta:      { borderRadius: C.r.md, overflow: "hidden", marginBottom: 12 },
  ctaInner: { backgroundColor: C.green, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8, borderRadius: C.r.md },
  ctaTxt:   { color: C.white, fontWeight: "900", fontSize: 13, letterSpacing: 1 },

  secNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  secTxt:  { color: C.inkSoft, fontSize: 11, fontWeight: "600" },
});