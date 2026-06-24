// apps/direct-transfair-mobile/app/(auth)/login-v2.tsx
// =========================================================
// LOGIN v2.1 — 3 méthodes de connexion
// ✅ Email + mot de passe
// ✅ OTP par email (6 chiffres)
// ✅ OTP par SMS → otp-phone.tsx
// ✅ Isolation portail (SA vs société)
// ✅ Redirection vers verify-contact si non vérifié
// ✅ v2.1 : applyLoginResult() remplace storeTokens() + refreshUser()
//   PROBLÈME CORRIGÉ : storeTokens appelait api.setToken() mais ne
//   mettait pas à jour tokenRef.current dans AuthProvider.
//   refreshUser() lisait tokenRef === null → retournait tôt → guard muet.
//   CORRECTIF : applyLoginResult() hydrate correctement tout l'état
//   React (user, token, tokenRef, SecureStore) en un seul appel.
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
          onBlur={()  => setFocused(false)}
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

// ─── Écran principal ─────────────────────────────────────
export default function LoginV2Screen() {
  const { branding, isCustomBranding, loadBranding } = useTenant();
  // ✅ v2.1 : applyLoginResult() remplace storeTokens() + refreshUser()
  const { applyLoginResult, loginWithPhoneOtp } = useAuth();
  const router = useRouter();

  const C = useMemo(() => buildTheme(branding.primaryColor), [branding.primaryColor]);

  const [method,  setMethod]  = useState<Method>('CHOOSE');
  const [loading, setLoading] = useState(false);
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

  // ── Réponse login réussie ─────────────────────────────
  // ✅ v2.1 : applyLoginResult() hydrate correctement tout l'état
  // AuthProvider (user, token, tokenRef, SecureStore) en un seul appel.
  // Le guard voit le changement de `user` et redirige vers /(tabs)/home.
  const handleLoginSuccess = async (result: any) => {
    await applyLoginResult(
      result.access_token,
      result.refresh_token,
      result.user,
    );
  };

  // ── Erreur portail ────────────────────────────────────
  const handlePortalError = async (e: any) => {
    const data = e?.response?.data;

    if (data?.code === 'USE_COMPANY_PORTAL') {
      const { clientCode, subdomain, customDomain } = data;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const targetUrl = customDomain
          ? `https://${customDomain}`
          : subdomain
            ? `https://${subdomain}.direct-transfer.com`
            : null;
        if (targetUrl) {
          Alert.alert('Redirection', `Redirection vers l'espace ${clientCode ?? 'votre société'}…`, [
            { text: 'Accéder →', onPress: () => { window.location.href = targetUrl; } },
          ], { cancelable: false });
          return;
        }
      }
      if (clientCode) {
        await loadBranding(clientCode).catch(() => {});
        Alert.alert('Portail mis à jour', `L'espace "${clientCode}" est maintenant chargé. Reconnectez-vous.`);
      }
      return;
    }

    if (data?.code === 'USE_DEFAULT_PORTAL') {
      Alert.alert('Portail incorrect', "Le Super Admin se connecte via le portail principal Direct Transf'air.");
      return;
    }

    const msg = v2Auth.extractMessage(e);
    Platform.OS === 'web'
      ? alert(msg)
      : Alert.alert('Connexion échouée', msg);
  };

  // ═══════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════

  const handlePasswordLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      const result = await v2Auth.loginPassword(email, password);
      if ('requiresVerification' in result && result.requiresVerification) {
        goToVerification(result);
        return;
      }
      await handleLoginSuccess(result);
    } catch (e: any) {
      await handlePortalError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtpEmail = async () => {
    if (!emailForOtp.trim()) return;
    setLoading(true);
    try {
      const result = await v2Auth.requestOtpEmail(emailForOtp);
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
      await handlePortalError(e);
    } finally {
      setLoading(false);
    }
  };

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

  // ═══════════════════════════════════════════════════════
  // RENDU
  // ═══════════════════════════════════════════════════════

  const canSubmitPassword = email.trim().length > 0 && password.trim().length > 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.g3 }}>
      <StatusBar barStyle='light-content' backgroundColor={C.g2} />
      <View style={[s.bgBase, { backgroundColor: C.g3 }]} />
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps='handled' style={{ flex: 1, backgroundColor: 'transparent' }}>

        {/* ── Header ── */}
        {method !== 'CHOOSE' && (
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => { setMethod('CHOOSE'); setOtpEmailStep('input'); setOtpValues(['', '', '', '', '', '']); }}
            activeOpacity={0.75}
          >
            <Ionicons name='arrow-back' size={20} color='rgba(255,255,255,0.9)' />
          </TouchableOpacity>
        )}

        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={s.logoOuter}>
            <View style={s.logoInner}>
              <Ionicons name='swap-horizontal' size={28} color={C.g4} />
            </View>
          </View>
          <Text style={[s.appName, { fontFamily: branding.fontFamily ?? F.display }]}>
            {branding.name}
          </Text>
          <Text style={[s.tagline, { fontFamily: F.body }]}>
            {branding.tagline ?? 'Transferts internationaux sécurisés'}
          </Text>
        </View>

        {/* ═══════════════════════════════════════════════ */}
        {/* CARD — CHOOSE                                  */}
        {/* ═══════════════════════════════════════════════ */}
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
              {/* Email OTP */}
              <TouchableOpacity style={[s.methodBtn, { borderColor: C.g4 + '40' }]} onPress={() => setMethod('OTP_EMAIL')} activeOpacity={0.85}>
                <View style={[s.methodIcon, { backgroundColor: C.g4 + '15' }]}>
                  <Ionicons name='mail-outline' size={22} color={C.g4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.methodTitle, { fontFamily: F.body }]}>Code par email</Text>
                  <Text style={[s.methodDesc, { fontFamily: F.body }]}>Recevez un code à 6 chiffres</Text>
                </View>
                <Ionicons name='chevron-forward' size={18} color={C.g5} />
              </TouchableOpacity>

              {/* SMS OTP */}
              <TouchableOpacity style={[s.methodBtn, { borderColor: C.g4 + '40' }]} onPress={() => router.push('/(auth)/otp-phone')} activeOpacity={0.85}>
                <View style={[s.methodIcon, { backgroundColor: C.g4 + '15' }]}>
                  <Ionicons name='phone-portrait-outline' size={22} color={C.g4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.methodTitle, { fontFamily: F.body }]}>Code par SMS</Text>
                  <Text style={[s.methodDesc, { fontFamily: F.body }]}>Recevez un code à 6 chiffres</Text>
                </View>
                <Ionicons name='chevron-forward' size={18} color={C.g5} />
              </TouchableOpacity>

              {/* Mot de passe */}
              <TouchableOpacity style={[s.methodBtn, { borderColor: C.g4 + '40' }]} onPress={() => setMethod('PASSWORD')} activeOpacity={0.85}>
                <View style={[s.methodIcon, { backgroundColor: C.g4 + '15' }]}>
                  <Ionicons name='lock-closed-outline' size={22} color={C.g4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.methodTitle, { fontFamily: F.body }]}>Mot de passe</Text>
                  <Text style={[s.methodDesc, { fontFamily: F.body }]}>Email + mot de passe</Text>
                </View>
                <Ionicons name='chevron-forward' size={18} color={C.g5} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* CARD — MOT DE PASSE                            */}
        {/* ═══════════════════════════════════════════════ */}
        {method === 'PASSWORD' && (
          <View style={[s.card, { shadowColor: C.g1 }]}>
            <View style={[s.cardAccent, { backgroundColor: C.g4 }]} />
            <Text style={[s.cardTitle, { fontFamily: branding.fontFamily ?? F.display }]}>Mot de passe</Text>
            <Text style={[s.cardSub, { fontFamily: F.body }]}>Connectez-vous avec votre email et mot de passe.</Text>

            <View style={{ marginTop: 20 }}>
              <FloatingInput label='Email' value={email} onChangeText={setEmail} icon='mail-outline' keyboardType='email-address' returnKeyType='next' onSubmitEditing={() => passRef.current?.focus()} accentColor={C.g4} />
              <FloatingInput label='Mot de passe' value={password} onChangeText={setPassword} icon='lock-closed-outline' secureTextEntry returnKeyType='done' onSubmitEditing={canSubmitPassword ? handlePasswordLogin : undefined} inputRef={passRef} accentColor={C.g4} />
            </View>

            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: C.g3, shadowColor: C.g3 }, !canSubmitPassword && s.btnDisabled]} onPress={handlePasswordLogin} disabled={loading || !canSubmitPassword} activeOpacity={0.9}>
                {loading ? <ActivityIndicator color='#FFFFFF' /> : (
                  <>
                    <Text style={[s.btnTxt, { fontFamily: F.body }]}>Se connecter</Text>
                    <View style={s.btnArrow}><Ionicons name='arrow-forward' size={16} color={C.g4} /></View>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity style={s.forgotBtn} onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={[s.forgotTxt, { color: C.g4, fontFamily: F.body }]}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* CARD — OTP EMAIL                               */}
        {/* ═══════════════════════════════════════════════ */}
        {method === 'OTP_EMAIL' && (
          <View style={[s.card, { shadowColor: C.g1 }]}>
            <View style={[s.cardAccent, { backgroundColor: C.g4 }]} />

            {otpEmailStep === 'input' && (
              <>
                <Text style={[s.cardTitle, { fontFamily: branding.fontFamily ?? F.display }]}>Code par email</Text>
                <Text style={[s.cardSub, { fontFamily: F.body }]}>Saisissez votre email pour recevoir un code à 6 chiffres.</Text>
                <View style={{ marginTop: 20 }}>
                  <FloatingInput label='Email' value={emailForOtp} onChangeText={setEmailForOtp} icon='mail-outline' keyboardType='email-address' returnKeyType='done' onSubmitEditing={handleRequestOtpEmail} accentColor={C.g4} />
                </View>
                <TouchableOpacity style={[s.btn, { backgroundColor: C.g3, shadowColor: C.g3 }, (!emailForOtp.trim() || loading) && s.btnDisabled]} onPress={handleRequestOtpEmail} disabled={!emailForOtp.trim() || loading} activeOpacity={0.9}>
                  {loading ? <ActivityIndicator color='#FFFFFF' /> : (
                    <>
                      <Text style={[s.btnTxt, { fontFamily: F.body }]}>Envoyer le code</Text>
                      <View style={s.btnArrow}><Ionicons name='arrow-forward' size={16} color={C.g4} /></View>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {otpEmailStep === 'verify' && (
              <>
                <Text style={[s.cardTitle, { fontFamily: branding.fontFamily ?? F.display }]}>Code reçu</Text>
                <Text style={[s.cardSub, { fontFamily: F.body }]}>Code envoyé à {maskedRec}. Saisissez les 6 chiffres.</Text>

                <View style={s.otpRow}>
                  {([0, 1, 2, 3, 4, 5] as const).map((i) => (
                    <TextInput
                      key={i}
                      ref={otpRefs[i] as any}
                      style={[s.otpBox, otpValues[i] ? { borderColor: C.g4 } : {}, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                      value={otpValues[i]}
                      onChangeText={(t) => handleOtpChange(t, i)}
                      onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                      keyboardType='number-pad'
                      maxLength={1}
                      textAlign='center'
                      caretHidden
                      selectTextOnFocus
                      underlineColorAndroid='transparent'
                    />
                  ))}
                </View>

                <TouchableOpacity style={[s.btn, { backgroundColor: C.g3, shadowColor: C.g3 }, (otpValues.some((d) => !d) || loading) && s.btnDisabled]} onPress={() => handleVerifyOtp()} disabled={otpValues.some((d) => !d) || loading} activeOpacity={0.9}>
                  {loading ? <ActivityIndicator color='#FFFFFF' /> : (
                    <>
                      <Text style={[s.btnTxt, { fontFamily: F.body }]}>Confirmer</Text>
                      <View style={s.btnArrow}><Ionicons name='checkmark' size={16} color={C.g4} /></View>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={s.resendBtn} onPress={() => { setOtpEmailStep('input'); setOtpValues(['', '', '', '', '', '']); }}>
                  <Text style={[s.resendTxt, { color: C.g4, fontFamily: F.body }]}>Renvoyer le code</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── Bas de page ── */}
        <View style={s.bottom}>
          {isCustomBranding && (
            <TouchableOpacity style={s.registerBtn} onPress={() => router.push('/(auth)/register')} activeOpacity={0.9}>
              <Ionicons name='person-add-outline' size={18} color={C.g4} style={{ marginRight: 8 }} />
              <Text style={[s.registerTxt, { color: C.g3, fontFamily: F.body }]}>Devenir client</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.helpRow} onPress={() => router.push('/(auth)/assistance')} activeOpacity={0.75}>
            <Ionicons name='chatbubble-ellipses-outline' size={14} color='rgba(255,255,255,0.6)' />
            <Text style={[s.helpTxt, { fontFamily: F.body }]}>Assistance</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  bgBase:    { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
  bgCircle1: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(255,255,255,0.05)', top: -80, right: -80 },
  bgCircle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.04)', top: 120, left: -60 },
  scroll:    { flexGrow: 1, paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 56 : 64 },
  backBtn:   { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },

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

  resendBtn: { alignItems: 'center', paddingVertical: 14 },
  resendTxt: { fontSize: 14, fontWeight: '600' },

  forgotBtn: { alignItems: 'center', paddingVertical: 14 },
  forgotTxt: { fontSize: 13, fontWeight: '700' },

  bottom:      { marginTop: 16, alignItems: 'center', gap: 8 },
  registerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 22, width: '100%', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  registerTxt: { fontWeight: '800', fontSize: 15 },
  helpRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  helpTxt:     { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500' },
});