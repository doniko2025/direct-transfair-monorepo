// apps/direct-transfair-mobile/app/(auth)/verify-contact.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// VERIFY CONTACT v2.0 — Direct Transf'air
// ✅ v2.1 : THÈME CLAIR — design clair via le kit components/auth v2.0 ; compteur d'étape en gris ; aucune logique modifiée.
// ✅ v2.0 : REFONTE VISUELLE de la vérification — Thierno Doniko (Grand Chef).
//   TOUTE la logique v1.0 → v1.4 est conservée à l'identique : étapes requises, envoi
//   automatique unique au montage (garde anti-double appel), compte à rebours de renvoi,
//   gestion du plafond de demandes, et navigation centralisée dans UN SEUL effet
//   (correctif v1.4 : l'écran ne se fige plus sur « Connexion en cours »).
//   CHANGEMENTS :
//   - écran refait avec le kit components/auth (cadre, bandeaux, bouton) ;
//   - saisie du code : un seul champ réel + 6 cases (OtpCodeInput) → le code reçu par
//     SMS / email se colle ou se remplit automatiquement, et la vérification part toute seule
//     au 6ᵉ chiffre (avant : 6 champs séparés, collage impossible) ;
//   - code faux : message dans l'écran, cases remises à zéro (avant : pop-up) ;
//   - « Veuillez patienter N secondes » (renvoi trop rapproché du serveur) n'est plus pris
//     pour une panne : le code précédent est valide, on affiche la saisie ;
//   - serveur en veille : le serveur est réveillé avant l'envoi du code ;
//   - ajout de « Utiliser un autre compte » : un client qui s'est trompé d'adresse
//     n'est plus bloqué sur cet écran (l'écran bloque volontairement le retour arrière) ;
//   - accès sans identifiant (lien ouvert à froid) : message clair au lieu d'un écran vide.
// ✅ v1.0, v1.1, v1.2 conservés intégralement
// ✅ v1.3 : FIX RÉEL de l'écran figé sur "Connexion en cours..."
//
//   CAUSE RÉELLE (confirmée via AuthProvider.tsx) :
//   Après un utilisateur déjà token-é (inscription → access_token
//   émis avant vérification email) qui termine avec succès
//   (allVerified: true), le code appelait refreshUser() puis ne
//   naviguait jamais explicitement ailleurs. Le garde de navigation
//   global dans AuthProvider exclut délibérément cet écran
//   (isVerifyScreen) de ses deux redirections automatiques — il est
//   fait pour nous y AMENER quand nécessaire, jamais pour nous en
//   faire SORTIR. Résultat : rien ne quittait jamais cet écran,
//   de façon 100% déterministe (pas un problème réseau/timing).
//
//   FIX — Navigation explicite vers /(tabs)/home après refreshUser(),
//   qu'il ait réussi ou non (refreshUser() avale déjà ses propres
//   erreurs sauf 401/403 → logout(), qui redirige lui-même vers
//   /login-v2 ; si ça arrive, le garde global renverra de toute
//   façon vers /login-v2 au prochain rendu puisque user sera null).
//
// ✅ v1.4 : 🚨 FIX — filet de sécurité navigation, chemin "done" alternatif
//
//   CAUSE RÉELLE RESTANTE (confirmée via v2-auth.service.ts) :
//   Le fix v1.3 ne naviguait que depuis le bloc allVerified===true de
//   handleVerify(). Mais un mismatch côté backend (corrigé en v2.3 de
//   v2-auth.service.ts) entre buildVerificationNeeded() — qui bypass
//   déjà le téléphone en DEV — et l'ancien calcul d'allVerified dans
//   verifyContact() — qui ne bypassait rien — faisait que tout compte
//   possédant un téléphone (donc quasiment tous, l'inscription en
//   exige un) recevait allVerified=false après vérification email.
//   Le frontend appelait alors moveToNextStep(), qui faisait avancer
//   currentStepIndex AU-DELÀ de stepsRequired.length (une seule étape
//   active en DEV) → currentStep devenait 'done' SANS jamais passer
//   par le bloc allVerified===true, donc sans jamais naviguer. L'écran
//   restait bloqué indéfiniment sur "Connexion en cours…".
//
//   CORRECTIF (défense en profondeur, les deux couches comptent) :
//   1. v2-auth.service.ts v2.3 corrige la vraie cause (le mismatch).
//   2. Ici : navigation consolidée dans un SEUL useEffect qui réagit à
//      currentStep === 'done', quel que soit le chemin qui y mène.
//      handleVerify() ne navigue plus lui-même — en cas d'allVerified
//      vrai, il se contente de faire avancer currentStepIndex jusqu'à
//      la fin de stepsRequired, ce qui fait passer currentStep à
//      'done' et déclenche ce même useEffect. L'ancien effet "Cas :
//      rien à vérifier" (qui ne couvrait que l'arrivée directe sur cet
//      écran avec stepsRequired déjà vide) est absorbé par ce même
//      effet unique — un seul endroit décide de la navigation, plus
//      possible d'avoir un chemin qui atteint 'done' sans être couvert.
// =========================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '../../components/ui/Icon';

import { useAuth } from '../../providers/AuthProvider';
import { v2Auth } from '../../services/v2-auth';
import { warmUpServer } from '../../services/serverWarmup';

import AuthShell, { useAuthPalette } from '../../components/auth/AuthShell';
import AuthButton   from '../../components/auth/AuthButton';
import AuthNotice   from '../../components/auth/AuthNotice';
import OtpCodeInput from '../../components/auth/OtpCodeInput';
import { describeAuthError } from '../../components/auth/authErrors';
import { FONT, N } from '../../components/auth/authTheme';

import { Text } from '../../components/ui/Text';
// ─── Constantes ──────────────────────────────────────────
const OTP_LENGTH          = 6;
const RESEND_COOLDOWN_SEC = 60;

type Step = 'email' | 'phone';

export default function VerifyContactScreen() {
  const { token, refreshUser, logout } = useAuth();
  const router = useRouter();
  const P = useAuthPalette();

  const params = useLocalSearchParams<{
    userId:        string;
    emailVerified: string;
    phoneVerified: string;
    hasPhone:      string;
  }>();

  const userId        = params.userId        ?? '';
  const emailVerified = params.emailVerified === '1';

  // ── Étapes requises ──────────────────────────────────────
  const stepsRequired = useMemo<Step[]>(() => {
    const steps: Step[] = [];
    if (!emailVerified) steps.push('email');
    // ── DEV : vérification téléphone commentée — décommenter pour la prod ──
    // if (!phoneVerified && hasPhone) steps.push('phone');
    return steps;
  }, [emailVerified]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep: Step | 'done' =
    currentStepIndex < stepsRequired.length ? stepsRequired[currentStepIndex]! : 'done';

  // ── État OTP ─────────────────────────────────────────────
  const [code,        setCode]        = useState('');
  const [wrong,       setWrong]       = useState(false);
  const [maskedInfo,  setMaskedInfo]  = useState('');
  const [isSending,   setIsSending]   = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [codeSent,    setCodeSent]    = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [sendError,   setSendError]   = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // ── Minuteur renvoi ──────────────────────────────────────
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(RESEND_COOLDOWN_SEC);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // ── Animation succès ─────────────────────────────────────
  const checkScale = useRef(new Animated.Value(0)).current;
  const animateSuccess = () => {
    Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 80 }).start();
  };

  // ── Envoi du code ────────────────────────────────────────
  const sendCode = useCallback(async (step: Step) => {
    if (!userId) return;
    setIsSending(true);
    setRateLimited(false);
    setSendError(null);

    try {
      await warmUpServer();   // réveille le serveur s'il dormait, avant d'envoyer
      const channel = step === 'email' ? 'EMAIL' : 'PHONE';
      const res = await v2Auth.sendVerification(userId, channel);
      setMaskedInfo(res.maskedRecipient);
      setCodeSent(true);
      startCountdown();
    } catch (e: any) {
      const msg = v2Auth.extractMessage(e);
      const low = msg.toLowerCase();
      const isRateLimit =
        low.includes('rate') || low.includes('heure') || low.includes('patienter') || msg.includes('3');

      if (isRateLimit) {
        // Un code valide existe déjà (envoi précédent) : on affiche la saisie.
        setRateLimited(true);
        setCodeSent(true);
      } else {
        setSendError(describeAuthError(e, 'generic').message);
      }
    } finally {
      setIsSending(false);
    }
  }, [userId, startCountdown]);

  // ── Envoi automatique unique au montage ──────────────────
  const hasSentRef = useRef(false);
  useEffect(() => {
    // Garde anti-double-appel (React StrictMode) : sans elle, plusieurs appels → plafond atteint → plus aucun email.
    if (currentStep !== 'done' && !codeSent && !hasSentRef.current) {
      hasSentRef.current = true;
      void sendCode(currentStep);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // ── Changement d'étape : reset état ──────────────────────
  const moveToNextStep = () => {
    setCode('');
    setWrong(false);
    setCodeSent(false);
    setRateLimited(false);
    setCountdown(0);
    setSendError(null);
    setVerifyError(null);
    checkScale.setValue(0);
    setCurrentStepIndex((i) => i + 1);
  };

  // ── Vérification ─────────────────────────────────────────
  // v1.4 — handleVerify() ne navigue pas : il pousse currentStepIndex jusqu'à 'done',
  // et l'effet de navigation ci-dessous (unique) décide de la suite.
  const handleVerify = async (codeOverride?: string) => {
    const value = codeOverride ?? code;
    if (value.length < OTP_LENGTH || isVerifying) return;
    if (currentStep === 'done') return;

    setIsVerifying(true);
    setVerifyError(null);
    try {
      const channel = currentStep === 'email' ? 'EMAIL' : 'PHONE';
      const res = await v2Auth.verifyContact(userId, value, channel);

      if (res.allVerified) {
        animateSuccess();
        setTimeout(() => setCurrentStepIndex(stepsRequired.length), 700);
        return;
      }
      moveToNextStep();
      animateSuccess();
    } catch (e: any) {
      const info = describeAuthError(e, 'otp');
      setVerifyError(info.kind === 'validation' || info.kind === 'unknown'
        ? 'Code incorrect ou expiré. Vérifiez le code reçu ou demandez-en un nouveau.'
        : info.message);
      setWrong(true);
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Renvoi ───────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0 || isSending || currentStep === 'done') return;
    setCode('');
    setWrong(false);
    setVerifyError(null);
    setCodeSent(false);
    setSendError(null);
    await sendCode(currentStep);
  };

  // ── Navigation — SEUL endroit qui quitte cet écran (v1.4) ─
  const hasNavigatedRef = useRef(false);
  useEffect(() => {
    if (currentStep !== 'done' || hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;

    const t = setTimeout(async () => {
      if (token) {
        await refreshUser().catch((refreshErr) => {
          console.error('[verify-contact] refreshUser a échoué après vérification', refreshErr);
        });
        router.replace('/(tabs)/home' as any);
      } else {
        router.replace({ pathname: '/(auth)/login-v2', params: { verified: '1' } } as any);
      }
    }, 400);

    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const totalSteps = stepsRequired.length;
  const stepNumber = currentStepIndex + 1;

  // ── Accès sans identifiant (lien ouvert à froid) ─────────
  if (!userId && currentStep !== 'done') {
    return (
      <AuthShell compact title="Vérification impossible" subtitle="Nous ne retrouvons pas le compte à vérifier.">
        <AuthNotice kind="warning" message="Reconnectez-vous : la vérification reprendra là où vous l'avez laissée." />
        <AuthButton label="Aller à la connexion" accent={P.action} onPress={() => router.replace('/(auth)/login-v2')} />
      </AuthShell>
    );
  }

  // ── Tout est vérifié ─────────────────────────────────────
  if (currentStep === 'done') {
    return (
      <AuthShell compact title="Compte activé" subtitle="Toutes vos coordonnées sont vérifiées.">
        <View style={s.doneWrap}>
          <Animated.View style={{ transform: [{ scale: checkScale.interpolate({ inputRange: [0, 1], outputRange: [1, 1] }) }] }}>
            <View style={[s.doneRing, { backgroundColor: P.tint, borderColor: P.tintBorder }]}>
              <Ionicons name="checkmark" size={46} color={P.action} />
            </View>
          </Animated.View>
          <Text style={s.doneTxt}>Connexion en cours…</Text>
          <ActivityIndicator color={P.accent} style={{ marginTop: 14 }} />
        </View>
      </AuthShell>
    );
  }

  // ── Saisie du code ───────────────────────────────────────
  const isEmail = currentStep === 'email';
  const title = isEmail ? 'Vérifiez votre email' : 'Vérifiez votre téléphone';
  const subtitle = maskedInfo
    ? `Un code à ${OTP_LENGTH} chiffres a été envoyé ${isEmail ? 'à' : 'au'} ${maskedInfo}.`
    : isEmail ? 'Envoi du code à votre adresse email…' : 'Envoi du code par SMS…';

  return (
    <AuthShell
      compact
      title={title}
      subtitle={subtitle}
      headerRight={totalSteps > 1 ? <Text style={s.counter}>Étape {stepNumber}/{totalSteps}</Text> : undefined}
      footer={
        <View style={s.otherRow}>
          <AuthButton label="Utiliser un autre compte" variant="link" accent={P.accent} onPress={() => void logout()} />
        </View>
      }
    >
      {isSending && !codeSent && !sendError ? (
        <View style={s.sending}>
          <ActivityIndicator color={P.accent} />
          <Text style={s.sendingTxt}>Envoi du code…</Text>
        </View>
      ) : null}

      {!isSending && !codeSent && sendError ? (
        <AuthNotice
          kind="error"
          title="Code non envoyé"
          message={sendError}
          actionLabel="Réessayer"
          onAction={() => void sendCode(currentStep)}
        />
      ) : null}

      {codeSent ? (
        <>
          {rateLimited ? (
            <AuthNotice kind="info" message="Un code vous a déjà été envoyé il y a un instant. Utilisez-le, ou patientez avant d'en demander un nouveau." />
          ) : null}
          {verifyError ? <AuthNotice kind="error" message={verifyError} /> : null}

          <OtpCodeInput
            value={code}
            onChange={(c) => { setCode(c); if (wrong) { setWrong(false); setVerifyError(null); } }}
            onComplete={(c) => void handleVerify(c)}
            accent={P.accent}
            error={wrong}
            disabled={isVerifying}
          />
          <View style={{ height: 22 }} />
          <AuthButton
            label="Vérifier"
            icon="checkmark"
            iconRight
            accent={P.action}
            loading={isVerifying}
            disabled={code.length < OTP_LENGTH}
            onPress={() => void handleVerify()}
          />
          <View style={s.resend}>
            {countdown > 0 ? (
              <Text style={s.hint}>Renvoyer le code dans {countdown} s</Text>
            ) : (
              <AuthButton label="Renvoyer le code" variant="link" accent={P.accent} loading={isSending} onPress={() => void handleResend()} />
            )}
          </View>
        </>
      ) : null}
    </AuthShell>
  );
}

const s = StyleSheet.create({
  counter:    { fontFamily: FONT.medium, fontSize: 12.5, fontWeight: '700', color: N.muted },
  sending:    { alignItems: 'center', paddingVertical: 28, gap: 12 },
  sendingTxt: { fontFamily: FONT.body, fontSize: 14, color: N.inkSub },
  resend:     { alignItems: 'center', marginTop: 14 },
  hint:       { fontFamily: FONT.body, fontSize: 13.5, color: N.muted, paddingVertical: 12 },
  otherRow:   { alignItems: 'center', marginTop: 6 },
  doneWrap:   { alignItems: 'center', paddingVertical: 18 },
  doneRing:   { width: 100, height: 100, borderRadius: 50, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  doneTxt:    { fontFamily: FONT.body, fontSize: 15, color: N.inkSub, marginTop: 18 },
});
