// apps/direct-transfair-mobile/app/agent/withdraw.tsx
// =========================================================
// AGENT WITHDRAW (RETRAIT ESPÈCES) v5.0 — Direct Transf'air
// Design: Thème clair · Violet #6C47FF · Ultra-moderne
// ✅ Vérification code → Détail → Confirmation paiement
// ✅ Montant converti devise cible prioritaire
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
  greenDark:    "#065F46",

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

// ─── Info Row ───────────────────────────────────────────
function InfoRow({ label, value, icon, color = C.violet }: { label: string; value: string; icon: string; color?: string }) {
  return (
    <View style={ir.row}>
      <View style={[ir.iconBox, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon as any} size={15} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ir.lbl, { fontFamily: C.font.sans }]}>{label}</Text>
        <Text style={[ir.val, { fontFamily: C.font.sans }]} numberOfLines={1}>{value || "—"}</Text>
      </View>
    </View>
  );
}
const ir = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  iconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  lbl:     { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 0.8, marginBottom: 2, textTransform: "uppercase" },
  val:     { fontSize: 13, fontWeight: "700", color: C.ink },
});

export default function AgentWithdrawScreen() {
  const router = useRouter();
  const [code,        setCode]        = useState("");
  const [checking,    setChecking]    = useState(false);
  const [paying,      setPaying]      = useState(false);
  const [transaction, setTransaction] = useState<any>(null);
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  const showAlert = (title: string, msg: string, onOk?: () => void) => {
    if (Platform.OS === "web") { setTimeout(() => { window.alert(`${title}\n\n${msg}`); if (onOk) onOk(); }, 100); }
    else Alert.alert(title, msg, [{ text: "OK", onPress: onOk }]);
  };

  const getAmountData = () => {
    if (!transaction) return { val: "0", curr: "XOF" };
    if (toNum(transaction.receivedAmount) > 0) return { val: fmt(toNum(transaction.receivedAmount), transaction.targetCurrency ?? "GNF"), curr: transaction.targetCurrency ?? "GNF" };
    return { val: fmt(toNum(transaction.amount), transaction.currency), curr: transaction.currency ?? "XOF" };
  };

  const handleCheckCode = async () => {
    if (code.trim().length < 6) { showAlert("Erreur", "Le code doit contenir au moins 6 caractères."); return; }
    setChecking(true); setTransaction(null);
    try {
      const res = await api.http.post("/withdrawals/agent/check", { code: code.trim() });
      setTransaction(res.data);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 6 }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Code invalide ou introuvable.";
      showAlert("Code invalide", Array.isArray(msg) ? msg[0] : msg);
    } finally { setChecking(false); }
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
    } finally { setPaying(false); }
  };

  const { val: amtVal, curr: amtCurr } = getAmountData();

  const resetForm = () => { setTransaction(null); setCode(""); fadeAnim.setValue(0); scaleAnim.setValue(0.95); };

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
            <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Retrait Espèces</Text>
            <Text style={[s.heroSub,   { fontFamily: C.font.sans  }]}>
              {transaction ? "Paiement en cours" : "Saisir le code de retrait"}
            </Text>
          </View>
          {transaction ? (
            <TouchableOpacity style={s.backBtn} onPress={resetForm}>
              <Ionicons name="close" size={20} color={C.white} />
            </TouchableOpacity>
          ) : (
            <View style={s.heroBadge}>
              <Ionicons name="arrow-up-circle-outline" size={20} color={C.white} />
            </View>
          )}
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {!transaction ? (
            /* ── SAISIE CODE ── */
            <View style={s.centerBox}>
              {/* Icon décor */}
              <View style={s.qrBox}>
                <Ionicons name="qr-code-outline" size={48} color={C.violet} />
              </View>
              <Text style={[s.qrHint, { fontFamily: C.font.sans }]}>
                Demandez le code de retrait au client et saisissez-le ci-dessous
              </Text>

              <View style={[s.codeWrap, code.trim().length >= 6 && { borderColor: C.violet }]}>
                <TextInput
                  style={[s.codeInput, { fontFamily: C.font.mono }]}
                  value={code} onChangeText={setCode}
                  placeholder="• • • • • •"
                  placeholderTextColor={C.inkSoft}
                  keyboardType="default"
                  autoCapitalize="characters"
                  maxLength={20}
                  textAlign="center"
                />
              </View>

              <TouchableOpacity
                style={[s.cta, (checking || code.trim().length < 6) && { opacity: 0.4 }]}
                onPress={() => void handleCheckCode()}
                disabled={checking || code.trim().length < 6}
                activeOpacity={0.88}
              >
                <View style={s.ctaInner}>
                  {checking
                    ? <ActivityIndicator color={C.white} />
                    : <>
                        <Ionicons name="search-outline" size={18} color={C.white} />
                        <Text style={[s.ctaTxt, { fontFamily: C.font.sans }]}>VÉRIFIER LE CODE</Text>
                      </>
                  }
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── RÉSULTAT ── */
            <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>

              {/* Badge valide */}
              <View style={s.validBadge}>
                <View style={s.validIcon}>
                  <Ionicons name="checkmark-circle" size={18} color={C.green} />
                </View>
                <Text style={[s.validTxt, { fontFamily: C.font.sans }]}>CODE VALIDE — Transaction trouvée</Text>
              </View>

              {/* Montant hero card */}
              <View style={s.amtCard}>
                <Text style={[s.amtLbl, { fontFamily: C.font.sans }]}>MONTANT À REMETTRE AU CLIENT</Text>
                <Text style={[s.amtVal, { fontFamily: C.font.serif }]} numberOfLines={1} adjustsFontSizeToFit>
                  {amtVal}
                </Text>
                <Text style={[s.amtCur, { fontFamily: C.font.mono }]}>{amtCurr}</Text>
                {transaction.receivedAmount && toNum(transaction.receivedAmount) > 0 && transaction.targetCurrency !== transaction.currency && (
                  <View style={s.rateRow}>
                    <Ionicons name="swap-horizontal" size={12} color={C.inkSoft} />
                    <Text style={[s.rateTxt, { fontFamily: C.font.mono }]}>
                      {fmt(toNum(transaction.amount), transaction.currency)} {transaction.currency}
                      {transaction.exchangeRate ? ` · Taux : ${Number(transaction.exchangeRate).toFixed(2)}` : ""}
                    </Text>
                  </View>
                )}
              </View>

              {/* Bénéficiaire */}
              <View style={s.card}>
                <View style={s.secRow}>
                  <View style={[s.secDot, { backgroundColor: C.blue }]} />
                  <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>BÉNÉFICIAIRE · VÉRIFIER PIÈCE D'IDENTITÉ</Text>
                </View>
                <InfoRow label="Nom complet" value={transaction.beneficiary?.fullName || "Non spécifié"} icon="person-outline" color={C.blue} />
                <InfoRow label="Téléphone"   value={transaction.beneficiary?.phone || "—"}               icon="call-outline"   color={C.blue} />
              </View>

              {/* Expéditeur */}
              <View style={s.card}>
                <View style={s.secRow}>
                  <View style={[s.secDot, { backgroundColor: C.violet }]} />
                  <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>EXPÉDITEUR</Text>
                </View>
                <InfoRow label="Nom" value={transaction.senderName || `${transaction.sender?.firstName ?? ""} ${transaction.sender?.lastName ?? ""}`.trim() || "—"} icon="person-circle-outline" color={C.violet} />
                <InfoRow label="Pays d'origine" value={transaction.originCountry || transaction.sender?.country || "—"} icon="flag-outline" color={C.violet} />
                <InfoRow label="Référence"      value={transaction.reference || "—"} icon="document-text-outline" color={C.inkSoft} />
              </View>

              {/* Warning */}
              <View style={s.warning}>
                <Ionicons name="warning-outline" size={16} color={C.amber} />
                <Text style={[s.warningTxt, { fontFamily: C.font.sans }]}>
                  Vérifiez impérativement la pièce d'identité avant de remettre les fonds.
                </Text>
              </View>

              {/* CTA paiement */}
              <TouchableOpacity
                style={[s.payBtn, paying && { opacity: 0.65 }]}
                onPress={handlePayOut} disabled={paying} activeOpacity={0.88}
              >
                <View style={s.payBtnInner}>
                  {paying
                    ? <ActivityIndicator color={C.white} />
                    : <>
                        <Ionicons name="checkmark-circle-outline" size={20} color={C.white} />
                        <Text style={[s.payBtnTxt, { fontFamily: C.font.sans }]}>CONFIRMER — {amtVal} {amtCurr}</Text>
                      </>
                  }
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={s.cancelBtn} onPress={resetForm} disabled={paying}>
                <Text style={[s.cancelTxt, { fontFamily: C.font.sans }]}>Annuler · Nouveau code</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          <View style={{ height: 80 }} />
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

  // Saisie code
  centerBox: { alignItems: "center", paddingTop: 10 },
  qrBox: {
    width: 96, height: 96, borderRadius: 24, marginBottom: 20,
    backgroundColor: C.violetLight, borderWidth: 1.5, borderColor: C.violetBorder,
    justifyContent: "center", alignItems: "center",
  },
  qrHint:   { color: C.inkSoft, fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 24, lineHeight: 19, paddingHorizontal: 10 },
  codeWrap: {
    width: "100%", marginBottom: 22,
    backgroundColor: C.white, borderWidth: 2, borderColor: C.cardBorder,
    borderRadius: C.r.md,
    shadowColor: C.violet, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  codeInput: {
    paddingVertical: 22, paddingHorizontal: 20,
    fontSize: 30, color: C.ink, fontWeight: "900", letterSpacing: 8,
  },

  cta:      { width: "100%", borderRadius: C.r.md, overflow: "hidden" },
  ctaInner: { backgroundColor: C.violet, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8, borderRadius: C.r.md },
  ctaTxt:   { color: C.white, fontWeight: "900", fontSize: 13, letterSpacing: 1 },

  // Résultat
  validBadge: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.greenBg, borderRadius: C.r.md,
    padding: 13, borderWidth: 1, borderColor: C.greenBorder, marginBottom: 14,
  },
  validIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#D1FAE5", justifyContent: "center", alignItems: "center" },
  validTxt:  { color: C.greenDark, fontSize: 11, fontWeight: "800", letterSpacing: 0.3, flex: 1 },

  amtCard: {
    backgroundColor: C.greenBg, borderRadius: C.r.xl,
    padding: 22, marginBottom: 14,
    borderWidth: 1.5, borderColor: C.greenBorder,
  },
  amtLbl: { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" },
  amtVal: { color: C.ink, fontSize: 38, fontWeight: "900", letterSpacing: -0.5 },
  amtCur: { color: C.green, fontSize: 12, fontWeight: "900", marginTop: 4, letterSpacing: 1 },
  rateRow:{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  rateTxt:{ color: C.inkSoft, fontSize: 11, fontWeight: "700" },

  card: {
    backgroundColor: C.white, borderRadius: C.r.lg,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.violet, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  secRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  secDot: { width: 5, height: 5, borderRadius: C.r.pill },
  secLbl: { fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1.2 },

  warning: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: C.amberBg, borderRadius: C.r.md,
    padding: 14, borderWidth: 1, borderColor: C.amberBorder, marginBottom: 16,
  },
  warningTxt: { flex: 1, color: "#92400E", fontSize: 12, fontWeight: "600", lineHeight: 17 },

  payBtn:      { borderRadius: C.r.md, overflow: "hidden", marginBottom: 10 },
  payBtnInner: { backgroundColor: C.green, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8, borderRadius: C.r.md },
  payBtnTxt:   { color: C.white, fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },

  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelTxt: { color: C.inkSoft, fontWeight: "800", fontSize: 14 },
});