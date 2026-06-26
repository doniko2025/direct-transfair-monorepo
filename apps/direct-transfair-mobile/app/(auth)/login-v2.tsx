// apps/direct-transfair-mobile/app/(auth)/login-v2.tsx
// =========================================================
// LOGIN v2.3 — 3 méthodes de connexion
// ✅ v2.1 : applyLoginResult() remplace storeTokens() + refreshUser()
// ✅ v2.2 : clearBranding / USE_DEFAULT_PORTAL / bouton portail principal
// ✅ v2.3 : AUTO-RETRY TRANSPARENT après switch de portail
//
//   PROBLÈME RÉGLÉ :
//   Avant v2.3, un switch de portail (ex: SuperAdmin sur portail
//   Flash Transfer) nécessitait 2 clics :
//     1. Clic → USE_DEFAULT_PORTAL → Alert → clearBranding()
//     2. Re-clic manuellement → login réussi
//
//   SOLUTION :
//   handlePortalError() accepte maintenant un retryFn callback.
//   Après clearBranding() ou loadBranding(), le login est relancé
//   automatiquement avec les mêmes credentials — de façon transparente,
//   sans interruption, sans Alert intermédiaire.
//
//   FLOWS COUVERTS :
//     • SuperAdmin sur portail société → USE_DEFAULT_PORTAL
//         → clearBranding() → auto-retry DONIKO → ✅ 1 clic
//     • Admin/client sur portail DONIKO → USE_COMPANY_PORTAL
//         → loadBranding(clientCode) → auto-retry tenant société → ✅ 1 clic
//     • Web : redirection vers sous-domaine/domaine custom (inchangé)
//     • OTP email : même logique de retry transparent
//     • Bouton "Portail principal" : switch manuel (inchangé)
//
//   GARDE-FOU ANTI-BOUCLE :
//     retryFn est appelé avec isRetry=true. Sur erreur au retry,
//     on affiche l'erreur normalement sans relancer un nouveau cycle.
// =========================================================

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth }   from '../../providers/AuthProvider';
import { useTenant } from '../../providers/TenantProvider';
import { api }       from '../../services/api';
import { v2Auth }    from '../../services/v2-auth';

// ─── Types ────────────────────────────────────────────────
type Method = 'CHOOSE' | 'PASSWORD' | 'OTP_EMAIL' | 'OTP_PHONE';

// ─── Palette ──────────────────────────────────────────────
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

// ─── Polices ─────────────────────────────────────────────
const F = {
  display: Platform.select({ ios: 'Georgia',  android: 'serif',      default: 'serif' }),
  body:    Platform.select({ ios: 'System',   android: 'sans-serif', default: 'sans-serif' }),
};

// ─── FloatingInput ────────────────────────────────────────
function FloatingInput({
  label, value, onChangeText, icon, secureTextEntry, keyboardType,
  returnKeyType, onSubmitEditing, inputRef, accentColor,
}: {
  label: string; value: string; onChangeText: (t: string) => void;
  icon: any; secureTextEntry?: boolean; keyboardType?: any;
  returnKeyType?: any; onSubmitEditing?: () => void;
  inputRef?: React.Ref<TextInput>; accentColor: string;
}) {
  const [focused, setFocused] = useState(false);
  const [show,    setShow]    = useState(false);

  return (
    <View style={[fi.wrap, focused && { borderColor: accentColor }]}>
      <Ionicons name={icon} size={18} color={focused ? accentColor : '#9CA3AF'} style={fi.icon} />
      <View style={{ flex: 1 }}>
        <Text style={[fi.label, { color: (value || focused) ? accentColor : '#9CA3AF' }]}>{label}</Text>
        <TextInput
          ref={inputRef}
          style={fi.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secureTextEntry && !show}
          keyboardType={keyboardType ?? 'default'}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoCapitalize="none"
          autoCorrect={false}
          underlineColorAndroid="transparent"
          placeholderTextColor="#D1D5DB"
        />
      </View>
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setShow((s) => !s)} style={fi.eye}>
          <Ionicons name={show ? 'eye-outline' : 'eye-off-outline'} size={18} color="#9CA3AF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const fi = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, marginBottom: 12 },
  icon:  { marginRight: 10, marginTop: 4 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  input: { fontSize: 15, color: '#0F172A', fontWeight: '600', paddingVertical: 0 },
  eye:   { padding: 4 },
});

// ─── Indicateur de portail actif ─────────────────────────
// Affiché quand un switch se produit pour informer l'utilisateur
function PortalBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[pb.wrap, { backgroundColor: color + '18', borderColor: color + '40' }]}>
      <Ionicons name="swap-horizontal-outline" size={12} color={color} />
      <Text style={[pb.txt, { color, fontFamily: F.body }]}>{label}</Text>
    </View>
  );
}

const pb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 12 },
  txt:  { fontSize: 11, fontWeight: '700' },
});

// =========================================================
// ÉCRAN PRINCIPAL
// =========================================================
export default function LoginV2Screen() {
  const { branding, isCustomBranding, loadBranding, clearBranding } = useTenant();
  const { applyLoginResult } = useAuth();
  const router = useRouter();

  const C = useMemo(() => buildTheme(branding.primaryColor), [branding.primaryColor]);

  const [method,  setMethod]  = useState<Method>('CHOOSE');
  const [loading, setLoading] = useState(false);

  // ── MESSAGE PORTAIL — affiché pendant le switch invisible ──
  // ex: "Portail DONIKO chargé" — 2 secondes puis disparaît
  const [portalMsg, setPortalMsg] = useState<string | null>(null);
  const portalMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPortalMsg = (msg: string) => {
    setPortalMsg(msg);
    if (portalMsgTimer.current) clearTimeout(portalMsgTimer.current);
    portalMsgTimer.current = setTimeout(() => setPortalMsg(null), 3000);
  };

  const btnScale = useRef(new Animated.Value(1)).current;

  // ── PASSWORD state ────────────────────────────────────
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const passRef = useRef<TextInput | null>(null);

  // ── OTP EMAIL state ───────────────────────────────────
  const [otpEmailStep, setOtpEmailStep] = useState<'input' | 'verify'>('input');
  const [emailForOtp,  setEmailForOtp]  = useState('');
  const [otpUserId,    setOtpUserId]    = useState('');
  const [otpChannel,   setOtpChannel]   = useState<'EMAIL' | 'SMS'>('EMAIL');
  const [maskedRec,    setMaskedRec]    = useState('');
  const [otpValues,    setOtpValues]    = useState(['', '', '', '', '', '']);

  const otpRefs = [
    useRef<TextInput>(null), useRef<TextInput>(null),
    useRef<TextInput>(null), useRef<TextInput>(null),
    useRef<TextInput>(null), useRef<TextInput>(null),
  ];

  useFocusEffect(
    useCallback(() => {
      if (branding.code !== 'DONIKO') {
        void (api as any).setTenant?.(branding.code);
      }
    }, [branding.code]),
  );

  // ── Navigation vers verify-contact ────────────────────
  const goToVerification = (res: any) => {
    router.push({
      pathname: '/(auth)/verify-contact',
      params: {
        userId:        res.userId,
        emailVerified: res.emailVerified ? '1' : '0',
        phoneVerified: res.phoneVerified ? '1' : '0',
        hasPhone:      res.hasPhone      ? '1' : '0',
      },
    });
  };

  // ── Login réussi → hydrate AuthProvider ───────────────
  const handleLoginSuccess = async (result: any) => {
    await applyLoginResult(
      result.access_token,
      result.refresh_token,
      result.user,
    );
  };

  // ══════════════════════════════════════════════════════
  // handlePortalError v2.3 — AUTO-RETRY TRANSPARENT
  //
  // @param e         L'erreur axios interceptée
  // @param retryFn   Callback à exécuter après le switch de portail.
  //                  Appelé avec isRetry=true pour éviter les boucles.
  //
  // LOGIQUE :
  //   USE_COMPANY_PORTAL → loadBranding(clientCode) → await retryFn()
  //   USE_DEFAULT_PORTAL → clearBranding()          → await retryFn()
  //   Autre erreur       → Alert normal, pas de retry
  //
  // GARDE-FOU : retryFn est enveloppé dans try/catch ici.
  //   Les erreurs du retry sont gérées DANS retryFn (isRetry=true),
  //   pas ici, pour éviter la double gestion.
  // ══════════════════════════════════════════════════════
  const handlePortalError = async (
    e: any,
    retryFn?: () => Promise<void>,
  ): Promise<void> => {
    const data = e?.response?.data;

    // ── Cas 1 : User doit aller sur le portail de sa société ──
    if (data?.code === 'USE_COMPANY_PORTAL') {
      const { clientCode, subdomain, customDomain } = data;

      // Web : redirection directe vers le sous-domaine/domaine custom
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const targetUrl = customDomain
          ? `https://${customDomain}`
          : subdomain
            ? `https://${subdomain}.direct-transfer.com`
            : null;
        if (targetUrl) {
          Alert.alert(
            'Redirection',
            `Redirection vers l'espace ${clientCode ?? 'votre société'}…`,
            [{ text: 'Accéder →', onPress: () => { window.location.href = targetUrl; } }],
            { cancelable: false },
          );
          return;
        }
      }

      // Mobile : charger le branding de la société + auto-retry
      if (clientCode) {
        try {
          await loadBranding(clientCode);
        } catch {
          // Branding en erreur → on continue quand même le retry
        }
        showPortalMsg(`Espace "${clientCode}" chargé — connexion en cours…`);
        if (retryFn) {
          // Le retry s'exécute avec le nouveau tenant déjà appliqué
          await retryFn().catch(() => {
            // Erreur gérée à l'intérieur de retryFn (isRetry=true)
          });
        }
        return;
      }
      return;
    }

    // ── Cas 2 : SuperAdmin doit aller sur le portail principal ──
    if (data?.code === 'USE_DEFAULT_PORTAL') {
      // Réinitialise branding → tenant = DONIKO (synchrone)
      clearBranding();
      showPortalMsg('Portail principal chargé — connexion en cours…');
      if (retryFn) {
        await retryFn().catch(() => {
          // Erreur gérée à l'intérieur de retryFn (isRetry=true)
        });
      }
      return;
    }

    // ── Cas 3 : Toute autre erreur → affichage normal ──
    const msg = v2Auth.extractMessage(e);
    Platform.OS === 'web'
      ? alert(msg)
      : Alert.alert('Connexion échouée', msg);
  };

  // ══════════════════════════════════════════════════════
  // CONNEXION PAR MOT DE PASSE
  //
  // isRetry=false (défaut) : premier essai, auto-retry autorisé
  // isRetry=true           : deuxième essai post-switch, pas de retry
  //   → si ça échoue encore, c'est vraiment une erreur à afficher
  // ══════════════════════════════════════════════════════
  const handlePasswordLogin = async (isRetry = false) => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      const result = await v2Auth.loginPassword(email.trim(), password);

      if ('requiresVerification' in result && result.requiresVerification) {
        goToVerification(result);
        return;
      }

      await handleLoginSuccess(result);

    } catch (e: any) {
      if (!isRetry) {
        // Premier essai : tenter un switch de portail puis auto-retry
        await handlePortalError(e, () => handlePasswordLogin(true));
      } else {
        // Deuxième essai (post-switch) : afficher l'erreur directement
        const msg = v2Auth.extractMessage(e);
        Platform.OS === 'web'
          ? alert(msg)
          : Alert.alert('Connexion échouée', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════
  // DEMANDE OTP PAR EMAIL — même logique de retry
  // ══════════════════════════════════════════════════════
  const handleRequestOtpEmail = async (isRetry = false) => {
    if (!emailForOtp.trim()) return;
    setLoading(true);
    try {
      const result = await v2Auth.requestOtpEmail(emailForOtp.trim());
      setOtpUserId(result.userId);
      setMaskedRec(result.maskedRecipient);
      setOtpChannel('EMAIL');
      setOtpValues(['', '', '', '', '', '']);
      setOtpEmailStep('verify');
      setTimeout(() => otpRefs[0].current?.focus(), 200);

    } catch (e: any) {
      const data = e?.response?.data;
      if (data?.code === 'VERIFICATION_REQUIRED') {
        goToVerification(data);
        return;
      }
      if (!isRetry) {
        await handlePortalError(e, () => handleRequestOtpEmail(true));
      } else {
        const msg = v2Auth.extractMessage(e);
        Platform.OS === 'web'
          ? alert(msg)
          : Alert.alert('Connexion échouée', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Gestion saisie OTP ────────────────────────────────
  const handleOtpChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next  = [...otpValues];
    next[index] = digit;
    setOtpValues(next);
    if (digit && index < 5) otpRefs[index + 1]?.current?.focus();
    if (digit && index === 5 && next.every((d) => d !== '')) {
      void handleVerifyOtp(next.join(''));
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

  // ── Vérification OTP de connexion ─────────────────────
  const handleVerifyOtp = async (codeOverride?: string) => {
    const code = codeOverride ?? otpValues.join('');
    if (code.length < 6) return;
    setLoading(true);
    try {
      const result = await v2Auth.verifyOtpLogin(otpUserId, code, otpChannel);
      await handleLoginSuccess(result);
    } catch (e: any) {
      const data = e?.response?.data;
      if (data?.code === 'VERIFICATION_REQUIRED') {
        goToVerification(data);
        return;
      }
      const msg = v2Auth.extractMessage(e);
      Alert.alert('Code invalide', msg);
      setOtpValues(['', '', '', '', '', '']);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const canSubmitPassword = email.trim().length > 0 && password.trim().length > 0;

  // ══════════════════════════════════════════════════════
  // RENDU
  // ══════════════════════════════════════════════════════
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: C.g3 }}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.g2} />
      <View style={[s.bgBase, { backgroundColor: C.g3 }]} />
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
        {/* ── Bouton retour ── */}
        {method !== 'CHOOSE' && (
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => {
              setMethod('CHOOSE');
              setOtpEmailStep('input');
              setOtpValues(['', '', '', '', '', '']);
              setPortalMsg(null);
            }}
            activeOpacity={0.75}
          >
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        )}

        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={s.logoOuter}>
            <View style={s.logoInner}>
              <Ionicons name="swap-horizontal" size={28} color={C.g4} />
            </View>
          </View>
          <Text style={[s.appName, { fontFamily: branding.fontFamily ?? F.display }]}>
            {branding.name}
          </Text>
          <Text style={[s.tagline, { fontFamily: F.body }]}>
            {branding.tagline ?? 'Transferts internationaux sécurisés'}
          </Text>
        </View>

        {/* ══════════════════════════════════════════════ */}
        {/* CARD — CHOOSE                                 */}
        {/* ══════════════════════════════════════════════ */}
        {method === 'CHOOSE' && (
          <View style={[s.card, { shadowColor: C.g1 }]}>
            <View style={[s.cardAccent, { backgroundColor: C.g4 }]} />
            <Text style={[s.cardTitle, { fontFamily: branding.fontFamily ?? F.display }]}>
              Connexion
            </Text>
            <Text style={[s.cardSub, { fontFamily: F.body }]}>
              Choisissez votre méthode de connexion.
            </Text>

            <View style={{ marginTop: 20, gap: 12 }}>
              <TouchableOpacity
                style={[s.methodBtn, { borderColor: C.g4 + '40' }]}
                onPress={() => setMethod('OTP_EMAIL')}
                activeOpacity={0.85}
              >
                <View style={[s.methodIcon, { backgroundColor: C.g4 + '15' }]}>
                  <Ionicons name="mail-outline" size={22} color={C.g4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.methodTitle, { fontFamily: F.body }]}>Code par email</Text>
                  <Text style={[s.methodDesc, { fontFamily: F.body }]}>Recevez un code à 6 chiffres</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.g5} />
              </TouchableOpacity>

              {/* SMS — 4 chiffres (v1 OTP) */}
              <TouchableOpacity
                style={[s.methodBtn, { borderColor: C.g4 + '40' }]}
                onPress={() => router.push('/(auth)/otp-phone')}
                activeOpacity={0.85}
              >
                <View style={[s.methodIcon, { backgroundColor: C.g4 + '15' }]}>
                  <Ionicons name="phone-portrait-outline" size={22} color={C.g4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.methodTitle, { fontFamily: F.body }]}>Code par SMS</Text>
                  <Text style={[s.methodDesc, { fontFamily: F.body }]}>Recevez un code à 4 chiffres</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.g5} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.methodBtn, { borderColor: C.g4 + '40' }]}
                onPress={() => setMethod('PASSWORD')}
                activeOpacity={0.85}
              >
                <View style={[s.methodIcon, { backgroundColor: C.g4 + '15' }]}>
                  <Ionicons name="lock-closed-outline" size={22} color={C.g4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.methodTitle, { fontFamily: F.body }]}>Mot de passe</Text>
                  <Text style={[s.methodDesc, { fontFamily: F.body }]}>Email + mot de passe</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.g5} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════ */}
        {/* CARD — MOT DE PASSE                           */}
        {/* ══════════════════════════════════════════════ */}
        {method === 'PASSWORD' && (
          <View style={[s.card, { shadowColor: C.g1 }]}>
            <View style={[s.cardAccent, { backgroundColor: C.g4 }]} />
            <Text style={[s.cardTitle, { fontFamily: branding.fontFamily ?? F.display }]}>
              Mot de passe
            </Text>
            <Text style={[s.cardSub, { fontFamily: F.body }]}>
              Connectez-vous avec votre email et mot de passe.
            </Text>

            {/* ✅ v2.3 : Badge informatif après switch de portail */}
            {portalMsg && (
              <PortalBadge label={portalMsg} color={C.g4} />
            )}

            <View style={{ marginTop: portalMsg ? 4 : 20 }}>
              <FloatingInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                icon="mail-outline"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passRef.current?.focus()}
                accentColor={C.g4}
              />
              <FloatingInput
                label="Mot de passe"
                value={password}
                onChangeText={setPassword}
                icon="lock-closed-outline"
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={canSubmitPassword ? () => handlePasswordLogin() : undefined}
                inputRef={passRef}
                accentColor={C.g4}
              />
            </View>

            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                style={[
                  s.btn,
                  { backgroundColor: C.g3, shadowColor: C.g3 },
                  (!canSubmitPassword || loading) && s.btnDisabled,
                ]}
                onPress={() => handlePasswordLogin()}
                disabled={loading || !canSubmitPassword}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={[s.btnTxt, { fontFamily: F.body }]}>Se connecter</Text>
                    <View style={s.btnArrow}>
                      <Ionicons name="arrow-forward" size={16} color={C.g4} />
                    </View>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              style={s.linkBtn}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={[s.linkTxt, { color: C.g4, fontFamily: F.body }]}>
                Mot de passe oublié ?
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════════════════════════════════════ */}
        {/* CARD — OTP EMAIL                              */}
        {/* ══════════════════════════════════════════════ */}
        {method === 'OTP_EMAIL' && (
          <View style={[s.card, { shadowColor: C.g1 }]}>
            <View style={[s.cardAccent, { backgroundColor: C.g4 }]} />

            {/* ── Étape 1 : saisie email ── */}
            {otpEmailStep === 'input' && (
              <>
                <Text style={[s.cardTitle, { fontFamily: branding.fontFamily ?? F.display }]}>
                  Code par email
                </Text>
                <Text style={[s.cardSub, { fontFamily: F.body }]}>
                  Saisissez votre email pour recevoir un code à 6 chiffres.
                </Text>

                {portalMsg && (
                  <PortalBadge label={portalMsg} color={C.g4} />
                )}

                <View style={{ marginTop: portalMsg ? 4 : 20 }}>
                  <FloatingInput
                    label="Email"
                    value={emailForOtp}
                    onChangeText={setEmailForOtp}
                    icon="mail-outline"
                    keyboardType="email-address"
                    returnKeyType="done"
                    onSubmitEditing={() => handleRequestOtpEmail()}
                    accentColor={C.g4}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    s.btn,
                    { backgroundColor: C.g3, shadowColor: C.g3 },
                    (!emailForOtp.trim() || loading) && s.btnDisabled,
                  ]}
                  onPress={() => handleRequestOtpEmail()}
                  disabled={!emailForOtp.trim() || loading}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={[s.btnTxt, { fontFamily: F.body }]}>Envoyer le code</Text>
                      <View style={s.btnArrow}>
                        <Ionicons name="arrow-forward" size={16} color={C.g4} />
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* ── Étape 2 : saisie du code ── */}
            {otpEmailStep === 'verify' && (
              <>
                <Text style={[s.cardTitle, { fontFamily: branding.fontFamily ?? F.display }]}>
                  Code reçu
                </Text>
                <Text style={[s.cardSub, { fontFamily: F.body }]}>
                  Code envoyé à {maskedRec}. Saisissez les 6 chiffres.
                </Text>

                <View style={s.otpRow}>
                  {([0, 1, 2, 3, 4, 5] as const).map((i) => (
                    <TextInput
                      key={i}
                      ref={otpRefs[i] as any}
                      style={[
                        s.otpBox,
                        otpValues[i] ? { borderColor: C.g4 } : {},
                        Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
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

                <TouchableOpacity
                  style={[
                    s.btn,
                    { backgroundColor: C.g3, shadowColor: C.g3 },
                    (otpValues.some((d) => !d) || loading) && s.btnDisabled,
                  ]}
                  onPress={() => handleVerifyOtp()}
                  disabled={otpValues.some((d) => !d) || loading}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={[s.btnTxt, { fontFamily: F.body }]}>Confirmer</Text>
                      <View style={s.btnArrow}>
                        <Ionicons name="checkmark" size={16} color={C.g4} />
                      </View>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.linkBtn}
                  onPress={() => {
                    setOtpEmailStep('input');
                    setOtpValues(['', '', '', '', '', '']);
                  }}
                >
                  <Text style={[s.linkTxt, { color: C.g4, fontFamily: F.body }]}>
                    Renvoyer le code
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── Bas de page ── */}
        <View style={s.bottom}>
          {isCustomBranding && (
            <TouchableOpacity
              style={s.registerBtn}
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.9}
            >
              <Ionicons name="person-add-outline" size={18} color={C.g4} style={{ marginRight: 8 }} />
              <Text style={[s.registerTxt, { color: C.g3, fontFamily: F.body }]}>
                Devenir client
              </Text>
            </TouchableOpacity>
          )}

          {/* ✅ v2.2 : Switch manuel → portail principal */}
          {isCustomBranding && (
            <TouchableOpacity
              style={s.helpRow}
              onPress={() => {
                Alert.alert(
                  'Changer de portail',
                  "Accéder au portail principal Direct Transf'air (Super Admin) ?",
                  [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Portail principal', onPress: () => clearBranding() },
                  ],
                );
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="sync-outline" size={14} color="rgba(255,255,255,0.6)" />
              <Text style={[s.helpTxt, { fontFamily: F.body }]}>Portail principal</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={s.helpRow}
            onPress={() => router.push('/(auth)/assistance')}
            activeOpacity={0.75}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={14} color="rgba(255,255,255,0.6)" />
            <Text style={[s.helpTxt, { fontFamily: F.body }]}>Assistance</Text>
          </TouchableOpacity>
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
  bgBase:    { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
  bgCircle1: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(255,255,255,0.05)', top: -80, right: -80 },
  bgCircle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.04)', top: 120, left: -60 },
  scroll:    { flexGrow: 1, paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 56 : 64 },

  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },

  hero:      { alignItems: 'center', marginBottom: 24 },
  logoOuter: { width: 78, height: 78, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  logoInner: { width: 58, height: 58, borderRadius: 19, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  appName:   { fontSize: 28, color: '#FFFFFF', letterSpacing: -0.4, marginBottom: 4, textAlign: 'center' },
  tagline:   { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500', textAlign: 'center' },

  card:       { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, overflow: 'hidden', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 10, maxWidth: 520, alignSelf: 'center', width: '100%' },
  cardAccent: { height: 4, position: 'absolute', top: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  cardTitle:  { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 6, marginTop: 4 },
  cardSub:    { fontSize: 13, color: '#6B7280', fontWeight: '500', lineHeight: 19 },

  methodBtn:   { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1.5, backgroundColor: '#FAFAFA', gap: 14 },
  methodIcon:  { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  methodTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  methodDesc:  { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  btn:         { borderRadius: 16, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  btnDisabled: { opacity: 0.45 },
  btnTxt:      { color: '#FFFFFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },
  btnArrow:    { width: 30, height: 30, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },

  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 20 },
  otpBox: { width: 48, height: 58, backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 2, borderColor: '#E2E8F0', fontSize: 24, fontWeight: '900', color: '#0F172A', textAlign: 'center' },

  linkBtn: { alignItems: 'center', paddingVertical: 14 },
  linkTxt: { fontSize: 14, fontWeight: '600' },

  bottom:      { marginTop: 16, alignItems: 'center', gap: 8 },
  registerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 22, width: '100%', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  registerTxt: { fontWeight: '800', fontSize: 15 },
  helpRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  helpTxt:     { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500' },
});