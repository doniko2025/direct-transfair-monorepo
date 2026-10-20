// apps/direct-transfair-mobile/app/(auth)/otp-phone.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// CONNEXION PAR TÉLÉPHONE (OTP 4 chiffres) v2.0
// ✅ v2.0 : REFONTE TOTALE en thème clair (cadre AuthShell, champ téléphone, code à 4 chiffres OtpInput,
//    bouton pilule à la couleur de la société). Fini la palette locale dérivée en dur et le fond sombre.
//    LOGIQUE INCHANGÉE : api.loginByPhone → userId + numéro masqué, code à 4 chiffres, envoi automatique
//    à la saisie complète, loginWithPhoneOtp, minuteur de renvoi de 60 s, messages d'erreur du serveur.
// ✅ v1.0 : étape 1 numéro + SMS, étape 2 code OTP, minuteur de renvoi, isolation tenant (x-tenant-id).
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// =========================================================

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Alert, Platform, View } from 'react-native';
import { useRouter } from "expo-router";
import { useAuth } from "../../providers/AuthProvider";
import { api } from "../../services/api";
import AuthShell from "../../components/auth/AuthShell";
import AuthButton from "../../components/auth/AuthButton";
import { Field, OtpInput } from "../../components/ui";
import { FONT, N } from "../../components/auth/authTheme";

import { Text } from '../../components/ui/Text';
// ─── Durée du minuteur de renvoi ─────────────────────────
const RESEND_DELAY_SECONDS = 60;

// ─── Écran principal ─────────────────────────────────────
export default function OtpPhoneScreen() {
  const { loginWithPhoneOtp, isLoading } = useAuth();
  const router                           = useRouter();

  // ── États globaux ──
  const [step, setStep] = useState<"phone" | "verify">("phone");

  // ── Étape 1 : numéro de téléphone ──
  const [phone,        setPhone]        = useState("");
  const [phoneSending, setPhoneSending] = useState(false);

  // ── Étape 2 : code OTP + données récupérées à l'étape 1 ──
  const [userId,      setUserId]      = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [otpCode,     setOtpCode]     = useState("");
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
      setOtpCode("");
      setStep("verify");
      startCountdown();
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
  // ÉTAPE 2 — Vérification du code OTP
  // ────────────────────────────────────────────────────────
  const handleVerifyOtp = async (codeOverride?: string) => {
    const code = codeOverride ?? otpCode;
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
      setOtpCode("");
    } finally {
      setVerifying(false);
    }
  };

  // ────────────────────────────────────────────────────────
  // RENVOI DU CODE
  // ────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setOtpCode("");
    setPhoneSending(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (api as any).loginByPhone(phone.trim());
      setUserId(result.userId);
      setMaskedPhone(result.maskedPhone);
      startCountdown();
    } catch (e: any) {
      const raw = e?.response?.data?.message ?? e?.message ?? "Erreur réseau.";
      const msg = Array.isArray(raw) ? raw[0] : raw;
      Alert.alert("Renvoi impossible", msg);
    } finally {
      setPhoneSending(false);
    }
  };

  const canVerify = otpCode.length === 4;
  const isSubmitting = verifying || isLoading;

  // ────────────────────────────────────────────────────────
  // RENDU
  // ────────────────────────────────────────────────────────
  if (step === "phone") {
    return (
      <AuthShell
        compact
        title="Connexion par téléphone"
        subtitle="Recevez un code à 4 chiffres par SMS pour vous connecter sans mot de passe."
        onBack={() => router.back()}
      >
        <Field
          label="Votre numéro"
          icon="call-outline"
          value={phone}
          onChangeText={setPhone}
          placeholder="+33 6 12 34 56 78"
          hint="Format international requis."
          keyboardType="phone-pad"
          autoComplete="tel"
          returnKeyType="send"
          onSubmitEditing={handleSendCode}
        />
        <AuthButton label="Recevoir le code" icon="arrow-forward" iconRight loading={phoneSending} onPress={handleSendCode} />
        <View style={{ alignItems: "center", marginTop: 14 }}>
          <AuthButton label="Utiliser mon mot de passe" variant="link" onPress={() => router.replace("/(auth)/login-v2")} />
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      compact
      title="Vérification"
      subtitle={`Code envoyé au ${maskedPhone}. Saisissez-le ci-dessous.`}
      onBack={() => setStep("phone")}
    >
      <OtpInput value={otpCode} onChange={setOtpCode} onComplete={(c) => void handleVerifyOtp(c)} length={4} disabled={isSubmitting} />
      <View style={{ height: 22 }} />
      <AuthButton label="Valider" loading={isSubmitting} disabled={!canVerify} onPress={() => void handleVerifyOtp()} />
      <View style={{ alignItems: "center", marginTop: 14 }}>
        {resendCountdown > 0 ? (
          <Text style={{ fontFamily: FONT.body, fontSize: 13.5, color: N.muted }}>Renvoyer le code dans {resendCountdown} s</Text>
        ) : (
          <AuthButton label="Renvoyer le code" variant="link" disabled={phoneSending} onPress={handleResend} />
        )}
      </View>
    </AuthShell>
  );
}
