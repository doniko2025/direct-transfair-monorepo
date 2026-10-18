// apps/direct-transfair-mobile/app/(auth)/login-v2.tsx
// =========================================================
// LOGIN v3.0 — Direct Transf'air
// ✅ v3.2 : MISE EN PAGE — l'encadré teinté « Pas encore de compte ? » + bouton (deux blocs empilés qui allongeaient la page) devient un séparateur fin suivi du seul bouton « Créer un compte » (toujours visible dès l'ouverture). Aucune logique modifiée. Développé par Thierno Doniko (Grand Chef).
// ✅ v3.1 : THÈME CLAIR — l'écran passe au design clair via le kit components/auth v2.0 (cadre, champs, boutons) ; aucune logique modifiée.
// ✅ v3.0 : REFONTE COMPLÈTE de l'écran (design fintech + parcours) — Thierno Doniko (Grand Chef).
//   PROBLÈMES CONSTATÉS EN PRODUCTION (APK du 13/10/2026) :
//   1. « Application not found » à chaque connexion : l'app appelait une URL de
//      secours codée en dur (ancien serveur Railway supprimé). Corrigé à la racine
//      dans services/serverConfig.ts + api.ts v6.0.
//   2. Aucun moyen de créer un compte : « Devenir client » n'existait que sur
//      l'écran de CHOIX de méthode, que l'écran ne montrait jamais (la méthode par
//      défaut était « mot de passe »). Le bouton « Créer un compte » est désormais
//      visible dès l'ouverture, sans aucune manipulation.
//   3. Mot de passe plafonné à 35 caractères À LA CONNEXION : un client dont le mot
//      de passe est plus long (le serveur l'accepte) ne pouvait même plus le taper.
//      Plafond relevé (128).
//   4. Erreurs en pop-ups bruts (« Network Error ») : remplacées par des bandeaux
//      clairs dans le formulaire (components/auth/authErrors.ts).
//   5. Serveur en veille (hébergement économique) : réveil automatique dès l'ouverture,
//      pastille d'état et nouvelle tentative automatique de la connexion.
//   NOUVEAUX ÉLÉMENTS : cadre commun AuthShell, champs AuthField, boutons AuthButton,
//   code à 6 chiffres OtpCodeInput (collage / SMS automatique), message après
//   vérification ou changement de mot de passe, bouton biométrique adapté à la plateforme.
//   CONSERVÉ À L'IDENTIQUE : tous les appels API (v2Auth), la gestion des portails
//   société (USE_COMPANY_PORTAL / USE_DEFAULT_PORTAL / USE_WEB_PORTAL), la redirection
//   vers la vérification (VERIFICATION_REQUIRED), la biométrie, la navigation explicite
//   après connexion (v2.8) et la synchronisation du tenant.
// ✅ v2.9 : (phase 5) message clair « Compte réservé au portail web »
//   quand un compte agent / admin tente de se connecter sur l'app
//   mobile (403 USE_WEB_PORTAL du backend, ou refus côté AuthProvider).
// ✅ v2.8 : FIX — après connexion réussie (mot de passe ou OTP),
//    la page ne s'ouvrait pas immédiatement : il fallait rafraîchir
//    manuellement pour arriver sur /(tabs)/home.
//    CAUSE : la seule navigation post-login reposait sur le useEffect
//    de garde dans AuthProvider (basé sur segments/user/isLoading).
//    Ce pattern garde-réactif + router.replace() imperatif dans un
//    useEffect ne se déclenche pas de façon fiable juste après un
//    changement d'état groupé (setToken + setUser quasi simultanés,
//    parfois précédés d'un await applyTenant(...) dans
//    applyLoginResult) — alors qu'un remontage complet (refresh) relit
//    l'état déjà persisté en storage et navigue correctement dès le
//    premier rendu. Confirmé : le refresh fonctionnait toujours, donc
//    token/user étaient bien stockés — ce n'était pas un problème de
//    données, juste de déclenchement de la navigation.
//    CORRECTIF : navigation explicite dans handleLoginSuccess, une
//    fois applyLoginResult() totalement résolu (donc sans course
//    possible). Le garde dans AuthProvider reste en place comme filet
//    de sécurité pour les autres cas (deep link, retour d'arrière-plan,
//    biométrie). handleLoginSuccess est partagé par le login mot de
//    passe ET la vérification OTP (handleVerifyOtp) → un seul endroit
//    corrige les deux flux.
//    Aucun autre comportement touché.
// ✅ v2.7 : REFONTE VISUELLE — vide en bas comblé + modernisation
//    PROBLÈME : s.scroll utilisait flexGrow:1 sans justifyContent →
//    sur un écran plus haut que le contenu, tout l'espace en trop
//    s'accumulait après "Devenir client"/"Assistance", laissant un
//    grand vide plat en bas (fond des cercles décoratifs limité au
//    haut de l'écran, donc rien pour le combler visuellement).
//    CORRECTIFS :
//    - Contenu regroupé en 2 blocs directs du ScrollView (topGroup /
//      bottom) + justifyContent:'space-between' sur s.scroll → l'espace
//      en trop se répartit entre les deux au lieu de s'accumuler en bas.
//    - Fond : View plat → LinearGradient (dérivé de la couleur de
//      marque du tenant, comme avant — aucune régression sur le
//      white-label). Ajout d'un 3ᵉ cercle décoratif en bas d'écran
//      pour donner du relief à toute la hauteur, pas seulement le haut.
//    - btnScale (déclaré mais jamais utilisé) : câblé en retour tactile
//      (press-in/press-out) sur le CTA "Se connecter".
//    - Écran CHOOSE : ajout du bouton "Code par email" — l'écran
//      OTP_EMAIL était entièrement codé plus bas dans ce fichier mais
//      strictement inaccessible, aucun bouton ne menait vers
//      setMethod('OTP_EMAIL') nulle part.
//    Aucune logique métier touchée : mêmes handlers (login, OTP,
//    biométrie, gestion des portails), mêmes appels API, mêmes routes.
// ✅ v2.6 : Limite de longueur sur le mot de passe (cohérence avec register.tsx)
// ✅ v2.5 : fix fond jaune autofill navigateur web
// =========================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth }   from '../../providers/AuthProvider';
import { useTenant } from '../../providers/TenantProvider';
import { api }       from '../../services/api';
import { v2Auth }    from '../../services/v2-auth';
import { authRequest, useServerStatus } from '../../services/serverWarmup';

import {
  hasStoredRefreshToken,
  isBiometricsAvailable,
  getBiometricsEnabled,
} from '../../hooks/useBiometrics';

import AuthShell, { useAuthPalette } from '../../components/auth/AuthShell';
import AuthField        from '../../components/auth/AuthField';
import AuthButton       from '../../components/auth/AuthButton';
import AuthNotice       from '../../components/auth/AuthNotice';
import OtpCodeInput     from '../../components/auth/OtpCodeInput';
import ServerStatusPill from '../../components/auth/ServerStatusPill';
import { describeAuthError, type AuthErrorInfo } from '../../components/auth/authErrors';
import { FONT, N, RADIUS } from '../../components/auth/authTheme';

type View_ = 'PASSWORD' | 'OTP_REQUEST' | 'OTP_VERIFY';
type NoticeState = { kind: 'error' | 'info' | 'success' | 'warning'; title?: string; message: string } | null;

const RESEND_SECONDS = 45;           // aligné sur l'intervalle minimal imposé par le serveur
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginV2Screen() {
  const { branding, loadBranding, clearBranding } = useTenant();
  const { applyLoginResult, biometricLogin } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ verified?: string; reset?: string }>();
  const P = useAuthPalette();
  const { status: serverStatus, retry: retryServer } = useServerStatus();

  const [view, setView]       = useState<View_>('PASSWORD');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice]   = useState<NoticeState>(null);
  const [bioReady, setBioReady] = useState(false);

  // ── Mot de passe ──────────────────────────────────────
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const passRef = useRef<TextInput | null>(null);

  // ── Code par email ────────────────────────────────────
  const [otpEmail, setOtpEmail]     = useState('');
  const [otpUserId, setOtpUserId]   = useState('');
  const [otpChannel, setOtpChannel] = useState<'EMAIL' | 'SMS'>('EMAIL');
  const [maskedRec, setMaskedRec]   = useState('');
  const [otpCode, setOtpCode]       = useState('');
  const [otpWrong, setOtpWrong]     = useState(false);
  const [countdown, setCountdown]   = useState(0);

  // ── Message d'accueil (retour de vérification / réinitialisation) ──
  useEffect(() => {
    if (params.verified === '1') {
      setNotice({ kind: 'success', title: 'Compte vérifié', message: 'Votre adresse est confirmée. Connectez-vous pour continuer.' });
    } else if (params.reset === '1') {
      setNotice({ kind: 'success', title: 'Mot de passe modifié', message: 'Connectez-vous avec votre nouveau mot de passe.' });
    }
  }, [params.verified, params.reset]);

  // ── Compte à rebours du renvoi de code ────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Synchronisation du tenant ─────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (branding.code !== 'DONIKO') void api.setTenant(branding.code);
    }, [branding.code]),
  );

  // ── Biométrie ─────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const check = async () => {
        if (Platform.OS === 'web') { setBioReady(false); return; }
        try {
          const available = await isBiometricsAvailable();
          const enabled   = await getBiometricsEnabled();
          const hasToken  = await hasStoredRefreshToken();
          setBioReady(available && enabled && hasToken);
        } catch {
          setBioReady(false);
        }
      };
      void check();
    }, []),
  );

  // ─────────────────────────────────────────────────────
  // Aides
  // ─────────────────────────────────────────────────────
  const showError = (info: AuthErrorInfo) =>
    setNotice({
      kind: info.kind === 'forbidden' ? 'warning' : 'error',
      title: info.title,
      message: info.message,
    });

  const isWebPortalRequired = (e: any): boolean =>
    e?.response?.data?.code === 'USE_WEB_PORTAL' || e?.code === 'USE_WEB_PORTAL';

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

  // v2.8 — navigation explicite une fois applyLoginResult() totalement résolu
  const handleLoginSuccess = async (result: any) => {
    await applyLoginResult(result.access_token, result.refresh_token, result.user);
    router.replace('/(tabs)/home');
  };

  const onServerRetry = (attempt: number) =>
    setNotice({
      kind: 'info',
      title: 'Le serveur démarre',
      message: `Nouvelle tentative automatique (${attempt}/2)… Cela peut prendre une minute après une période d'inactivité.`,
    });

  // ── Gestion des portails société (inchangée) ──────────
  const handlePortalError = async (e: any, retryFn?: () => Promise<void>): Promise<boolean> => {
    const data = e?.response?.data;

    if (data?.code === 'USE_COMPANY_PORTAL') {
      const { clientCode, subdomain, customDomain } = data;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const targetUrl = customDomain
          ? `https://${customDomain}`
          : subdomain ? `https://${subdomain}.direct-transfer.com` : null;
        if (targetUrl) {
          setNotice({ kind: 'info', title: 'Redirection', message: `Ouverture de l'espace ${clientCode ?? 'de votre société'}…` });
          window.location.href = targetUrl;
          return true;
        }
      }
      if (clientCode) {
        try { await loadBranding(clientCode); } catch { /* branding indisponible : on continue */ }
        setNotice({ kind: 'info', message: `Espace « ${clientCode} » chargé — connexion en cours…` });
        if (retryFn) await retryFn().catch(() => undefined);
        return true;
      }
      return true;
    }

    if (data?.code === 'USE_DEFAULT_PORTAL') {
      clearBranding();
      setNotice({ kind: 'info', message: 'Portail principal chargé — connexion en cours…' });
      if (retryFn) await retryFn().catch(() => undefined);
      return true;
    }
    return false;
  };

  // ─────────────────────────────────────────────────────
  // Connexion par mot de passe
  // ─────────────────────────────────────────────────────
  const canSubmit = EMAIL_RE.test(email.trim()) && password.length > 0;

  const handlePasswordLogin = async (isRetry = false) => {
    if (!EMAIL_RE.test(email.trim())) { setEmailErr('Saisissez une adresse email valide.'); return; }
    if (!password) return;
    setEmailErr(null);
    setLoading(true);
    if (!isRetry) setNotice(null);
    try {
      const result = await authRequest(() => v2Auth.loginPassword(email.trim(), password), { onRetry: onServerRetry });
      if ('requiresVerification' in result && result.requiresVerification) {
        setNotice(null);
        goToVerification(result);
        return;
      }
      setNotice(null);
      await handleLoginSuccess(result);
    } catch (e: any) {
      if (!isRetry && (await handlePortalError(e, () => handlePasswordLogin(true)))) return;
      showError(describeAuthError(e, 'login'));
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────
  // Connexion par code envoyé par email
  // ─────────────────────────────────────────────────────
  const requestOtp = async (isRetry = false) => {
    const target = otpEmail.trim();
    if (!EMAIL_RE.test(target)) { setEmailErr('Saisissez une adresse email valide.'); return; }
    setEmailErr(null);
    setLoading(true);
    if (!isRetry) setNotice(null);
    try {
      const result = await authRequest(() => v2Auth.requestOtpEmail(target), { onRetry: onServerRetry });
      setOtpUserId(result.userId);
      setMaskedRec(result.maskedRecipient);
      setOtpChannel(result.channel === 'SMS' ? 'SMS' : 'EMAIL');
      setOtpCode('');
      setOtpWrong(false);
      setCountdown(RESEND_SECONDS);
      setNotice(null);
      setView('OTP_VERIFY');
    } catch (e: any) {
      const data = e?.response?.data;
      if (data?.code === 'VERIFICATION_REQUIRED') { goToVerification(data); return; }
      if (!isRetry && (await handlePortalError(e, () => requestOtp(true)))) return;
      showError(describeAuthError(e, 'login'));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (code: string) => {
    if (code.length < 6 || loading) return;
    setLoading(true);
    setNotice(null);
    try {
      const result = await v2Auth.verifyOtpLogin(otpUserId, code, otpChannel);
      await handleLoginSuccess(result);
    } catch (e: any) {
      const data = e?.response?.data;
      if (data?.code === 'VERIFICATION_REQUIRED') { goToVerification(data); return; }
      setOtpWrong(true);
      setOtpCode('');
      showError(describeAuthError(e, isWebPortalRequired(e) ? 'login' : 'otp'));
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    setLoading(true);
    setNotice(null);
    try {
      await biometricLogin();
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (!/annul|cancel/i.test(msg)) {
        setNotice({ kind: 'error', title: 'Biométrie', message: msg || 'Authentification biométrique échouée.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const switchView = (next: View_) => {
    setNotice(null);
    setEmailErr(null);
    setOtpCode('');
    setOtpWrong(false);
    if (next === 'OTP_REQUEST' && !otpEmail) setOtpEmail(email);
    setView(next);
  };

  // ─────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────
  const bioLabel = Platform.OS === 'ios' ? 'Face ID / Touch ID' : 'Empreinte digitale';

  const legalFooter = (
    <View style={s.legal}>
      <TouchableOpacity onPress={() => router.push('/(auth)/assistance')} accessibilityRole="link">
        <Text style={[s.legalLink, { color: P.accent }]}>Assistance</Text>
      </TouchableOpacity>
      <Text style={s.legalDot}>·</Text>
      <TouchableOpacity onPress={() => router.push('/(auth)/terms')} accessibilityRole="link">
        <Text style={s.legalLink}>Conditions</Text>
      </TouchableOpacity>
      <Text style={s.legalDot}>·</Text>
      <TouchableOpacity onPress={() => router.push('/(auth)/privacy-policy')} accessibilityRole="link">
        <Text style={s.legalLink}>Confidentialité</Text>
      </TouchableOpacity>
    </View>
  );

  const pill = <ServerStatusPill status={serverStatus} onRetry={retryServer} />;

  // ── Étape : saisie du code reçu ───────────────────────
  if (view === 'OTP_VERIFY') {
    return (
      <AuthShell
        compact
        title="Saisissez le code"
        subtitle={maskedRec ? `Un code à 6 chiffres a été envoyé à ${maskedRec}.` : 'Un code à 6 chiffres vient de vous être envoyé.'}
        onBack={() => switchView('OTP_REQUEST')}
        headerRight={pill}
        footer={legalFooter}
      >
        {notice ? <AuthNotice {...notice} /> : null}
        <OtpCodeInput
          value={otpCode}
          onChange={(c) => { setOtpCode(c); if (otpWrong) setOtpWrong(false); }}
          onComplete={verifyOtp}
          accent={P.accent}
          error={otpWrong}
          disabled={loading}
        />
        <View style={{ height: 22 }} />
        <AuthButton
          label="Valider"
          accent={P.action}
          loading={loading}
          disabled={otpCode.length < 6}
          onPress={() => verifyOtp(otpCode)}
        />
        <View style={s.centerRow}>
          {countdown > 0 ? (
            <Text style={s.hint}>Renvoyer le code dans {countdown} s</Text>
          ) : (
            <AuthButton label="Renvoyer le code" variant="link" accent={P.accent} disabled={loading} onPress={() => requestOtp()} />
          )}
        </View>
      </AuthShell>
    );
  }

  // ── Étape : demande d'un code par email ───────────────
  if (view === 'OTP_REQUEST') {
    return (
      <AuthShell
        compact
        title="Connexion par code"
        subtitle="Entrez votre email : nous vous envoyons un code à 6 chiffres, sans mot de passe."
        onBack={() => switchView('PASSWORD')}
        headerRight={pill}
        footer={legalFooter}
      >
        {notice ? <AuthNotice {...notice} /> : null}
        <AuthField
          label="Adresse email"
          icon="mail-outline"
          value={otpEmail}
          onChangeText={(t) => { setOtpEmail(t); if (emailErr) setEmailErr(null); }}
          error={emailErr}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={() => requestOtp()}
          accent={P.accent}
          autoFocus
        />
        <AuthButton
          label="Envoyer le code"
          icon="paper-plane-outline"
          iconRight
          accent={P.action}
          loading={loading}
          disabled={otpEmail.trim().length === 0}
          onPress={() => requestOtp()}
        />
      </AuthShell>
    );
  }

  // ── Écran principal : email + mot de passe ────────────
  return (
    <AuthShell
      title="Connexion"
      subtitle="Accédez à votre espace en toute sécurité."
      headerRight={pill}
      footer={legalFooter}
    >
      {notice ? <AuthNotice {...notice} /> : null}

      <AuthField
        label="Adresse email"
        icon="mail-outline"
        value={email}
        onChangeText={(t) => { setEmail(t); if (emailErr) setEmailErr(null); }}
        error={emailErr}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passRef.current?.focus()}
        accent={P.accent}
        testID="login-email"
      />
      <AuthField
        label="Mot de passe"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={canSubmit ? () => handlePasswordLogin() : undefined}
        inputRef={passRef}
        accent={P.accent}
        maxLength={128}
        testID="login-password"
      />

      <View style={s.forgotRow}>
        <AuthButton
          label="Mot de passe oublié ?"
          variant="link"
          accent={P.accent}
          onPress={() => router.push('/(auth)/forgot-password')}
        />
      </View>

      <AuthButton
        label="Se connecter"
        icon="arrow-forward"
        iconRight
        accent={P.action}
        loading={loading}
        disabled={!canSubmit}
        onPress={() => handlePasswordLogin()}
        testID="login-submit"
      />

      <View style={s.alt}>
        {bioReady ? (
          <AuthButton label={`Se connecter avec ${bioLabel}`} icon="finger-print-outline" variant="secondary" accent={P.accent} disabled={loading} onPress={handleBiometric} />
        ) : null}
        <AuthButton label="Recevoir un code par email" icon="mail-open-outline" variant="outline" accent={P.accent} disabled={loading} onPress={() => switchView('OTP_REQUEST')} />
      </View>

      {/* ── Invitation à créer un compte : visible dès l'ouverture ── */}
      <View style={s.signupDivider}>
        <View style={s.signupLine} />
        <Text style={s.signupTitle}>Pas encore de compte ?</Text>
        <View style={s.signupLine} />
      </View>
      <AuthButton
        label="Créer un compte"
        icon="person-add-outline"
        variant="outline"
        accent={P.action}
        onPress={() => router.push('/(auth)/register')}
        testID="login-register"
      />
    </AuthShell>
  );
}

const s = StyleSheet.create({
  forgotRow: { alignItems: 'flex-end', marginTop: -6, marginBottom: 10 },
  alt:       { marginTop: 14, gap: 12 },
  centerRow: { alignItems: 'center', marginTop: 14 },
  hint:      { fontFamily: FONT.body, fontSize: 13.5, color: N.muted, paddingVertical: 12 },

  signupDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, marginBottom: 14 },
  signupLine:    { flex: 1, height: 1, backgroundColor: N.border },
  signupTitle:   { fontFamily: FONT.medium, fontSize: 13, fontWeight: '700', color: N.muted },

  legal:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  legalLink: { fontFamily: FONT.body, fontSize: 12.5, color: N.muted, fontWeight: '700', paddingVertical: 6 },
  legalDot:  { color: N.muted, fontSize: 12.5 },
});
