// apps/direct-transfair-mobile/app/(auth)/verify-contact.tsx
// =========================================================
// VERIFY CONTACT v1.2 — Direct Transf'air
// ✅ v1.0 conservé intégralement
// ✅ v1.1 conservé intégralement (UI erreur réseau + retry inline)
// ✅ v1.2 : FIX écran figé sur "Connexion en cours..."
//
//   PROBLÈME RÉSOLU (v1.2) :
//   Après vérification réussie (allVerified: true) avec un token
//   présent, refreshUser() était appelé dans un try/catch vide.
//   Si refreshUser() échouait, l'erreur était avalée en silence et
//   rien ne se passait ensuite : l'écran restait bloqué sur
//   "Compte activé ! Connexion en cours..." indéfiniment, sans
//   navigation ni message d'erreur.
//
//   FIX — Le catch n'est plus vide : en cas d'échec de
//   refreshUser(), on retombe sur la redirection vers /login-v2
//   (le même filet de sécurité que le cas "pas de token"), pour
//   ne jamais laisser l'utilisateur bloqué sur un spinner mort.
//
//   ⚠️ Si refreshUser() ne rejette jamais (promesse qui ne se
//   résout ni ne rejette — un vrai "hang"), ce filet ne suffira
//   pas : il faudrait un timeout de course (Promise.race) côté
//   AuthProvider. À vérifier si le blocage persiste après ce fix.
// =========================================================

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../providers/AuthProvider';
import { useTenant } from '../../providers/TenantProvider';
import { v2Auth } from '../../services/v2-auth';

// ─── Polices ─────────────────────────────────────────────
const F = {
  display: Platform.select({ ios: 'Georgia',  android: 'serif',      default: 'serif' }),
  body:    Platform.select({ ios: 'System',   android: 'sans-serif', default: 'sans-serif' }),
};

// ─── Palette depuis couleur primaire ─────────────────────
function hexToRgb(hex: string): [number, number, number] | null {
  const c = hex.replace('#', '');
  if (c.length !== 6) return null;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return isNaN(r + g + b) ? null : [r, g, b];
}
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
function toHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
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
  const p = /^#[0-9A-Fa-f]{6}$/.test(primary) ? primary : '#059669';
  return {
    g1: darken(p, 0.85),
    g2: darken(p, 0.70),
    g3: darken(p, 0.45),
    g4: p,
    g5: lighten(p, 0.30),
    g6: lighten(p, 0.55),
  };
}

// ─── Constantes ──────────────────────────────────────────
const OTP_LENGTH          = 6;
const RESEND_COOLDOWN_SEC = 60;

// ─── Types internes ───────────────────────────────────────
type Step = 'email' | 'phone';

// =========================================================
// COMPOSANT : Case OTP (1 chiffre)
// =========================================================
function OtpBox({
  value, accentColor, inputRef, onChangeText, onKeyPress,
}: {
  value: string;
  accentColor: string;
  inputRef: React.Ref<TextInput>;
  onChangeText: (t: string) => void;
  onKeyPress: (key: string) => void;
}) {
  return (
    <TextInput
      ref={inputRef}
      style={[
        s.otpBox,
        value ? { borderColor: accentColor } : {},
        Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
      ]}
      value={value}
      onChangeText={onChangeText}
      onKeyPress={({ nativeEvent }) => onKeyPress(nativeEvent.key)}
      keyboardType="number-pad"
      maxLength={1}
      textAlign="center"
      caretHidden
      selectTextOnFocus
      underlineColorAndroid="transparent"
    />
  );
}

// =========================================================
// COMPOSANT : Barre de progression
// =========================================================
function ProgressBar({
  current, total, accentColor,
}: {
  current: number; total: number; accentColor: string;
}) {
  if (total < 2) return null;
  return (
    <View style={s.progressWrap}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            s.progressDot,
            { backgroundColor: i < current ? accentColor : '#E2E8F0' },
          ]}
        />
      ))}
    </View>
  );
}

// =========================================================
// ÉCRAN PRINCIPAL
// =========================================================
export default function VerifyContactScreen() {
  const { token, refreshUser } = useAuth();
  const { branding }           = useTenant();
  const router                 = useRouter();

  const params = useLocalSearchParams<{
    userId:        string;
    emailVerified: string;
    phoneVerified: string;
    hasPhone:      string;
  }>();

  const userId        = params.userId        ?? '';
  const emailVerified = params.emailVerified === '1';
  const phoneVerified = params.phoneVerified === '1';
  const hasPhone      = params.hasPhone      === '1';

  const C = useMemo(() => buildTheme(branding.primaryColor), [branding.primaryColor]);

  // ── Étapes requises ──────────────────────────────────────
  const stepsRequired = useMemo<Step[]>(() => {
    const steps: Step[] = [];
    if (!emailVerified) steps.push('email');
    // ── DEV : vérification téléphone commentée — décommenter pour la prod ──
    // if (!phoneVerified && hasPhone) steps.push('phone');
    return steps;
  }, [emailVerified, phoneVerified, hasPhone]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep: Step | 'done' =
    currentStepIndex < stepsRequired.length ? stepsRequired[currentStepIndex]! : 'done';

  // ── État OTP ─────────────────────────────────────────────
  const emptyOtp = () => Array(OTP_LENGTH).fill('');
  const [otpValues,   setOtpValues]   = useState<string[]>(emptyOtp());
  const [maskedInfo,  setMaskedInfo]  = useState('');
  const [isSending,   setIsSending]   = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [codeSent,    setCodeSent]    = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  // ✅ v1.1 : state erreur inline (remplace Alert.alert)
  const [sendError,   setSendError]   = useState<string | null>(null);

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
    Animated.spring(checkScale, {
      toValue: 1, useNativeDriver: true,
      friction: 5, tension: 80,
    }).start();
  };

  // ── Refs cases OTP ───────────────────────────────────────
  const otpRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  // ── Envoi du code ────────────────────────────────────────
  // ✅ v1.1 : setSendError au lieu d'Alert + reset error au départ
  const sendCode = useCallback(async (step: Step) => {
    if (!userId) return;
    setIsSending(true);
    setRateLimited(false);
    setSendError(null); // Reset l'erreur précédente

    try {
      const channel = step === 'email' ? 'EMAIL' : 'PHONE';
      const res = await v2Auth.sendVerification(userId, channel);
      setMaskedInfo(res.maskedRecipient);
      setCodeSent(true);
      startCountdown();
      setTimeout(() => otpRefs[0]?.current?.focus(), 250);
    } catch (e: any) {
      const msg = v2Auth.extractMessage(e);
      const isRateLimit =
        msg.toLowerCase().includes('rate')  ||
        msg.toLowerCase().includes('heure') ||
        msg.includes('3');

      if (isRateLimit) {
        // Rate limit : afficher UI OTP quand même (code peut déjà exister)
        setRateLimited(true);
        setCodeSent(true);
      } else {
        // ✅ v1.1 : erreur inline avec retry, pas d'Alert
        setSendError(msg);
      }
    } finally {
      setIsSending(false);
    }
  }, [userId, startCountdown]);

  // ── Envoi automatique au montage et changement d'étape ───
  const hasSentRef = useRef(false); // ← ajoute cette ligne avec les autres refs

 useEffect(() => {
  // ✅ Guard anti-double-appel (React StrictMode + Railway)
  // Sans ce guard : 3 appels → rate limit immédiat → plus aucun email
  if (currentStep !== 'done' && !codeSent && !hasSentRef.current) {
    hasSentRef.current = true;
    void sendCode(currentStep);
    }
  }, [currentStep]);

  // ── Changement étape : reset état ────────────────────────
  const moveToNextStep = () => {
    setOtpValues(emptyOtp());
    setCodeSent(false);
    setRateLimited(false);
    setCountdown(0);
    setSendError(null); // ✅ v1.1 : reset l'erreur
    checkScale.setValue(0);
    setCurrentStepIndex((i) => i + 1);
  };

  // ── Gestion saisie OTP ───────────────────────────────────
  const handleOtpChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...otpValues];
    next[index] = digit;
    setOtpValues(next);
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs[index + 1]?.current?.focus();
    }
    if (digit && index === OTP_LENGTH - 1 && next.every((d) => d !== '')) {
      void handleVerify(next.join(''));
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otpValues[index] && index > 0) {
      const next = [...otpValues];
      next[index - 1] = '';
      setOtpValues(next);
      otpRefs[index - 1]?.current?.focus();
    }
  };

  // ── Vérification ─────────────────────────────────────────
  // ✅ v1.2 — le catch autour de refreshUser() n'est plus vide :
  // en cas d'échec, on retombe sur la redirection vers /login-v2
  // au lieu de laisser l'écran figé sur "Connexion en cours...".
  const handleVerify = async (codeOverride?: string) => {
    const code = codeOverride ?? otpValues.join('');
    if (code.length < OTP_LENGTH) return;
    if (currentStep === 'done') return;

    setIsVerifying(true);
    try {
      const channel = currentStep === 'email' ? 'EMAIL' : 'PHONE';
      const res = await v2Auth.verifyContact(userId, code, channel);

      if (res.allVerified) {
        animateSuccess();
        setTimeout(async () => {
          if (token) {
            try {
              await refreshUser();
            } catch (refreshErr) {
              // ✅ v1.2 : filet de sécurité — ne jamais rester bloqué
              // sur le spinner si refreshUser() échoue.
              console.error('[verify-contact] refreshUser a échoué après vérification', refreshErr);
              router.replace({
                pathname: '/(auth)/login-v2',
                params: { verified: '1' },
              } as any);
            }
          } else {
            router.replace({
              pathname: '/(auth)/login-v2',
              params: { verified: '1' },
            } as any);
          }
        }, 700);
        return;
      }

      if (!res.allVerified) {
        animateSuccess();
        setTimeout(() => moveToNextStep(), 700);
      }
    } catch (e: any) {
      const msg = v2Auth.extractMessage(e);
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        const { Alert } = require('react-native');
        Alert.alert('Code invalide', msg);
      }
      setOtpValues(emptyOtp());
      setTimeout(() => otpRefs[0]?.current?.focus(), 100);
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Renvoi ───────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0 || isSending || currentStep === 'done') return;
    setOtpValues(emptyOtp());
    setCodeSent(false);
    setSendError(null);
    await sendCode(currentStep as Step);
  };

  // ── Cas : rien à vérifier ────────────────────────────────
  useEffect(() => {
    if (stepsRequired.length === 0) {
      if (token) {
        void refreshUser();
      } else {
        router.replace('/(auth)/login-v2' as any);
      }
    }
  }, []);

  const canVerify   = otpValues.every((d) => d !== '') && !isVerifying;
  const totalSteps  = stepsRequired.length;
  const stepNumber  = currentStepIndex + 1;

  // ── Contenu contextuel ───────────────────────────────────
  const stepConfig = useMemo(() => {
    if (currentStep === 'email') {
      return {
        icon:     'mail-outline'    as const,
        title:    'Vérification email',
        subtitle: maskedInfo
          ? `Code envoyé à ${maskedInfo}. Saisissez les ${OTP_LENGTH} chiffres.`
          : 'Envoi du code de vérification en cours…',
        label:    'Adresse email',
      };
    }
    if (currentStep === 'phone') {
      return {
        icon:     'phone-portrait-outline' as const,
        title:    'Vérification téléphone',
        subtitle: maskedInfo
          ? `Code envoyé au ${maskedInfo}. Saisissez les ${OTP_LENGTH} chiffres.`
          : 'Envoi du code SMS en cours…',
        label:    'Numéro de téléphone',
      };
    }
    return {
      icon:  'checkmark-circle-outline' as const,
      title: 'Compte activé',
      subtitle: 'Toutes vos coordonnées ont été vérifiées.',
      label: '',
    };
  }, [currentStep, maskedInfo]);

  // ─────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: C.g3 }}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.g2} />

      {/* Fond décoratif */}
      <View style={[s.bgBase, { backgroundColor: C.g3 }]} />
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
        {/* ══ EN-TÊTE ══ */}
        <View style={s.header}>
          <View style={s.headerSpacer} />
          {totalSteps > 1 && (
            <Text style={[s.stepCounter, { fontFamily: F.body }]}>
              Étape {stepNumber}/{totalSteps}
            </Text>
          )}
        </View>

        {/* ══ HERO ══ */}
        <View style={s.hero}>
          <View style={[s.iconBox, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <Animated.View
              style={[
                s.iconInner,
                { backgroundColor: '#FFFFFF' },
                currentStep === 'done' && { transform: [{ scale: checkScale }] },
              ]}
            >
              <Ionicons name={stepConfig.icon} size={28} color={C.g4} />
            </Animated.View>
          </View>

          <Text style={[s.heroTitle, { fontFamily: F.display }]}>
            {stepConfig.title}
          </Text>
          <Text style={[s.heroSub, { fontFamily: F.body }]}>
            {stepConfig.subtitle}
          </Text>

          <ProgressBar current={stepNumber} total={totalSteps} accentColor={C.g4} />
        </View>

        {/* ══ CARD ══ */}
        <View style={[s.card, { shadowColor: C.g1 }]}>
          <View style={[s.cardAccent, { backgroundColor: C.g4 }]} />

          {/* ── Cas : tout vérifié ── */}
          {currentStep === 'done' && (
            <View style={s.doneWrap}>
              <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                <View style={[s.doneCircle, { backgroundColor: C.g4 + '18' }]}>
                  <Ionicons name="checkmark-circle" size={64} color={C.g4} />
                </View>
              </Animated.View>
              <Text style={[s.doneTitle, { fontFamily: F.display }]}>
                Compte activé !
              </Text>
              <Text style={[s.doneSub, { fontFamily: F.body }]}>
                Toutes vos coordonnées sont vérifiées. Connexion en cours…
              </Text>
              <ActivityIndicator color={C.g4} style={{ marginTop: 20 }} />
            </View>
          )}

          {/* ── OTP UI ── */}
          {currentStep !== 'done' && (
            <>
              <Text style={[s.cardTitle, { fontFamily: F.display }]}>
                Code de vérification
              </Text>
              <Text style={[s.cardSub, { fontFamily: F.body }]}>
                {stepConfig.label}
                {maskedInfo ? ` : ${maskedInfo}` : ''}
              </Text>

              {/* Chargement initial */}
              {isSending && !codeSent && !sendError && (
                <View style={s.sendingWrap}>
                  <ActivityIndicator color={C.g4} />
                  <Text style={[s.sendingTxt, { fontFamily: F.body }]}>
                    Envoi du code…
                  </Text>
                </View>
              )}

              {/* ✅ v1.1 : Erreur d'envoi avec bouton Réessayer inline */}
              {!isSending && !codeSent && !!sendError && (
                <View style={[s.errorBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.errorTxt, { fontFamily: F.body }]}>
                      {sendError}
                    </Text>
                    <TouchableOpacity
                      style={[s.btn, { backgroundColor: C.g3, paddingVertical: 13, marginTop: 12 }]}
                      onPress={() => void sendCode(currentStep as Step)}
                      activeOpacity={0.9}
                    >
                      <Text style={[s.btnTxt, { fontFamily: F.body, fontSize: 14 }]}>
                        Réessayer
                      </Text>
                      <View style={s.btnArrow}>
                        <Ionicons name="refresh-outline" size={14} color={C.g4} />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Cases OTP */}
              {codeSent && (
                <>
                  <View style={s.otpRow}>
                    {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                      <OtpBox
                        key={i}
                        value={otpValues[i] ?? ''}
                        accentColor={C.g4}
                        inputRef={otpRefs[i]}
                        onChangeText={(t) => handleOtpChange(t, i)}
                        onKeyPress={(key) => handleOtpKeyPress(key, i)}
                      />
                    ))}
                  </View>

                  {/* Bouton Vérifier */}
                  <TouchableOpacity
                    style={[
                      s.btn,
                      { backgroundColor: C.g3, shadowColor: C.g3 },
                      !canVerify && s.btnDisabled,
                    ]}
                    onPress={() => handleVerify()}
                    disabled={!canVerify}
                    activeOpacity={0.9}
                  >
                    {isVerifying ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={[s.btnTxt, { fontFamily: F.body }]}>
                          Vérifier
                        </Text>
                        <View style={s.btnArrow}>
                          <Ionicons name="checkmark" size={16} color={C.g4} />
                        </View>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Renvoi */}
                  <TouchableOpacity
                    style={s.resendBtn}
                    onPress={handleResend}
                    disabled={countdown > 0 || isSending}
                    activeOpacity={0.75}
                  >
                    {isSending ? (
                      <ActivityIndicator color={C.g4} size="small" />
                    ) : (
                      <Text style={[
                        s.resendTxt,
                        {
                          color: (countdown > 0 || rateLimited) ? '#9CA3AF' : C.g4,
                          fontFamily: F.body,
                        },
                      ]}>
                        {countdown > 0
                          ? `Renvoyer dans ${countdown}s`
                          : rateLimited
                            ? 'Limite atteinte (3/heure) — réessayez plus tard'
                            : 'Renvoyer le code'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* Note de sécurité */}
              <View style={[s.noteBox, { backgroundColor: C.g4 + '10', borderColor: C.g4 + '30' }]}>
                <Ionicons name="shield-checkmark-outline" size={14} color={C.g4} />
                <Text style={[s.noteTxt, { color: C.g4, fontFamily: F.body }]}>
                  Le code expire dans 10 minutes.
                  {' '}Limite : 3 envois par heure.
                </Text>
              </View>
            </>
          )}
        </View>

        {/* ══ BOTTOM ══ */}
        <View style={s.bottom}>
          <Text style={[s.bottomTxt, { fontFamily: F.body }]}>
            Cette vérification garantit la sécurité de votre compte.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  bgBase:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bgCircle1: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(255,255,255,0.05)', top: -80, right: -80 },
  bgCircle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.04)', top: 120, left: -60 },

  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 48 : 60 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8 },
  headerSpacer:{ flex: 1 },
  stepCounter: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 },

  hero:      { alignItems: 'center', marginBottom: 24 },
  iconBox:   { width: 78, height: 78, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  iconInner: { width: 58, height: 58, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  heroTitle: { fontSize: 26, color: '#FFFFFF', letterSpacing: -0.3, marginBottom: 8, textAlign: 'center', fontWeight: '800' },
  heroSub:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 20, fontWeight: '500', paddingHorizontal: 10, marginBottom: 12 },

  progressWrap: { flexDirection: 'row', gap: 8, marginTop: 4 },
  progressDot:  { width: 24, height: 4, borderRadius: 99 },

  card:       { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, overflow: 'hidden', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 10, maxWidth: 520, alignSelf: 'center', width: '100%' },
  cardAccent: { height: 4, position: 'absolute', top: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  cardTitle:  { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 4, marginTop: 6 },
  cardSub:    { fontSize: 13, color: '#6B7280', fontWeight: '500', lineHeight: 19, marginBottom: 20 },

  sendingWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'center', paddingVertical: 20 },
  sendingTxt:  { fontSize: 14, color: '#6B7280', fontWeight: '500' },

  // ✅ v1.1 : Boîte d'erreur inline
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8,
  },
  errorTxt: { fontSize: 13, color: '#EF4444', fontWeight: '500', lineHeight: 19 },

  otpRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: Platform.OS === 'web' ? 8 : 7,
    marginBottom: 24, flexWrap: 'nowrap',
  },
  otpBox: {
    width: Platform.OS === 'web' ? 46 : 44,
    height: Platform.OS === 'web' ? 56 : 52,
    backgroundColor: '#F8FAFC',
    borderRadius: 14, borderWidth: 2,
    borderColor: '#E2E8F0',
    fontSize: 22, fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },

  btn:         { borderRadius: 16, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  btnDisabled: { opacity: 0.45 },
  btnTxt:      { color: '#FFFFFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },
  btnArrow:    { width: 30, height: 30, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },

  resendBtn: { alignItems: 'center', paddingVertical: 14 },
  resendTxt: { fontSize: 13, fontWeight: '600' },

  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 4 },
  noteTxt: { flex: 1, fontSize: 11, fontWeight: '600', lineHeight: 17 },

  doneWrap:   { alignItems: 'center', paddingVertical: 24 },
  doneCircle: { width: 100, height: 100, borderRadius: 99, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  doneTitle:  { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  doneSub:    { fontSize: 14, color: '#6B7280', fontWeight: '500', textAlign: 'center', lineHeight: 21 },

  bottom:    { marginTop: 20, alignItems: 'center', paddingHorizontal: 16 },
  bottomTxt: { fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 18, fontWeight: '500' },
});