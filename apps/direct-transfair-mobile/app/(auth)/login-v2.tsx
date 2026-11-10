// apps/direct-transfair-mobile/app/(auth)/login-v2.tsx
// ✅ v4.1 : ÉCRAN ÉPURÉ — plus de mention « Connexion chiffrée » (ni dans la carte ni sous elle) ; « Code oublié ? » est le seul lien sous le code
//    (il ouvre une fenêtre : réception du code par email ou par SMS) ; les deux boutons « Empreinte digitale » / « Email et mot de passe » sont
//    remplacés par un seul lien « Autres options de connexion » (fenêtre : empreinte, code reçu par email, email + mot de passe ↔ téléphone + code).
//    Le logo de la société s'affiche en tête (AuthShell v2.8). Logique de connexion inchangée.
// ✅ v4.0 (lot 13) : connexion PAR DÉFAUT = numéro de téléphone (indicatif + numéro) + code secret à 6 chiffres (connexion automatique au 6e chiffre).
//    « Email et mot de passe » devient une OPTION (lien sous le bouton) ; « Empreinte digitale » est une OPTION visible dès qu'elle est activée sur l'appareil,
//    et l'appli propose de l'activer après une première connexion réussie. Le dernier numéro et le dernier indicatif sont mémorisés sur l'appareil.
//    Appels API, portails société, vérification de contact et connexion par code reçu : inchangés.
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// ✅ phase 7 : code plateforme et domaine des portails lus dans services/platformConfig.ts (plus de « DONIKO » ni de domaine en dur).
// LOGIN v3.8 — Direct Transf'air
// ✅ v3.8 : REDESIGN de l'écran principal — carte blanche plus compacte (champs et boutons `dense`, titre plus petit : cadre AuthShell v2.7), fond animé
//    (halos + corridor d'étincelles), pastille « Connexion chiffrée » sous la carte. Logique, champs, testID et parcours OTP inchangés.
// ✅ v3.7 : « Code par email » et « Mot de passe oublié ? » sur la MÊME ligne (sous le mot de passe) — carte plus compacte. « Biométrie » passe sous le bouton (si disponible).
// ✅ v3.6 : adapté au nouveau cadre (carte flottante sur dégradé) — titre « Connexion », « Pas encore de compte ? Créer un compte » et liens légaux placés
//    SOUS la carte en clair (prop `below`). Logique, champs et testID inchangés (login-register conservé).
// ✅ v3.5b : le cadre « logo centré » est désormais celui par défaut d'AuthShell (prop `hero` retirée ici).
// ✅ v3.5 : écran ÉPURÉ — plus de titre ni de phrase d'accroche : grande tuile « t’ » (icône de l'app) + nom, formulaire, un bouton fort,
//   « Code par email » / « Biométrie » en liens discrets, « Créer un compte » en bouton contour ; mention « Connexion chiffrée » retirée ici.
// ✅ v3.4 : NOUVELLE MISE EN PAGE (bandeau + feuille blanche).
// ✅ v3.4 : NOUVELLE MISE EN PAGE de l'écran principal (téléphone) — bandeau aux couleurs de la société avec la marque et un titre d'accueil,
//   feuille blanche pour le formulaire, un seul bouton d'action fort, « code par email » et biométrie côte à côte, « Créer un compte » en
//   lien sous le bouton. Aucune logique modifiée (mêmes appels, mêmes champs, mêmes testID). Étapes OTP : cadre habituel.
// ✅ v3.3 : la pastille « Hors ligne » disparaît dès que le serveur répond (même par un refus, ex. compte réservé au portail web).
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
import { Alert, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '../../components/ui/Icon';

import { useAuth }   from '../../providers/AuthProvider';
import { useTenant } from '../../providers/TenantProvider';
import { api }       from '../../services/api';
import { isPlatformCode, getPortalBaseDomain } from '../../services/platformConfig';
import { v2Auth }    from '../../services/v2-auth';
import { authRequest, useServerStatus } from '../../services/serverWarmup';

import {
  hasStoredRefreshToken,
  isBiometricsAvailable,
  getBiometricsEnabled,
  setBiometricsEnabled,
} from '../../hooks/useBiometrics';

import AuthShell, { useAuthPalette } from '../../components/auth/AuthShell';
import AuthField        from '../../components/auth/AuthField';
import PinInput from '../../components/auth/PinInput';
import PhoneField, { normalizeNationalNumber, validatePhone } from '../../components/auth/PhoneField';
import { AUTH_COUNTRIES, findCountry, type AuthCountry } from '../../components/auth/authCountries';
import { PIN_LENGTH } from '../../components/auth/pinRules';
import AuthButton       from '../../components/auth/AuthButton';
import AuthNotice       from '../../components/auth/AuthNotice';
import OtpCodeInput     from '../../components/auth/OtpCodeInput';
import ServerStatusPill from '../../components/auth/ServerStatusPill';
import { describeAuthError, type AuthErrorInfo } from '../../components/auth/authErrors';
import { FONT, N, RADIUS } from '../../components/auth/authTheme';
import { ForgotCodeModal, LoginOptionsModal } from '../../components/auth/LoginModals';
import { useT } from '../../providers/I18nProvider';

import { Text, TextInput } from '../../components/ui/Text';
type View_ = 'PASSWORD' | 'OTP_REQUEST' | 'OTP_VERIFY';
type Method = 'PHONE' | 'EMAIL';

const LAST_PHONE_KEY   = 'dt_last_login_phone';
const LAST_COUNTRY_KEY = 'dt_last_login_country';
const BIO_ASKED_KEY    = 'dt_bio_proposal_done';
type NoticeState = { kind: 'error' | 'info' | 'success' | 'warning'; title?: string; message: string } | null;

const RESEND_SECONDS = 45;           // aligné sur l'intervalle minimal imposé par le serveur
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginV2Screen() {
  const { branding, loadBranding, clearBranding } = useTenant();
  const { applyLoginResult, biometricLogin } = useAuth();
  const router = useRouter();
  const t = useT();
  const params = useLocalSearchParams<{ verified?: string; reset?: string }>();
  const P = useAuthPalette();
  const { status: serverStatus, retry: retryServer, markReady } = useServerStatus();

  const [view, setView]       = useState<View_>('PASSWORD');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice]   = useState<NoticeState>(null);
  const [bioReady, setBioReady] = useState(false);
  const [forgotOpen, setForgotOpen]   = useState(false);   // fenêtre « Code oublié ? »
  const [optionsOpen, setOptionsOpen] = useState(false);   // fenêtre « Autres options de connexion »

  // ── Méthode de connexion : téléphone + code (défaut) ou email + mot de passe (option) ──
  const [method, setMethod]       = useState<Method>('PHONE');
  const [country, setCountry]     = useState<AuthCountry>(findCountry('France') ?? AUTH_COUNTRIES[0]!);
  const [phone, setPhone]         = useState('');
  const [phoneErr, setPhoneErr]   = useState<string | null>(null);
  const [pin, setPin]             = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [emailErr, setEmailErr]   = useState<string | null>(null);
  const passRef = useRef<TextInput | null>(null);

  // Dernier numéro et dernier indicatif utilisés sur cet appareil
  useEffect(() => {
    (async () => {
      try {
        const [p, c] = await Promise.all([AsyncStorage.getItem(LAST_PHONE_KEY), AsyncStorage.getItem(LAST_COUNTRY_KEY)]);
        if (c) { const found = findCountry(c); if (found) setCountry(found); }
        if (p) setPhone(p);
      } catch { /* mémoire locale indisponible : on part d'un formulaire vide */ }
    })();
  }, []);

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
      setNotice({ kind: 'success', title: t('login.verified.title'), message: t('login.verified.msg') });
    } else if (params.reset === '1') {
      setNotice({ kind: 'success', title: t('login.reset.title'), message: t('login.reset.msg') });
    }
  }, [params.verified, params.reset, t]);

  // ── Compte à rebours du renvoi de code ────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Synchronisation du tenant ─────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!isPlatformCode(branding.code)) void api.setTenant(branding.code);
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
  const showError = (info: AuthErrorInfo) => {
    // Une réponse HTTP (même un refus) prouve que le serveur est joignable : on efface « Hors ligne ».
    if (info.code || (info.status !== undefined && info.status !== 502 && info.status !== 503 && info.status !== 504)) markReady();
    setNotice({
      kind: info.kind === 'forbidden' ? 'warning' : 'error',
      title: info.title,
      message: info.message,
    });
  };

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
    void proposeBiometrics();
  };

  // Lot 13 : après une connexion réussie, propose UNE fois d'activer l'empreinte digitale (option, refusable).
  const proposeBiometrics = async () => {
    try {
      if (Platform.OS === 'web') return;
      if ((await AsyncStorage.getItem(BIO_ASKED_KEY)) === '1') return;
      if (!(await isBiometricsAvailable()) || (await getBiometricsEnabled())) return;
      await AsyncStorage.setItem(BIO_ASKED_KEY, '1');
      Alert.alert(
        t('login.bio.faster'),
        t('login.bio.proposal', { method: bioLabel.toLowerCase() }),
        [
          { text: t('common.later'), style: 'cancel' },
          { text: t('common.enable'), onPress: () => { void setBiometricsEnabled(true); } },
        ],
      );
    } catch { /* proposition facultative */ }
  };

  const onServerRetry = (attempt: number) =>
    setNotice({
      kind: 'info',
      title: t('login.server.wakingTitle'),
      message: t('login.server.wakingMsg', { attempt }),
    });

  // ── Gestion des portails société (inchangée) ──────────
  const handlePortalError = async (e: any, retryFn?: () => Promise<void>): Promise<boolean> => {
    const data = e?.response?.data;

    if (data?.code === 'USE_COMPANY_PORTAL') {
      const { clientCode, subdomain, customDomain } = data;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const targetUrl = customDomain
          ? `https://${customDomain}`
          : subdomain && getPortalBaseDomain() ? `https://${subdomain}.${getPortalBaseDomain()}` : null;
        if (targetUrl) {
          setNotice({ kind: 'info', title: t('login.portal.redirectTitle'), message: t('login.portal.opening', { name: clientCode ?? t('login.portal.yourCompany') }) });
          window.location.href = targetUrl;
          return true;
        }
      }
      if (clientCode) {
        try { await loadBranding(clientCode); } catch { /* branding indisponible : on continue */ }
        setNotice({ kind: 'info', message: t('login.portal.loaded', { code: clientCode }) });
        if (retryFn) await retryFn().catch(() => undefined);
        return true;
      }
      return true;
    }

    if (data?.code === 'USE_DEFAULT_PORTAL') {
      clearBranding();
      setNotice({ kind: 'info', message: t('login.portal.default') });
      if (retryFn) await retryFn().catch(() => undefined);
      return true;
    }
    return false;
  };

  // ─────────────────────────────────────────────────────
  // Connexion : téléphone + code (défaut) ou email + mot de passe (option)
  // ─────────────────────────────────────────────────────
  const fullPhone = `${country.dial}${normalizeNationalNumber(phone)}`;
  const canSubmit = method === 'PHONE'
    ? validatePhone(phone) === null && pin.length === PIN_LENGTH
    : EMAIL_RE.test(email.trim()) && password.length > 0;

  // `secret` : le code qui vient d'être complété (le state n'est pas encore à jour à cet instant).
  const handleLogin = async (isRetry = false, secret?: string) => {
    const value = secret ?? (method === 'PHONE' ? pin : password);
    if (method === 'PHONE') {
      const problem = validatePhone(phone);
      if (problem) { setPhoneErr(problem); return; }
      setPhoneErr(null);
    } else if (!EMAIL_RE.test(email.trim())) {
      setEmailErr(t('login.emailInvalid'));
      return;
    } else {
      setEmailErr(null);
    }
    if (!value) return;
    setLoading(true);
    if (!isRetry) setNotice(null);
    try {
      const result = await authRequest(
        () => (method === 'PHONE' ? v2Auth.loginPhone(fullPhone, value) : v2Auth.loginPassword(email.trim(), value)),
        { onRetry: onServerRetry },
      );
      if ('requiresVerification' in result && result.requiresVerification) {
        setNotice(null);
        goToVerification(result);
        return;
      }
      setNotice(null);
      if (method === 'PHONE') {
        void AsyncStorage.multiSet([[LAST_PHONE_KEY, phone], [LAST_COUNTRY_KEY, country.name]]).catch(() => undefined);
      }
      await handleLoginSuccess(result);
    } catch (e: any) {
      if (method === 'PHONE') setPin('');
      if (!isRetry && (await handlePortalError(e, () => handleLogin(true, value)))) return;
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
    if (!EMAIL_RE.test(target)) { setEmailErr(t('login.emailInvalid')); return; }
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
        setNotice({ kind: 'error', title: t('login.bio.title'), message: msg || t('login.bio.failed') });
      }
    } finally {
      setLoading(false);
    }
  };

  const switchView = (next: View_) => {
    setNotice(null);
    setEmailErr(null);
    setPhoneErr(null);
    setOtpCode('');
    setOtpWrong(false);
    if (next === 'OTP_REQUEST' && !otpEmail) setOtpEmail(email);
    setView(next);
  };

  // ─────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────
  const bioLabel = Platform.OS === 'ios' ? t('login.bio.ios') : t('login.bio.android');

  const legalFooter = (
    <View style={s.legal}>
      <TouchableOpacity onPress={() => router.push('/(auth)/assistance')} accessibilityRole="link">
        <Text style={s.legalLink}>{t('login.legal.help')}</Text>
      </TouchableOpacity>
      <Text style={s.legalDot}>·</Text>
      <TouchableOpacity onPress={() => router.push('/(auth)/terms')} accessibilityRole="link">
        <Text style={s.legalLink}>{t('login.legal.terms')}</Text>
      </TouchableOpacity>
      <Text style={s.legalDot}>·</Text>
      <TouchableOpacity onPress={() => router.push('/(auth)/privacy-policy')} accessibilityRole="link">
        <Text style={s.legalLink}>{t('login.legal.privacy')}</Text>
      </TouchableOpacity>
    </View>
  );

  // Sous la carte (écran principal) : inscription + liens légaux, en clair sur le fond
  const signupBelow = (
    <View style={{ alignItems: 'center' }}>
      <View style={s.signup}>
        <Text style={s.signupTxt}>{t('login.noAccount')}</Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/account-type')} accessibilityRole="button" accessibilityLabel={t('login.createAccount')} testID="login-register">
          <Text style={s.signupLink}>{t('login.createAccount')}</Text>
        </TouchableOpacity>
      </View>
      {legalFooter}
    </View>
  );

  const pill = <ServerStatusPill status={serverStatus} onRetry={retryServer} />;

  // ── Étape : saisie du code reçu ───────────────────────
  if (view === 'OTP_VERIFY') {
    return (
      <AuthShell
        compact
        title={t('otp.enterCode')}
        subtitle={maskedRec ? t('otp.sentTo', { to: maskedRec }) : t('otp.sentJustNow')}
        onBack={() => switchView('OTP_REQUEST')}
        headerRight={pill}
        below={legalFooter}
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
          label={t('otp.validate')}
          accent={P.action}
          loading={loading}
          disabled={otpCode.length < 6}
          onPress={() => verifyOtp(otpCode)}
        />
        <View style={s.centerRow}>
          {countdown > 0 ? (
            <Text style={s.hint}>{t('otp.resendIn', { seconds: countdown })}</Text>
          ) : (
            <AuthButton label={t('otp.resend')} variant="link" accent={P.accent} disabled={loading} onPress={() => requestOtp()} />
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
        title={t('otp.byCodeTitle')}
        subtitle={t('otp.byCodeSubtitle')}
        onBack={() => switchView('PASSWORD')}
        headerRight={pill}
        below={legalFooter}
      >
        {notice ? <AuthNotice {...notice} /> : null}
        <AuthField
          label={t('login.email.label')}
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
          label={t('otp.sendCode')}
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

  // ── Écran principal : téléphone + code secret (défaut) — email + mot de passe en option ──
  const switchMethod = (next: Method) => {
    setNotice(null);
    setEmailErr(null);
    setPhoneErr(null);
    setPin('');
    setPassword('');
    setMethod(next);
  };

  return (
    <AuthShell
      sea
      title={t('login.title')}
      headerRight={pill}
      below={signupBelow}
      trust={false}
    >
      {notice ? <AuthNotice {...notice} /> : null}

      {method === 'PHONE' ? (
        <>
          <PhoneField
            country={country}
            onCountryChange={setCountry}
            value={phone}
            onChangeText={(t) => { setPhone(t); if (phoneErr) setPhoneErr(null); }}
            error={phoneErr}
            accent={P.accent}
            dense
          />
          <PinInput
            dense
            label={t('login.pin.label')}
            value={pin}
            onChange={setPin}
            onComplete={(code) => { if (validatePhone(phone) === null) void handleLogin(false, code); else setPhoneErr(validatePhone(phone)); }}
            accent={P.accent}
            disabled={loading}
            testID="login-pin"
          />
        </>
      ) : (
        <>
          <AuthField
            label={t('login.email.label')}
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
            dense
            testID="login-email"
          />
          <AuthField
            label={t('login.password.label')}
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secure
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={canSubmit ? () => handleLogin() : undefined}
            inputRef={passRef}
            accent={P.accent}
            maxLength={128}
            dense
            testID="login-password"
          />
        </>
      )}

      <View style={s.forgotRow}>
        <AuthButton label={t('login.forgot')} variant="link" dense accent={P.accent} disabled={loading} onPress={() => setForgotOpen(true)} testID="login-forgot" />
      </View>

      <AuthButton
        label={t('login.submit')}
        icon="arrow-forward"
        iconRight
        dense
        accent={P.action}
        loading={loading}
        disabled={!canSubmit}
        onPress={() => handleLogin()}
        testID="login-submit"
      />

      {/* Un seul lien : le détail des autres façons de se connecter s'ouvre dans une fenêtre. */}
      <View style={s.optionsBox}>
        <AuthButton label={t('login.otherOptions')} variant="link" dense accent={P.accent} disabled={loading} onPress={() => setOptionsOpen(true)} testID="login-other-options" />
      </View>

      <ForgotCodeModal
        visible={forgotOpen}
        onClose={() => setForgotOpen(false)}
        onPick={(channel) => { setForgotOpen(false); router.push({ pathname: '/(auth)/forgot-password', params: { channel } } as any); }}
      />
      <LoginOptionsModal
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        method={method}
        biometricLabel={bioReady ? bioLabel : null}
        onBiometric={() => { setOptionsOpen(false); void handleBiometric(); }}
        onEmailCode={() => { setOptionsOpen(false); switchView('OTP_REQUEST'); }}
        onSwitchMethod={() => { setOptionsOpen(false); switchMethod(method === 'PHONE' ? 'EMAIL' : 'PHONE'); }}
      />
    </AuthShell>
  );
}

const s = StyleSheet.create({
  forgotRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: -4, marginBottom: 4 },
  optionsBox:{ alignItems: 'center', marginTop: 10 },
  optionBtn: { flexGrow: 1, flexBasis: '45%', minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
               paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#E8E8E8', backgroundColor: '#F2F2F2' },
  optionTxt: { fontFamily: FONT.body, fontSize: 14, fontWeight: '600', color: '#111111', textAlign: 'center', flexShrink: 1 },
  centerRow: { alignItems: 'center', marginTop: 14 },
  hint:      { fontFamily: FONT.body, fontSize: 13.5, color: N.muted, paddingVertical: 12 },

  legal:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  legalLink: { fontFamily: FONT.body, fontSize: 12, color: '#6B6B6B', fontWeight: '700', paddingVertical: 6 },
  legalDot:  { color: '#B5B5B5', fontSize: 12.5 },
  trust:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999,
               backgroundColor: '#F2F2F2', borderWidth: 1, borderColor: '#E8E8E8' },
  trustTxt:  { fontFamily: FONT.body, fontSize: 11.5, color: '#6B6B6B', fontWeight: '600' },
  signup:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  signupTxt: { fontFamily: FONT.body, fontSize: 13.5, color: '#6B6B6B' },
  signupLink:{ fontFamily: FONT.body, fontSize: 13.5, fontWeight: '800', color: '#111111', textDecorationLine: 'underline', paddingVertical: 8 },
});