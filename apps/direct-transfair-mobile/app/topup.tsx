// apps/direct-transfair-mobile/app/topup.tsx
// =========================================================
// TOP-UP SCREEN v5.0 — Direct Transf'air
// Design: Thème clair · Vert #059669 · Style YMO/Wise
// ✅ Carte bancaire + Orange Money · Quick amounts
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

  blue:         "#3B82F6",
  blueBg:       "#EFF6FF",
  blueBorder:   "#BFDBFE",
  blueDark:     "#1D4ED8",

  orange:       "#F97316",
  orangeBg:     "#FFF7ED",
  orangeBorder: "#FED7AA",

  amber:        "#F59E0B",
  red:          "#EF4444",

  r: { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 99 },
  font: {
    serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    sans:  Platform.select({ ios: "Avenir Next", android: "sans-serif-medium", default: "sans-serif" }),
    mono:  Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" }),
  },
};

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500];

function fmt(n: number): string {
  try { return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n); }
  catch { return n.toString(); }
}

// ─── Field ──────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, keyboardType, secureTextEntry, maxLength, style }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; secureTextEntry?: boolean; maxLength?: number; style?: any;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      <Text style={[f.lbl, { fontFamily: C.font.sans }]}>{label}</Text>
      <View style={[f.box, focused && { borderColor: C.blue }]}>
        <TextInput
          style={[f.input, { fontFamily: C.font.sans }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.inkSoft}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          underlineColorAndroid="transparent"
        />
      </View>
    </View>
  );
}
const f = StyleSheet.create({
  lbl:   { fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  box:   { backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md },
  input: { paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: C.ink, fontWeight: "600" },
});

// ─── Method Tab ─────────────────────────────────────────
function MethodTab({ icon, label, active, accent, bg, border, onPress }: {
  icon: React.ReactNode; label: string; active: boolean;
  accent: string; bg: string; border: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        style={[mt.tab, active && { backgroundColor: bg, borderColor: border }]}
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      >
        {icon}
        <Text style={[mt.lbl, { color: active ? accent : C.inkSoft, fontFamily: C.font.sans }]}>{label}</Text>
        {active && <View style={[mt.dot, { backgroundColor: accent }]} />}
      </TouchableOpacity>
    </Animated.View>
  );
}
const mt = StyleSheet.create({
  tab: { alignItems: "center", paddingVertical: 16, borderRadius: C.r.lg, gap: 8, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.cardBorder, position: "relative", shadowColor: C.green, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  lbl: { fontSize: 12, fontWeight: "800" },
  dot: { position: "absolute", top: 10, right: 10, width: 6, height: 6, borderRadius: C.r.pill },
});

export default function TopUpScreen() {
  const router  = useRouter();
  const { user, refreshUser } = useAuth();

  const [amount,     setAmount]     = useState("50");
  const [loading,    setLoading]    = useState(false);
  const [method,     setMethod]     = useState<"CARD" | "OM">("CARD");
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc,    setCardCvc]    = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  const headerAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 4 }).start();
  }, []);

  const numAmount = parseFloat(amount) || 0;
  const canPay = numAmount >= 1 && (
    method === "CARD"
      ? cardHolder.trim().length >= 2 && cardNumber.length >= 16 && cardExpiry.length >= 4 && cardCvc.length >= 3
      : mobileNumber.length >= 9
  );

  const handleClose = () => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/home"); };

  const handleTopUp = () => {
    if (!canPay) { Alert.alert("Données manquantes", "Veuillez compléter tous les champs."); return; }
    const label = method === "CARD" ? "par carte" : "par Orange Money";
    Alert.alert("Confirmation", `Recharger ${fmt(numAmount)} EUR ${label} ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "PAYER", onPress: () => void processPayment() },
    ]);
  };

  const processPayment = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const cur = user?.balance ? Number(user.balance) : 0;
      await api.updateProfile({ balance: cur + numAmount } as any);
      await refreshUser();
      Alert.alert("✅ Paiement réussi", `Votre compte a été crédité de ${fmt(numAmount)} EUR.`, [{ text: "Super", onPress: handleClose }]);
    } catch {
      Alert.alert("Erreur", "Le rechargement a échoué. Réessayez.");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.green} />

      {/* ── Hero ── */}
      <Animated.View style={[s.hero, {
        opacity: headerAnim,
        transform: [{ scale: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
      }]}>
        <View style={s.glow} />
        <View style={s.heroRow}>
          <TouchableOpacity style={s.closeBtn} onPress={handleClose} hitSlop={12}>
            <Ionicons name="close" size={20} color={C.white} />
          </TouchableOpacity>
          <Text style={[s.heroTitle, { fontFamily: C.font.serif }]}>Recharger le Compte</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Montant affiché dans le hero */}
        <View style={s.heroAmtBox}>
          <Text style={[s.heroAmtLabel, { fontFamily: C.font.sans }]}>MONTANT SÉLECTIONNÉ</Text>
          <Text style={[s.heroAmt, { fontFamily: C.font.serif }]}>{fmt(numAmount)} <Text style={s.heroAmtCur}>EUR</Text></Text>
        </View>
      </Animated.View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── Montant ── */}
          <View style={s.card}>
            <View style={s.secRow}>
              <View style={[s.secDot, { backgroundColor: C.green }]} />
              <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>MONTANT À AJOUTER</Text>
            </View>

            <View style={[s.amtBox, numAmount > 0 && { borderColor: C.green }]}>
              <TextInput
                style={[s.amtInput, { fontFamily: C.font.serif }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={C.inkSoft}
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
                    <Text style={[s.quickTxt, { color: active ? C.green : C.inkSoft, fontFamily: C.font.mono }]}>{v}€</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Méthode ── */}
          <View style={s.card}>
            <View style={s.secRow}>
              <View style={[s.secDot, { backgroundColor: C.blue }]} />
              <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>MOYEN DE PAIEMENT</Text>
            </View>
            <View style={s.methodsRow}>
              <MethodTab
                icon={<Ionicons name="card" size={24} color={method === "CARD" ? C.blue : C.inkSoft} />}
                label="Carte"
                active={method === "CARD"}
                accent={C.blue} bg={C.blueBg} border={C.blueBorder}
                onPress={() => setMethod("CARD")}
              />
              <MethodTab
                icon={<Ionicons name="phone-portrait-outline" size={24} color={method === "OM" ? C.orange : C.inkSoft} />}
                label="Orange Money"
                active={method === "OM"}
                accent={C.orange} bg={C.orangeBg} border={C.orangeBorder}
                onPress={() => setMethod("OM")}
              />
            </View>
          </View>

          {/* ── Formulaire ── */}
          <View style={s.card}>
            {method === "CARD" ? (
              <>
                <View style={s.secRow}>
                  <View style={[s.secDot, { backgroundColor: C.blue }]} />
                  <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>DÉTAILS DE LA CARTE</Text>
                </View>

                {/* Card visuel */}
                <View style={[s.cardVisual, { backgroundColor: C.blueDark }]}>
                  <View style={s.cardVisualTop}>
                    <Ionicons name="card-outline" size={22} color="rgba(255,255,255,0.7)" />
                    <View style={s.cardChip} />
                  </View>
                  <Text style={[s.cardVisualNumber, { fontFamily: C.font.mono }]}>
                    {cardNumber.length > 0
                      ? cardNumber.replace(/(.{4})/g, "$1 ").trim()
                      : "•••• •••• •••• ••••"}
                  </Text>
                  <View style={s.cardVisualBottom}>
                    <Text style={[s.cardVisualName, { fontFamily: C.font.sans }]}>
                      {cardHolder || "NOM DU TITULAIRE"}
                    </Text>
                    <Text style={[s.cardVisualExp, { fontFamily: C.font.mono }]}>
                      {cardExpiry || "MM/AA"}
                    </Text>
                  </View>
                </View>

                <Field label="Nom du titulaire" value={cardHolder} onChange={setCardHolder} placeholder="Jean DUPONT" />
                <Field label="Numéro de carte" value={cardNumber} onChange={setCardNumber} placeholder="0000 0000 0000 0000" keyboardType="numeric" maxLength={16} />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Field label="Expiration" value={cardExpiry} onChange={setCardExpiry} placeholder="MM/AA" keyboardType="numeric" maxLength={5} style={{ flex: 1 }} />
                  <Field label="CVV" value={cardCvc} onChange={setCardCvc} placeholder="•••" keyboardType="numeric" maxLength={3} secureTextEntry style={{ flex: 1 }} />
                </View>

                <View style={s.secureNote}>
                  <Ionicons name="lock-closed-outline" size={12} color={C.blue} />
                  <Text style={[s.secureNoteTxt, { fontFamily: C.font.sans }]}>Paiement sécurisé · 3D Secure</Text>
                </View>
              </>
            ) : (
              <>
                <View style={s.secRow}>
                  <View style={[s.secDot, { backgroundColor: C.orange }]} />
                  <Text style={[s.secLbl, { fontFamily: C.font.sans }]}>NUMÉRO ORANGE MONEY</Text>
                </View>

                <View style={s.omRow}>
                  <View style={s.omFlag}>
                    <Text style={{ fontSize: 20 }}>🇸🇳</Text>
                    <Text style={[s.omDial, { fontFamily: C.font.mono }]}>+221</Text>
                    <Ionicons name="chevron-down" size={11} color={C.inkSoft} />
                  </View>
                  <View style={[f.box, { flex: 1 }]}>
                    <TextInput
                      style={[f.input, { fontFamily: C.font.sans }]}
                      value={mobileNumber}
                      onChangeText={setMobileNumber}
                      placeholder="77 000 00 00"
                      placeholderTextColor={C.inkSoft}
                      keyboardType="phone-pad"
                      underlineColorAndroid="transparent"
                    />
                  </View>
                </View>

                <View style={s.omInfo}>
                  <Ionicons name="information-circle-outline" size={14} color={C.orange} />
                  <Text style={[s.omInfoTxt, { fontFamily: C.font.sans }]}>
                    Vous recevrez un SMS pour valider le paiement Orange Money.
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* ── CTA ── */}
          <TouchableOpacity
            style={[s.cta, (!canPay || loading) && { opacity: 0.4 }]}
            onPress={handleTopUp}
            disabled={!canPay || loading}
            activeOpacity={0.88}
          >
            <View style={[s.ctaInner, { backgroundColor: method === "CARD" ? C.blue : C.orange }]}>
              {loading
                ? <ActivityIndicator color={C.white} />
                : <>
                    <Ionicons name={method === "CARD" ? "card-outline" : "phone-portrait-outline"} size={18} color={C.white} />
                    <Text style={[s.ctaTxt, { fontFamily: C.font.sans }]}>
                      PAYER {numAmount > 0 ? `${fmt(numAmount)} EUR` : ""} {method === "CARD" ? "PAR CARTE" : "PAR OM"}
                    </Text>
                  </>
              }
            </View>
          </TouchableOpacity>

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
  glow:     { position: "absolute", width: 160, height: 160, borderRadius: 80, backgroundColor: C.heroGlow, top: -60, right: -40 },
  heroRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  closeBtn: { width: 38, height: 38, borderRadius: C.r.sm, backgroundColor: C.heroGlass, borderWidth: 1, borderColor: C.heroGlassBdr, justifyContent: "center", alignItems: "center" },
  heroTitle:{ color: C.white, fontSize: 18, fontWeight: "700" },

  heroAmtBox:   { backgroundColor: C.white, borderRadius: C.r.xl, padding: 20, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  heroAmtLabel: { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 4, textTransform: "uppercase" },
  heroAmt:      { fontSize: 34, fontWeight: "800", color: C.ink, letterSpacing: -0.5 },
  heroAmtCur:   { fontSize: 16, fontWeight: "800", color: C.green },

  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  card: { backgroundColor: C.white, borderRadius: C.r.lg, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.cardBorder, shadowColor: C.green, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  secRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  secDot: { width: 5, height: 5, borderRadius: C.r.pill },
  secLbl: { fontSize: 10, fontWeight: "900", color: C.inkMid, letterSpacing: 1.5 },

  amtBox: { flexDirection: "row", alignItems: "center", backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, overflow: "hidden", marginBottom: 16 },
  amtInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 30, color: C.ink, fontWeight: "800" },
  curBox:   { paddingHorizontal: 14, paddingVertical: 14, backgroundColor: C.greenPale, borderLeftWidth: 1, borderLeftColor: C.greenBorder },
  curTxt:   { color: C.green, fontSize: 12, fontWeight: "900", letterSpacing: 1 },

  quickLbl:  { fontSize: 9, fontWeight: "900", color: C.inkSoft, letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" },
  quickRow:  { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: C.r.md, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder },
  quickTxt:  { fontSize: 12, fontWeight: "800" },

  methodsRow: { flexDirection: "row", gap: 12 },

  // Card visuel
  cardVisual:       { borderRadius: C.r.lg, padding: 20, marginBottom: 16, height: 120, justifyContent: "space-between" },
  cardVisualTop:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardChip:         { width: 32, height: 24, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.25)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  cardVisualNumber: { color: C.white, fontSize: 16, fontWeight: "700", letterSpacing: 2 },
  cardVisualBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardVisualName:   { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  cardVisualExp:    { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700" },

  secureNote:    { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  secureNoteTxt: { color: C.blue, fontSize: 11, fontWeight: "600" },

  omRow:  { flexDirection: "row", gap: 10, marginBottom: 12 },
  omFlag: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: C.r.md, paddingHorizontal: 12, paddingVertical: 13 },
  omDial: { color: C.ink, fontSize: 13, fontWeight: "800" },
  omInfo: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: C.orangeBg, borderRadius: C.r.sm, padding: 12, borderWidth: 1, borderColor: C.orangeBorder },
  omInfoTxt: { flex: 1, color: C.orange, fontSize: 11, fontWeight: "600", lineHeight: 16 },

  cta:      { borderRadius: C.r.md, overflow: "hidden", marginBottom: 10 },
  ctaInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8, borderRadius: C.r.md },
  ctaTxt:   { color: C.white, fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
});