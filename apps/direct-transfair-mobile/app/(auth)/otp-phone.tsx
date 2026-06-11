// apps/direct-transfair-mobile/app/(auth)/otp-phone.tsx
// =========================================================
// CONNEXION PAR TÉLÉPHONE (OTP 4 chiffres) v1.0
// ✅ Étape 1 : saisie du numéro + envoi du code par SMS
// ✅ Étape 2 : saisie du code OTP (4 cases séparées)
// ✅ Isolation tenant via le service api (header x-tenant-id)
// ✅ Minuteur de renvoi (60 secondes)
// ✅ Design cohérent avec login.tsx (même palette, même card)
// ✅ Compatibilité Android / iOS / Web
// =========================================================

import React, {
  useState, useRef, useEffect, useMemo, useCallback,
} from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../providers/AuthProvider";
import { useTenant } from "../../providers/TenantProvider";
import { api } from "../../services/api";

// ─── Polices ─────────────────────────────────────────────
const F = {
  display: Platform.select({ ios: "Georgia",  android: "serif",      default: "serif" }),
  body:    Platform.select({ ios: "System",   android: "sans-serif", default: "sans-serif" }),
};

// ─── Construction de la palette depuis la couleur primaire ─
function hexToRgb(hex: string): [number, number, number] | null {
  const c = hex.replace("#", "");
  if (c.length !== 6) return null;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return isNaN(r + g + b) ? null : [r, g, b];
}
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
}
function darken(hex: string, f: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return toHex(rgb[0] * (1 - f), rgb[1] * (1 - f), rgb[2] * (1 - f));
}
function lighten(hex: string, f: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return toHex(
    rgb[0] + (255 - rgb[0]) * f,
    rgb[1] + (255 - rgb[1]) * f,
    rgb[2] + (255 - rgb[2]) * f,
  );
}
function buildTheme(primary: string) {
  const p = /^#[0-9A-Fa-f]{6}$/.test(primary) ? primary : "#059669";
  return {
    g1: darken(p, 0.85),
    g2: darken(p, 0.70),
    g3: darken(p, 0.45),
    g4: p,
    g5: lighten(p, 0.30),
  };
}

// ─── Durée du minuteur de renvoi ─────────────────────────
const RESEND_DELAY_SECONDS = 60;

// ─── Écran principal ─────────────────────────────────────
export default function OtpPhoneScreen() {
  const { loginWithPhoneOtp, isLoading } = useAuth();
  const { branding }                     = useTenant();
  const router                           = useRouter();

  const C = useMemo(() => buildTheme(branding.primaryColor), [branding.primaryColor]);

  // ── États globaux ──
  const [step, setStep] = useState<"phone" | "verify">("phone");

  // ── Étape 1 : numéro de téléphone ──
  const [phone,        setPhone]        = useState("");
  const [phoneSending, setPhoneSending] = useState(false);

  // ── Étape 2 : code OTP + données récupérées à l'étape 1 ──
  const [userId,      setUserId]      = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [otpValues,   setOtpValues]   = useState(["", "", "", ""]);
  const [verifying,   setVerifying]   = useState(false);

  // ── Minuteur de renvoi ──
  const [resendCountdown, setResendCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Nettoyage du minuteur au démontage
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setResendCountdown(RESEND_DELAY_SECONDS);
    timerRef.current = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Refs pour les 4 cases OTP ──
  // (déclarées individuellement pour respecter les règles des hooks)
  const otpRef0 = useRef<TextInput>(null);
  const otpRef1 = useRef<TextInput>(null);
  const otpRef2 = useRef<TextInput>(null);
  const otpRef3 = useRef<TextInput>(null);
  // Type inféré par TypeScript — les accès par index sont protégés par ?.
  const otpRefs = [otpRef0, otpRef1, otpRef2, otpRef3];

  // ────────────────────────────────────────────────────────
  // ÉTAPE 1 — Envoi du code par SMS
  // ────────────────────────────────────────────────────────
  const handleSendCode = async () => {
    const trimmed = phone.trim();
    if (!trimmed) {
      return Alert.alert("Champ requis", "Veuillez saisir votre numéro de téléphone.");
    }

    setPhoneSending(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (api as any).loginByPhone(trimmed);
      setUserId(result.userId);
      setMaskedPhone(result.maskedPhone);
      setOtpValues(["", "", "", ""]);
      setStep("verify");
      startCountdown();
      // Focus automatique sur la première case
      setTimeout(() => otpRef0.current?.focus(), 200);
    } catch (e: any) {
      const raw = e?.response?.data?.message ?? e?.message ?? "Erreur réseau.";
      const msg = Array.isArray(raw) ? raw[0] : raw;
      Platform.OS === "web"
        ? alert(msg)
        : Alert.alert("Envoi impossible", msg);
    } finally {
      setPhoneSending(false);
    }
  };

  // ────────────────────────────────────────────────────────
  // ÉTAPE 2 — Gestion des cases OTP
  // ────────────────────────────────────────────────────────
  const handleOtpChange = (text: string, index: number) => {
    // On ne garde que le dernier chiffre saisi (robustesse copier-coller)
    const digit = text.replace(/\D/g, "").slice(-1);
    const next = [...otpValues];
    next[index] = digit;
    setOtpValues(next);

    // Avancer vers la case suivante si un chiffre est entré
    if (digit && index < 3) {
      otpRefs[index + 1]?.current?.focus();
    }

    // Soumettre automatiquement quand les 4 cases sont remplies
    if (digit && index === 3 && next.every((d) => d !== "")) {
      void handleVerifyOtp(next.join(""));
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    // Reculer vers la case précédente sur Backspace si la case est vide
    if (key === "Backspace" && !otpValues[index] && index > 0) {
      const next = [...otpValues];
      next[index - 1] = "";
      setOtpValues(next);
      otpRefs[index - 1]?.current?.focus();
    }
  };

  // ────────────────────────────────────────────────────────
  // ÉTAPE 2 — Vérification du code OTP
  // ────────────────────────────────────────────────────────
  const handleVerifyOtp = async (codeOverride?: string) => {
    const code = codeOverride ?? otpValues.join("");
    if (code.length < 4) {
      return Alert.alert("Code incomplet", "Veuillez saisir les 4 chiffres du code.");
    }
    setVerifying(true);
    try {
      // loginWithPhoneOtp met à jour l'état AuthProvider →
      // le guard de navigation redirige automatiquement vers /(tabs)/home
      await loginWithPhoneOtp(userId, code);
    } catch (e: any) {
      const raw = e?.response?.data?.message ?? e?.message ?? "Code incorrect ou expiré.";
      const msg = Array.isArray(raw) ? raw[0] : raw;
      Platform.OS === "web"
        ? alert(msg)
        : Alert.alert("Code invalide", msg);
      // Vider les cases pour une nouvelle saisie
      setOtpValues(["", "", "", ""]);
      setTimeout(() => otpRef0.current?.focus(), 100);
    } finally {
      setVerifying(false);
    }
  };

  // ────────────────────────────────────────────────────────
  // RENVOI DU CODE
  // ────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setOtpValues(["", "", "", ""]);
    setPhoneSending(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (api as any).loginByPhone(phone.trim());
      setUserId(result.userId);
      setMaskedPhone(result.maskedPhone);
      startCountdown();
      setTimeout(() => otpRef0.current?.focus(), 200);
    } catch (e: any) {
      const raw = e?.response?.data?.message ?? e?.message ?? "Erreur réseau.";
      const msg = Array.isArray(raw) ? raw[0] : raw;
      Alert.alert("Renvoi impossible", msg);
    } finally {
      setPhoneSending(false);
    }
  };

  const canVerify = otpValues.every((d) => d !== "");
  const isSubmitting = verifying || isLoading;

  // ────────────────────────────────────────────────────────
  // RENDU
  // ────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: C.g3 }}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.g2} />

      {/* Fond + cercles décoratifs */}
      <View style={[s.bgBase, { backgroundColor: C.g3 }]} />
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: "transparent" }}
      >
        {/* ══ EN-TÊTE ══ */}
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => step === "verify" ? setStep("phone") : router.back()}
            activeOpacity={0.75}
          >
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        </View>

        {/* ══ HERO ══ */}
        <View style={s.hero}>
          <View style={[s.iconBox, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
            <View style={[s.iconInner, { backgroundColor: "#FFFFFF" }]}>
              <Ionicons name="phone-portrait-outline" size={28} color={C.g4} />
            </View>
          </View>
          <Text style={[s.heroTitle, { fontFamily: F.display }]}>
            {step === "phone" ? "Connexion par téléphone" : "Vérification"}
          </Text>
          <Text style={[s.heroSub, { fontFamily: F.body }]}>
            {step === "phone"
              ? "Recevez un code à 4 chiffres par SMS pour vous connecter sans mot de passe."
              : `Code envoyé au ${maskedPhone}. Saisissez-le ci-dessous.`}
          </Text>
        </View>

        {/* ══ CARD ══ */}
        <View style={[s.card, { shadowColor: C.g1 }]}>
          <View style={[s.cardAccent, { backgroundColor: C.g4 }]} />

          {/* ── ÉTAPE 1 : numéro de téléphone ── */}
          {step === "phone" && (
            <>
              <Text style={[s.cardTitle, { fontFamily: F.display }]}>
                Votre numéro
              </Text>
              <Text style={[s.cardSub, { fontFamily: F.body }]}>
                Format international requis.
              </Text>

              <View style={[s.phoneRow, { borderColor: C.g4 + "60" }]}>
                <Ionicons
                  name="call-outline"
                  size={20}
                  color={C.g4}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={[
                    s.phoneInput,
                    { fontFamily: F.body },
                    Platform.OS === "web" && ({ outlineStyle: "none" } as any),
                  ]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Ex : +224 622 000 000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSendCode}
                  underlineColorAndroid="transparent"
                />
              </View>

              <TouchableOpacity
                style={[
                  s.btn,
                  { backgroundColor: C.g3, shadowColor: C.g3 },
                  (!phone.trim() || phoneSending) && s.btnDisabled,
                ]}
                onPress={handleSendCode}
                disabled={!phone.trim() || phoneSending}
                activeOpacity={0.9}
              >
                {phoneSending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={[s.btnTxt, { fontFamily: F.body }]}>
                      Envoyer le code
                    </Text>
                    <View style={s.btnArrow}>
                      <Ionicons name="arrow-forward" size={16} color={C.g4} />
                    </View>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* ── ÉTAPE 2 : 4 cases OTP ── */}
          {step === "verify" && (
            <>
              <Text style={[s.cardTitle, { fontFamily: F.display }]}>
                Code reçu par SMS
              </Text>
              <Text style={[s.cardSub, { fontFamily: F.body }]}>
                Saisissez les 4 chiffres envoyés au {maskedPhone}.
              </Text>

              {/* Cases OTP */}
              <View style={s.otpRow}>
                {([0, 1, 2, 3] as const).map((i) => (
                  <TextInput
                    key={i}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ref={otpRefs[i] as any}
                    style={[
                      s.otpBox,
                      otpValues[i] ? { borderColor: C.g4 } : {},
                      Platform.OS === "web" && ({ outlineStyle: "none" } as any),
                    ]}
                    value={otpValues[i]}
                    onChangeText={(t) => handleOtpChange(t, i)}
                    onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    caretHidden
                    selectTextOnFocus
                    underlineColorAndroid="transparent"
                  />
                ))}
              </View>

              {/* Bouton Confirmer */}
              <TouchableOpacity
                style={[
                  s.btn,
                  { backgroundColor: C.g3, shadowColor: C.g3 },
                  (!canVerify || isSubmitting) && s.btnDisabled,
                ]}
                onPress={() => handleVerifyOtp()}
                disabled={!canVerify || isSubmitting}
                activeOpacity={0.9}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={[s.btnTxt, { fontFamily: F.body }]}>
                      Confirmer
                    </Text>
                    <View style={s.btnArrow}>
                      <Ionicons name="checkmark" size={16} color={C.g4} />
                    </View>
                  </>
                )}
              </TouchableOpacity>

              {/* Renvoi du code */}
              <TouchableOpacity
                style={s.resendBtn}
                onPress={handleResend}
                disabled={resendCountdown > 0 || phoneSending}
                activeOpacity={0.75}
              >
                {phoneSending ? (
                  <ActivityIndicator color={C.g4} size="small" />
                ) : (
                  <Text style={[
                    s.resendTxt,
                    { color: resendCountdown > 0 ? "#9CA3AF" : C.g4, fontFamily: F.body },
                  ]}>
                    {resendCountdown > 0
                      ? `Renvoyer le code dans ${resendCountdown}s`
                      : "Renvoyer le code"}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ══ BOTTOM ══ */}
        <View style={s.bottom}>
          <TouchableOpacity
            style={s.altLoginBtn}
            onPress={() => router.replace("/(auth)/login")}
            activeOpacity={0.85}
          >
            <Ionicons name="lock-closed-outline" size={16} color="rgba(255,255,255,0.8)" style={{ marginRight: 8 }} />
            <Text style={[s.altLoginTxt, { fontFamily: F.body }]}>
              Se connecter avec un mot de passe
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  bgBase:    { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 },
  bgCircle1: { position: "absolute", width: 320, height: 320, borderRadius: 160, backgroundColor: "rgba(255,255,255,0.05)", top: -80, right: -80 },
  bgCircle2: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.04)", top: 120, left: -60 },

  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 48 : 60 },

  header:  { marginBottom: 8 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },

  hero:      { alignItems: "center", marginBottom: 24 },
  iconBox:   { width: 78, height: 78, borderRadius: 26, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  iconInner: { width: 58, height: 58, borderRadius: 19, justifyContent: "center", alignItems: "center" },
  heroTitle: { fontSize: 26, color: "#FFFFFF", letterSpacing: -0.3, marginBottom: 8, textAlign: "center", fontWeight: "800" },
  heroSub:   { fontSize: 13, color: "rgba(255,255,255,0.75)", textAlign: "center", lineHeight: 19, fontWeight: "500", paddingHorizontal: 10 },

  card:       { backgroundColor: "#FFFFFF", borderRadius: 28, padding: 24, overflow: "hidden", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 10, maxWidth: 520, alignSelf: "center", width: "100%" },
  cardAccent: { height: 4, position: "absolute", top: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  cardTitle:  { fontSize: 22, fontWeight: "800", color: "#0F172A", marginBottom: 6, marginTop: 6 },
  cardSub:    { fontSize: 13, color: "#6B7280", fontWeight: "500", lineHeight: 19, marginBottom: 20 },

  // ── Étape 1 : input téléphone ──
  phoneRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F8FAFC", borderRadius: 16,
    borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 20,
  },
  phoneInput: { flex: 1, fontSize: 16, color: "#0F172A", fontWeight: "600" },

  // ── Bouton CTA principal ──
  btn:         { borderRadius: 16, paddingVertical: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  btnDisabled: { opacity: 0.45 },
  btnTxt:      { color: "#FFFFFF", fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },
  btnArrow:    { width: 30, height: 30, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center", marginLeft: 10 },

  // ── Étape 2 : cases OTP ──
  otpRow: {
    flexDirection: "row", justifyContent: "center",
    gap: 12, marginBottom: 24,
  },
  otpBox: {
    width: 62, height: 68,
    backgroundColor: "#F8FAFC",
    borderRadius: 16, borderWidth: 2,
    borderColor: "#E2E8F0",
    fontSize: 28, fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },

  // ── Renvoi ──
  resendBtn: { alignItems: "center", paddingVertical: 14 },
  resendTxt: { fontSize: 14, fontWeight: "600" },

  // ── Bottom ──
  bottom:      { marginTop: 16, alignItems: "center" },
  altLoginBtn: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 12, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  altLoginTxt: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600" },
});