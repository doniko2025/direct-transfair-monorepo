// apps/direct-transfair-mobile/app/(auth)/register.tsx
// ✅ Design « Corridor » : polices Manrope/Fraunces (composant Text) et icônes Lucide (composant Icon) — imports uniquement, logique inchangée.
// =========================================================
// REGISTER v7.0 — Direct Transf'air
// ✅ v7.1 : THÈME CLAIR — design clair via le kit components/auth v2.0 ; aucune logique modifiée.
// ✅ v7.0 : REFONTE COMPLÈTE de l'inscription — Thierno Doniko (Grand Chef).
//   PROBLÈMES CONSTATÉS :
//   1. L'écran était INATTEIGNABLE depuis l'écran de connexion (voir login-v2 v3.0).
//   2. 10 étapes d'une question chacune : parcours long et décourageant. Regroupé en
//      4 étapes logiques : Identité → Résidence → Contact → Sécurité, avec barre de
//      progression et retour possible à tout moment sans perdre la saisie.
//   3. Le « 0 » de tête du numéro (« 06… » en France) était envoyé tel quel :
//      « +33 06… » est un numéro faux, le SMS ne partait jamais. Il est maintenant
//      retiré (components/auth/PhoneField.tsx). L'indicatif suit par défaut le pays
//      de résidence et la liste couvre désormais TOUS les pays (30 avant).
//   4. Aucune vérification de l'âge ni de la date : « 31/02/2001 » passait. Date réelle
//      et âge minimal contrôlés (18 ans par défaut, réglable : EXPO_PUBLIC_MIN_AGE).
//   5. Pays de résidence et nationalité étaient pré-remplis sur « Guinée » : un client
//      pressé validait une donnée d'identité fausse. Choix obligatoire désormais.
//   6. Erreurs par pop-up : remplacées par des messages sous chaque champ ; un email ou
//      un téléphone déjà utilisé ramène directement à l'étape concernée.
//   7. Serveur en veille : l'inscription n'est jamais rejouée automatiquement (risque de
//      doublon) ; l'app attend donc que le serveur soit réveillé AVANT d'envoyer.
//   CONSERVÉ À L'IDENTIQUE : l'appel api.register() direct et la session gardée de côté
//   jusqu'au clic « Vérifier mon email » (correctif v6.3 : sans cela, le garde de navigation
//   d'AuthProvider redirigeait avant l'affichage du succès), la règle de mot de passe 10–35,
//   le format de date JJ/MM/AAAA, la redirection vers verify-contact.
// ✅ v6.1 conservé intégralement (fix outline bleu navigateur)
// ✅ v6.2 :
//   - Mot de passe limité à 10-35 caractères (maxLength sur les 2 champs +
//     validation isStepValid mise à jour + jauge de force recalibrée +
//     texte d'aide de l'étape mis à jour en conséquence).
//   - Nettoyage : suppression du <View style={ph.sep}/> et du style `sep`
//     dans PhoneStep, qui ne produisaient aucun effet visuel (width: 0).
//
// ✅ v6.3 : 🚨 FIX — pas de message de succès après inscription, écran
//    qui semble "ne rien faire" alors que le compte EST bien créé
//    (rapporté le 20/07/2026).
//
//   CAUSE RÉELLE — course de navigation avec AuthProvider :
//   handleRegister() appelait useAuth().register(), dont
//   l'implémentation (AuthProvider.tsx) appelle setUser(enrichedUser)
//   DÈS que l'inscription réussit — donc pendant que cet écran est
//   ENCORE affiché (toujours sur /(auth)/register). Or AuthProvider a
//   un garde de navigation global qui réagit à `user` :
//     if (user && inAuthGroup && !isLegalScreen && !isVerifyScreen) {
//       router.replace("/(tabs)/home");
//     }
//   Ce garde se déclenche AUSSITÔT setUser() appelé — avant même que
//   ce fichier ait pu exécuter setShowSuccess(true). Puisque le
//   compte fraîchement créé n'a pas encore l'email vérifié, un
//   DEUXIÈME garde redirige quasi instantanément de /(tabs)/home vers
//   /(auth)/verify-contact. Deux redirections en cascade se
//   produisent donc en coulisses, la SuccessModal n'a jamais la
//   moindre chance de s'afficher, et l'écran donne l'impression de
//   "ne pas réagir" — alors que le compte est bien créé côté serveur.
//
//   CORRECTIF : handleRegister() appelle désormais api.register()
//   DIRECTEMENT (appel HTTP pur, ne touche à AUCUN état global — donc
//   AuthProvider ne peut plus rediriger tant qu'on ne le lui a pas
//   explicitement demandé). Le résultat brut (access_token,
//   refresh_token, user) est gardé en state local (pendingAuth) SANS
//   être appliqué. La SuccessModal s'affiche donc normalement, sans
//   concurrence. Ce n'est QUE lorsque l'utilisateur clique sur
//   "Vérifier mon email" (handleSuccessContinue) que la session est
//   committée dans l'état global via applyLoginResult() — fonction
//   déjà exposée par AuthProvider précisément pour ce genre de cas —
//   immédiatement suivie de notre propre router.replace() vers
//   verify-contact. Même si le garde global d'AuthProvider redéclenche
//   à son tour une redirection vers la même destination à ce moment-là,
//   c'est sans effet (on y est déjà).
//   Repli conservé (cas rare où l'API ne renvoie pas de session
//   directement) : appel à useAuth().login(), lui aussi désormais
//   différé à handleSuccessContinue pour la même raison.
//   AUCUN changement dans AuthProvider.tsx ni api.ts — tout est
//   contenu dans ce fichier.
//
//   FIX SECONDAIRE : les Alert.alert() du bloc catch (erreurs
//   d'inscription) sont remplacées par showAlert() (utils/alert.ts,
//   déjà utilisé ailleurs dans l'app) — Alert.alert ne s'affiche pas
//   sur web, donc une erreur d'inscription y passait inaperçue elle
//   aussi.
// =========================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '../../components/ui/Icon';

import { useAuth }   from '../../providers/AuthProvider';
import { accountCurrencyForCountry, isOrangeMoneyCurrency, orangeHintFor, ORANGE_NOT_AVAILABLE_TEXT, validateOrangeFor } from '../../services/orangeRules';
import { api }       from '../../services/api';
import { getMinimumAge } from '../../services/serverConfig';
import { warmUpServer } from '../../services/serverWarmup';

import AuthShell, { useAuthPalette } from '../../components/auth/AuthShell';
import AuthField   from '../../components/auth/AuthField';
import AuthButton  from '../../components/auth/AuthButton';
import AuthNotice  from '../../components/auth/AuthNotice';
import SelectField from '../../components/auth/SelectField';
import PhoneField, { normalizeNationalNumber, validatePhone } from '../../components/auth/PhoneField';
import DateOfBirthField, { formatBirthDate, validateBirthDate, type Dob } from '../../components/auth/DateOfBirthField';
import PinGuide from '../../components/auth/PinGuide';
import PinInput from '../../components/auth/PinInput';
import CountryPickerSheet from '../../components/auth/CountryPickerSheet';
import { AUTH_COUNTRIES, findCountry, type AuthCountry } from '../../components/auth/authCountries';
import { describeAuthError } from '../../components/auth/authErrors';
import { PIN_LENGTH, pinProblem } from '../../components/auth/pinRules';
import { FONT, N, RADIUS } from '../../components/auth/authTheme';
import { MERCHANT_CATEGORIES, categoryLabel } from '../../components/merchant/merchantUi';
import {
  cleanText, normalizeBusinessPhone, validateBusinessAddress, validateBusinessCity, validateBusinessPhone, validatePostalCode, validateTaxId,
} from '../../utils/businessInfo';
import { RCCM_EXAMPLE, normalizeRccm, validateRccm } from '../../utils/rccm';
import { RccmDocumentPicker, type RccmPick } from '../../components/merchant/RccmDocumentPicker';

import { Text, TextInput } from '../../components/ui/Text';
import { useT } from '../../providers/I18nProvider';
import type { MessageKey } from '../../i18n/catalog';
import { themed } from '../../components/wallet/brand';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type StepKey = 'identity' | 'residence' | 'contact' | 'shop' | 'pin';

const STEP_META: Record<StepKey, { title: MessageKey; subtitle: MessageKey }> = {
  identity:  { title: 'reg.step.identity.title',  subtitle: 'reg.step.identity.sub' },
  residence: { title: 'reg.step.residence.title', subtitle: 'reg.step.residence.sub' },
  contact:   { title: 'reg.step.contact.title',   subtitle: 'reg.step.contact.sub' },
  shop:      { title: 'reg.step.shop.title',      subtitle: 'reg.step.shop.sub' },
  pin:       { title: 'reg.step.pin.title',       subtitle: 'reg.step.pin.sub' },
};

const CLIENT_STEPS: StepKey[] = ['identity', 'residence', 'contact', 'pin'];
const MERCHANT_STEPS: StepKey[] = ['identity', 'residence', 'contact', 'shop', 'pin'];

type Errors = Partial<Record<
  'firstName' | 'lastName' | 'dob' | 'nationality' | 'country' | 'city' | 'email' | 'phone' | 'password' | 'confirm' | 'terms'
  | 'businessName' | 'rccm' | 'category' | 'orangePhone'
  | 'businessAddress' | 'businessCity' | 'businessPostalCode' | 'businessPhone' | 'businessTaxId',
  string
>>;

type Session = { accessToken: string; refreshToken: string | null; user: any };

export default function RegisterScreen() {
  const { login, applyLoginResult } = useAuth();
  const router = useRouter();
  const t = useT();
  const P = useAuthPalette();
  const minAge = useMemo(() => getMinimumAge(), []);
  const params = useLocalSearchParams<{ type?: string }>();
  const isMerchant = params.type === 'merchant';
  const steps = isMerchant ? MERCHANT_STEPS : CLIENT_STEPS;
  const stepIndex = (k: StepKey) => Math.max(0, steps.indexOf(k));

  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [waking, setWaking] = useState(false);
  const [formError, setFormError] = useState<{ title?: string; message: string; action?: 'login' } | null>(null);
  const [serverErrors, setServerErrors] = useState<Errors>({});

  // ── Champs ────────────────────────────────────────────
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState<Dob>({ day: '', month: '', year: '' });
  const [nationality, setNationality] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [dialCountry, setDialCountry] = useState<AuthCountry>(findCountry('France') ?? AUTH_COUNTRIES[0]!);
  const [dialTouched, setDialTouched] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [picker, setPicker] = useState<null | 'country' | 'nationality'>(null);

  // ── Commerce (marchands) ──────────────────────────────
  const [businessName, setBusinessName] = useState('');
  const [rccm, setRccm] = useState('');
  const [rccmDoc, setRccmDoc] = useState<RccmPick | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [businessAddress, setBusinessAddress] = useState('');
  // Coordonnées du COMMERCE : saisies à part, jamais reprises de la ville / de l'adresse / du téléphone personnels.
  const [businessDistrict, setBusinessDistrict] = useState('');
  const [businessCity, setBusinessCity] = useState('');
  const [businessPostalCode, setBusinessPostalCode] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessTaxId, setBusinessTaxId] = useState('');
  const [sameOrange, setSameOrange] = useState(true);
  const [orangeCountry, setOrangeCountry] = useState<AuthCountry>(findCountry('Guinée') ?? AUTH_COUNTRIES[0]!);
  const [orangeNational, setOrangeNational] = useState('');
  // Devise du compte = celle du pays de résidence. Elle décide si Orange Money existe et quel numéro est exigé.
  const accountCurrency = accountCurrencyForCountry(country);
  const orangeAllowed = isOrangeMoneyCurrency(accountCurrency);
  useEffect(() => {
    if (accountCurrency === 'GNF') setOrangeCountry(findCountry('Guinée') ?? AUTH_COUNTRIES[0]!);
  }, [accountCurrency]);

  // ── Succès ────────────────────────────────────────────
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState<Session | null>(null);
  const [registeredUser, setRegisteredUser] = useState<{ id: string; phone: string | null } | null>(null);

  const lastNameRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // Contexte de la règle du code secret : on refuse la date de naissance et un morceau du téléphone saisis juste avant.
  const pinContext = { birthDate: formatBirthDate(dob), phone: `${dialCountry.dial}${normalizeNationalNumber(phone)}` };

  // ── Validation par étape ──────────────────────────────
  const validate = (key: StepKey): Errors => {
    const e: Errors = {};
    if (key === 'identity') {
      if (!firstName.trim()) e.firstName = t('reg.err.firstName');
      if (!lastName.trim()) e.lastName = t('reg.err.lastName');
      const d = validateBirthDate(dob, minAge);
      if (d) e.dob = d;
      if (!nationality) e.nationality = t('reg.err.nationality');
    } else if (key === 'residence') {
      if (!country) e.country = t('reg.err.country');
      if (!city.trim()) e.city = t('reg.err.city');
    } else if (key === 'contact') {
      if (!EMAIL_RE.test(email.trim())) e.email = t('reg.err.email');
      const p = validatePhone(phone);
      if (p) e.phone = p;
    } else if (key === 'shop') {
      if (businessName.trim().length < 2) e.businessName = t('reg.err.businessName');
      const rc = validateRccm(rccm);
      if (rc) e.rccm = rc;
      if (!category) e.category = t('reg.err.category');
      const ba = validateBusinessAddress(businessAddress); if (ba) e.businessAddress = ba;
      const bc = validateBusinessCity(businessCity); if (bc) e.businessCity = bc;
      const bp = validatePostalCode(businessPostalCode); if (bp) e.businessPostalCode = bp;
      const bt = validateBusinessPhone(businessPhone); if (bt) e.businessPhone = bt;
      const bx = validateTaxId(businessTaxId); if (bx) e.businessTaxId = bx;
      if (orangeAllowed) {
        const o = sameOrange ? null : validatePhone(orangeNational);
        if (o) e.orangePhone = o;
        else {
          const full = sameOrange
            ? `${dialCountry.dial}${normalizeNationalNumber(phone)}`
            : `${orangeCountry.dial}${normalizeNationalNumber(orangeNational)}`;
          const mismatch = validateOrangeFor(full, accountCurrency);
          if (mismatch) e.orangePhone = mismatch;
        }
      }
    } else if (key === 'pin') {
      if (password.length !== PIN_LENGTH) e.password = t('pinx.exactLen', { n: PIN_LENGTH });
      else {
        const weak = pinProblem(password, pinContext);
        if (weak) e.password = weak;
      }
      if (!confirm) e.confirm = t('pinx.confirmRequired');
      else if (confirm !== password) e.confirm = t('pinx.mismatch');
      if (!terms) e.terms = t('reg.err.terms');
    }
    return e;
  };

  const stepKey: StepKey = steps[step] ?? 'identity';
  const errors: Errors = showErrors ? { ...validate(stepKey), ...serverErrors } : serverErrors;
  const clearServer = (k: keyof Errors) => setServerErrors((s) => (s[k] ? { ...s, [k]: undefined } : s));

  const goBack = () => {
    setFormError(null);
    if (step === 0) {
      if (router.canGoBack()) router.back();
      else router.replace('/(auth)/login-v2');
      return;
    }
    setShowErrors(false);
    setStep(step - 1);
  };

  const goNext = () => {
    setFormError(null);
    if (Object.keys(validate(stepKey)).length > 0) { setShowErrors(true); return; }
    setShowErrors(false);
    if (step < steps.length - 1) setStep(step + 1);
    else void submit();
  };

  const pickResidence = (c: AuthCountry) => {
    setCountry(c.name);
    clearServer('country');
    if (!dialTouched) setDialCountry(c);   // l'indicatif suit le pays tant que l'utilisateur ne l'a pas choisi lui-même
    setPicker(null);
  };

  // ── Envoi ─────────────────────────────────────────────
  const submit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      // Pas de rejeu automatique d'une inscription (risque de doublon) : on s'assure d'abord que le serveur répond.
      setWaking(true);
      const alive = await warmUpServer();
      setWaking(false);
      if (!alive) {
        setFormError({ title: t('reg.err.serverDown'), message: t('reg.err.serverDownMsg') });
        return;
      }

      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: `${dialCountry.dial}${normalizeNationalNumber(phone)}`,
        country: country ?? '',
        city: city.trim(),
        nationality: nationality ?? '',
        birthDate: formatBirthDate(dob),
        ...(isMerchant
          ? {
              accountType: 'MERCHANT' as const,
              businessName: businessName.trim(),
              businessRccm: normalizeRccm(rccm),
              businessCategory: category ?? undefined,
              businessAddress: cleanText(businessAddress),
              businessCity: cleanText(businessCity),
              businessDistrict: cleanText(businessDistrict) || undefined,
              businessPostalCode: cleanText(businessPostalCode).toUpperCase() || undefined,
              businessPhone: cleanText(businessPhone) ? normalizeBusinessPhone(businessPhone) : undefined,
              businessTaxId: cleanText(businessTaxId).toUpperCase() || undefined,
              ...(orangeAllowed
                ? {
                    orangeMoneyPhone: sameOrange
                      ? `${dialCountry.dial}${normalizeNationalNumber(phone)}`
                      : `${orangeCountry.dial}${normalizeNationalNumber(orangeNational)}`,
                  }
                : {}),
            }
          : {}),
      };

      const res: any = await api.register(payload as any);

      if (res?.user) setRegisteredUser({ id: res.user.id, phone: res.user.phone ?? null });
      if (res && typeof res.access_token === 'string' && res.access_token.length > 0) {
        setPending({ accessToken: res.access_token, refreshToken: res.refresh_token ?? null, user: res.user });
      }
      setDone(true);
    } catch (e: any) {
      setWaking(false);
      const info = describeAuthError(e, 'register');
      const msg = info.message.toLowerCase();
      // Le serveur répond dans la langue de l'app : on reconnaît le sujet du message en FR, EN et PT.
      const has = (...words: string[]) => words.some((w) => msg.includes(w));
      if (info.kind === 'conflict' && has('email')) {
        setServerErrors({ email: info.message });
        setStep(stepIndex('contact'));
        setFormError({ title: info.title, message: t('reg.err.emailTaken'), action: 'login' });
      } else if (has('rccm')) {
        setServerErrors({ rccm: info.message });
        setStep(stepIndex('shop'));
        setShowErrors(true);
      } else if (has('adresse de votre commerce', 'business address', 'morada do seu comércio')) {
        setServerErrors({ businessAddress: info.message });
        setStep(stepIndex('shop'));
        setShowErrors(true);
      } else if (has('ville de votre commerce', 'business city', 'cidade do seu comércio')) {
        setServerErrors({ businessCity: info.message });
        setStep(stepIndex('shop'));
        setShowErrors(true);
      } else if (has('code postal', 'postal code', 'código postal')) {
        setServerErrors({ businessPostalCode: info.message });
        setStep(stepIndex('shop'));
        setShowErrors(true);
      } else if (has('nif / ifu')) {
        setServerErrors({ businessTaxId: info.message });
        setStep(stepIndex('shop'));
        setShowErrors(true);
      } else if (info.kind === 'conflict' && has('numéro', 'téléphone', 'number', 'phone', 'número', 'telemóvel')) {
        setServerErrors({ phone: info.message });
        setStep(stepIndex('contact'));
        setFormError({ title: info.title, message: t('reg.err.phoneTaken'), action: 'login' });
      } else if (has('numéro de téléphone invalide', 'invalid phone number', 'número de telemóvel inválido')) {
        setServerErrors({ phone: t('reg.err.phoneUnknown') });
        setStep(stepIndex('contact'));
        setShowErrors(true);
      } else {
        setFormError({ title: info.title, message: info.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Session committée ICI seulement (correctif v6.3 — voir en-tête).
  const continueToVerification = async () => {
    try {
      if (pending) await applyLoginResult(pending.accessToken, pending.refreshToken, pending.user);
      else await login({ identifier: email.trim().toLowerCase(), password });
    } catch {
      // Le compte existe : l'échec de la connexion automatique ne doit pas bloquer la suite.
    }
    // Pièce justificative du RCCM : envoyée maintenant que la session est ouverte. Un échec est sans gravité
    // (le marchand peut la renvoyer depuis les réglages de son commerce ; l'administrateur voit « document manquant »).
    if (isMerchant && rccmDoc) {
      try { await api.saveMerchantRccmDocument(rccmDoc.base64); } catch { /* renvoi possible dans les réglages */ }
    }
    if (registeredUser) {
      router.replace({
        pathname: '/(auth)/verify-contact',
        params: {
          userId: registeredUser.id,
          emailVerified: '0',
          phoneVerified: registeredUser.phone ? '0' : '1',
          hasPhone: registeredUser.phone ? '1' : '0',
        },
      } as any);
    } else {
      router.replace('/(tabs)/home' as any);
    }
  };

  // ═══════════════════════════════════════════════════════
  // ÉCRAN DE SUCCÈS
  // ═══════════════════════════════════════════════════════
  if (done) {
    return (
      <AuthShell showLang title={isMerchant ? t('reg.successMerchant') : t('reg.successClient')} subtitle={isMerchant ? t('reg.welcomeMerchant') : t('reg.welcomeClient')}>
        <View style={s.successIcon}>
          <View style={[s.successRing, { backgroundColor: P.tint, borderColor: P.tintBorder }]}>
            <Ionicons name="checkmark" size={44} color={P.action} />
          </View>
        </View>
        <Text style={s.successText}>
          {t('reg.lastStep')}
          <Text style={{ fontWeight: '800', color: N.ink }}>{email.trim().toLowerCase()}</Text>.
        </Text>
        <View style={{ height: 22 }} />
        <AuthButton label={t('reg.verifyEmail')} icon="arrow-forward" iconRight accent={P.action} onPress={continueToVerification} />
      </AuthShell>
    );
  }

  // ═══════════════════════════════════════════════════════
  // FORMULAIRE
  // ═══════════════════════════════════════════════════════
  const meta = STEP_META[stepKey];
  const isLast = step === steps.length - 1;

  return (
    <AuthShell compact showLang title={t(meta.title)} subtitle={t(meta.subtitle)} onBack={goBack}>
      {/* ── Progression ── */}
      <View style={s.progress} accessibilityLabel={t('reg.progress', { n: step + 1, total: steps.length })}>
        {steps.map((_, i) => (
          <View key={i} style={[s.progSeg, { backgroundColor: i <= step ? P.action : N.border }]} />
        ))}
      </View>
      <Text style={s.progTxt}>{t('reg.progress', { n: step + 1, total: steps.length })}</Text>

      {formError ? (
        <AuthNotice
          kind="error"
          title={formError.title}
          message={formError.message}
          actionLabel={formError.action === 'login' ? t('reg.goLogin') : undefined}
          onAction={formError.action === 'login' ? () => router.replace('/(auth)/login-v2') : undefined}
        />
      ) : null}
      {waking ? <AuthNotice kind="info" title={t('reg.waking')} message={t('reg.wakingMsg')} /> : null}

      {stepKey === 'identity' && (
        <>
          <AuthField
            label={t('reg.firstName')} icon="person-outline" value={firstName} onChangeText={setFirstName}
            error={errors.firstName} autoCapitalize="words" autoComplete="given-name" textContentType="givenName"
            returnKeyType="next" onSubmitEditing={() => lastNameRef.current?.focus()} accent={P.accent} autoFocus
          />
          <AuthField
            label={t('reg.lastName')} icon="person-circle-outline" value={lastName} onChangeText={setLastName}
            error={errors.lastName} autoCapitalize="characters" autoComplete="family-name" textContentType="familyName"
            returnKeyType="next" inputRef={lastNameRef} accent={P.accent}
          />
          <DateOfBirthField value={dob} onChange={setDob} error={errors.dob} accent={P.accent} />
          <SelectField
            label={t('reg.nationality')} icon="flag-outline" placeholder={t('reg.nationalityPh')}
            value={nationality ?? undefined} prefix={nationality ? findCountry(nationality)?.flag : undefined}
            error={errors.nationality} onPress={() => setPicker('nationality')}
          />
        </>
      )}

      {stepKey === 'residence' && (
        <>
          <SelectField
            label={t('reg.country')} icon="location-outline" placeholder={t('reg.countryPh')}
            value={country ?? undefined} prefix={country ? findCountry(country)?.flag : undefined}
            error={errors.country} onPress={() => setPicker('country')}
          />
          <AuthField
            label={t('reg.city')} icon="business-outline" value={city} onChangeText={setCity}
            error={errors.city} autoCapitalize="words" autoComplete="postal-address-locality"
            returnKeyType="next" onSubmitEditing={goNext} inputRef={cityRef} accent={P.accent}
          />
        </>
      )}

      {stepKey === 'contact' && (
        <>
          <AuthField
            label={t('reg.email')} icon="mail-outline" value={email}
            onChangeText={(v) => { setEmail(v); clearServer('email'); }}
            error={errors.email} keyboardType="email-address" autoComplete="email" textContentType="emailAddress"
            returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} accent={P.accent} autoFocus
            hint={t('reg.emailHint')}
          />
          <PhoneField
            country={dialCountry}
            onCountryChange={(c) => { setDialCountry(c); setDialTouched(true); }}
            value={phone}
            onChangeText={(v) => { setPhone(v); clearServer('phone'); }}
            error={errors.phone}
            hint={t('reg.phoneHint')}
            accent={P.accent}
            inputRef={phoneRef}
            onSubmitEditing={goNext}
          />
        </>
      )}

      {stepKey === 'shop' && (
        <>
          <AuthField
            label={t('reg.businessName')} icon="storefront-outline" value={businessName}
            onChangeText={setBusinessName} error={errors.businessName} autoCapitalize="words"
            returnKeyType="next" accent={P.accent} autoFocus maxLength={80}
          />
          <AuthField
            label={t('reg.rccm')} icon="document-text-outline" value={rccm}
            onChangeText={(v) => { setRccm(v); clearServer('rccm'); }} error={errors.rccm} autoCapitalize="characters"
            returnKeyType="next" accent={P.accent} maxLength={40} placeholder={RCCM_EXAMPLE}
            hint={t('reg.rccmHint')}
          />
          <RccmDocumentPicker value={rccmDoc} onChange={setRccmDoc} disabled={submitting} />
          <Text style={s.chipsLabel}>{t('reg.category')}</Text>
          <View style={s.chips}>
            {MERCHANT_CATEGORIES.map((c) => {
              const on = category === c;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCategory(c)}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[s.chip, on && { backgroundColor: P.action, borderColor: P.action }]}
                >
                  <Text style={[s.chipTxt, on && { color: '#FFFFFF' }]}>{categoryLabel(c)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.category ? (
            <View style={s.termsErr}>
              <Ionicons name="alert-circle" size={14} color={N.danger} />
              <Text style={s.termsErrTxt}>{errors.category}</Text>
            </View>
          ) : null}
          <View style={{ height: 14 }} />
          <AuthField
            label={t('reg.businessAddress')} icon="location-outline" value={businessAddress}
            onChangeText={(v) => { setBusinessAddress(v); clearServer('businessAddress'); }} error={errors.businessAddress}
            autoCapitalize="sentences" accent={P.accent} maxLength={160} returnKeyType="next"
            hint={t('reg.businessAddressHint')}
          />
          <AuthField
            label={t('reg.businessDistrict')} icon="map-outline" value={businessDistrict}
            onChangeText={setBusinessDistrict} autoCapitalize="words" accent={P.accent} maxLength={80} returnKeyType="next"
          />
          <AuthField
            label={t('reg.businessCity')} icon="business-outline" value={businessCity}
            onChangeText={(v) => { setBusinessCity(v); clearServer('businessCity'); }} error={errors.businessCity}
            autoCapitalize="words" accent={P.accent} maxLength={80} returnKeyType="next"
          />
          <AuthField
            label={t('reg.businessPostal')} icon="mail-outline" value={businessPostalCode}
            onChangeText={(v) => { setBusinessPostalCode(v.toUpperCase()); clearServer('businessPostalCode'); }} error={errors.businessPostalCode}
            autoCapitalize="characters" accent={P.accent} maxLength={10} returnKeyType="next"
          />
          <AuthField
            label={t('reg.businessPhone')} icon="call-outline" value={businessPhone}
            onChangeText={(v) => setBusinessPhone(v.replace(/[^\d+\s.-]/g, ''))} error={errors.businessPhone}
            keyboardType="phone-pad" accent={P.accent} maxLength={22} returnKeyType="next" placeholder="+224 620 00 00 00"
            hint={t('reg.businessPhoneHint')}
          />
          <AuthField
            label={t('reg.taxId')} icon="receipt-outline" value={businessTaxId}
            onChangeText={(v) => { setBusinessTaxId(v.toUpperCase()); clearServer('businessTaxId'); }} error={errors.businessTaxId}
            autoCapitalize="characters" accent={P.accent} maxLength={30} returnKeyType="next"
          />

          <Text style={s.chipsLabel}>{t('reg.orangeTitle')}</Text>
          {!orangeAllowed ? (
            <View style={s.termsErr}>
              <Ionicons name="information-circle" size={16} color={N.danger} />
              <Text style={[s.helpTxt, { flex: 1, marginBottom: 0 }]}>{ORANGE_NOT_AVAILABLE_TEXT(accountCurrency)}</Text>
            </View>
          ) : (
          <>
          <Text style={s.helpTxt}>{t('reg.orangeHelp')}</Text>
          <TouchableOpacity
            style={s.termsRow}
            onPress={() => setSameOrange((v) => !v)}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: sameOrange }}
          >
            <View style={[s.check, sameOrange && { backgroundColor: P.action, borderColor: P.action }]}>
              {sameOrange ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
            </View>
            <Text style={s.termsTxt}>{t('reg.orangeSame', { phone: `+${dialCountry.dial.replace('+', '')} ${normalizeNationalNumber(phone)}` })}</Text>
          </TouchableOpacity>
          {!sameOrange ? (
            <View style={{ marginTop: 14 }}>
              <PhoneField
                country={orangeCountry}
                onCountryChange={setOrangeCountry}
                value={orangeNational}
                onChangeText={(v) => { setOrangeNational(v); clearServer('orangePhone'); }}
                error={errors.orangePhone}
                hint={orangeHintFor(accountCurrency)}
                accent={P.accent}
                onSubmitEditing={goNext}
              />
            </View>
          ) : null}
          {sameOrange && errors.orangePhone ? (
            <View style={s.termsErr}>
              <Ionicons name="alert-circle" size={14} color={N.danger} />
              <Text style={s.termsErrTxt}>{errors.orangePhone}</Text>
            </View>
          ) : null}
          </>
          )}
        </>
      )}

      {stepKey === 'pin' && (
        <>
          <PinInput
            label={t('pinx.label')} value={password} onChange={(v) => { setPassword(v); clearServer('password'); }}
            onComplete={() => confirmRef.current?.focus()} accent={P.accent} error={errors.password} autoFocus testID="register-pin"
          />
          <PinGuide pin={password} context={pinContext} />
          <PinInput
            label={t('pinx.confirmLabel')} value={confirm} onChange={setConfirm} accent={P.accent}
            error={errors.confirm} noReveal inputRef={confirmRef} testID="register-pin-confirm"
          />

          <TouchableOpacity
            style={s.termsRow}
            onPress={() => setTerms((v) => !v)}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: terms }}
            accessibilityLabel={t('reg.acceptA11y')}
          >
            <View style={[s.check, terms && { backgroundColor: P.action, borderColor: P.action }, errors.terms ? { borderColor: N.danger } : null]}>
              {terms ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
            </View>
            <Text style={s.termsTxt}>
              {t('reg.accept1')}
              <Text style={[s.termsLink, { color: P.accent }]} onPress={() => router.push('/(auth)/terms')}>{t('reg.terms')}</Text>
              {t('reg.accept2')}
              <Text style={[s.termsLink, { color: P.accent }]} onPress={() => router.push('/(auth)/privacy-policy')}>{t('reg.privacy')}</Text>.
            </Text>
          </TouchableOpacity>
          {errors.terms ? (
            <View style={s.termsErr}>
              <Ionicons name="alert-circle" size={14} color={N.danger} />
              <Text style={s.termsErrTxt}>{errors.terms}</Text>
            </View>
          ) : null}
        </>
      )}

      <View style={{ height: 8 }} />
      <AuthButton
        label={isLast ? t('reg.create') : t('common.continue')}
        icon={isLast ? 'checkmark-circle' : 'arrow-forward'}
        iconRight
        accent={P.action}
        loading={submitting}
        onPress={goNext}
        testID="register-next"
      />
      {step === 0 ? (
        <View style={s.loginRow}>
          <Text style={s.loginTxt}>{t('acct.haveAccount')}</Text>
          <AuthButton label={t('login.submit')} variant="link" accent={P.accent} onPress={() => router.replace('/(auth)/login-v2')} />
        </View>
      ) : null}

      <CountryPickerSheet
        visible={picker === 'country'}
        title={t('reg.pickCountry')}
        selected={country ?? undefined}
        accent={P.accent}
        onSelect={pickResidence}
        onClose={() => setPicker(null)}
      />
      <CountryPickerSheet
        visible={picker === 'nationality'}
        title={t('reg.pickNationality')}
        selected={nationality ?? undefined}
        accent={P.accent}
        onSelect={(c) => { setNationality(c.name); setPicker(null); }}
        onClose={() => setPicker(null)}
      />
    </AuthShell>
  );
}

const s = themed(() => StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  progSeg:  { flex: 1, height: 5, borderRadius: 99 },
  progTxt:  { fontFamily: FONT.medium, fontSize: 12, fontWeight: '700', color: N.muted, marginBottom: 18 },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 },
  check: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: N.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 1, backgroundColor: N.surface,
  },
  termsTxt:  { flex: 1, fontFamily: FONT.body, fontSize: 13.5, lineHeight: 20, color: N.inkSub },
  termsLink: { fontWeight: '800', textDecorationLine: 'underline' },
  termsErr:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  termsErrTxt: { fontFamily: FONT.body, fontSize: 12.5, color: N.danger },

  loginRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' },
  loginTxt: { fontFamily: FONT.body, fontSize: 14, color: N.inkSub },

  chipsLabel: { fontFamily: FONT.medium, fontSize: 12.5, fontWeight: '700', color: N.muted, marginBottom: 8, marginTop: 6, letterSpacing: 0.2 },
  helpTxt: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19, color: N.inkSub, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: N.border, backgroundColor: N.surface, alignItems: 'center', justifyContent: 'center' },
  chipTxt: { fontFamily: FONT.medium, fontSize: 13.5, fontWeight: '700', color: N.ink },

  successIcon: { alignItems: 'center', marginVertical: 14 },
  successRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  successText: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23, color: N.inkSub, textAlign: 'center' },
}));
