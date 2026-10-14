// apps/direct-transfair-mobile/app/(auth)/register.tsx
// =========================================================
// REGISTER v7.0 — Direct Transf'air
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

import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth }   from '../../providers/AuthProvider';
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
import PasswordGuide from '../../components/auth/PasswordGuide';
import CountryPickerSheet from '../../components/auth/CountryPickerSheet';
import { AUTH_COUNTRIES, findCountry, type AuthCountry } from '../../components/auth/authCountries';
import { describeAuthError } from '../../components/auth/authErrors';
import { isPasswordAcceptable, PASSWORD_MAX, PASSWORD_MIN } from '../../components/auth/passwordRules';
import { FONT, N, RADIUS } from '../../components/auth/authTheme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STEPS = [
  { title: 'Faisons connaissance',   subtitle: 'Vos informations d’identité, telles qu’elles figurent sur votre pièce d’identité.' },
  { title: 'Où résidez-vous ?',      subtitle: 'Votre pays de résidence détermine la devise de votre portefeuille.' },
  { title: 'Comment vous joindre ?', subtitle: 'Nous vous envoyons un code pour confirmer votre adresse email.' },
  { title: 'Sécurisez votre compte', subtitle: 'Choisissez un mot de passe solide, que vous seul connaissez.' },
] as const;

type Errors = Partial<Record<
  'firstName' | 'lastName' | 'dob' | 'nationality' | 'country' | 'city' | 'email' | 'phone' | 'password' | 'confirm' | 'terms',
  string
>>;

type Session = { accessToken: string; refreshToken: string | null; user: any };

export default function RegisterScreen() {
  const { login, applyLoginResult } = useAuth();
  const router = useRouter();
  const P = useAuthPalette();
  const minAge = useMemo(() => getMinimumAge(), []);

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

  // ── Succès ────────────────────────────────────────────
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState<Session | null>(null);
  const [registeredUser, setRegisteredUser] = useState<{ id: string; phone: string | null } | null>(null);

  const lastNameRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);

  // ── Validation par étape ──────────────────────────────
  const validate = (s: number): Errors => {
    const e: Errors = {};
    if (s === 0) {
      if (!firstName.trim()) e.firstName = 'Saisissez votre prénom.';
      if (!lastName.trim()) e.lastName = 'Saisissez votre nom de famille.';
      const d = validateBirthDate(dob, minAge);
      if (d) e.dob = d;
      if (!nationality) e.nationality = 'Choisissez votre nationalité.';
    } else if (s === 1) {
      if (!country) e.country = 'Choisissez votre pays de résidence.';
      if (!city.trim()) e.city = 'Saisissez votre ville.';
    } else if (s === 2) {
      if (!EMAIL_RE.test(email.trim())) e.email = 'Saisissez une adresse email valide.';
      const p = validatePhone(phone);
      if (p) e.phone = p;
    } else if (s === 3) {
      if (!isPasswordAcceptable(password)) e.password = `Entre ${PASSWORD_MIN} et ${PASSWORD_MAX} caractères.`;
      if (!confirm) e.confirm = 'Confirmez votre mot de passe.';
      else if (confirm !== password) e.confirm = 'Les deux mots de passe ne correspondent pas.';
      if (!terms) e.terms = 'Vous devez accepter les conditions pour continuer.';
    }
    return e;
  };

  const errors: Errors = showErrors ? { ...validate(step), ...serverErrors } : serverErrors;
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
    if (Object.keys(validate(step)).length > 0) { setShowErrors(true); return; }
    setShowErrors(false);
    if (step < STEPS.length - 1) setStep(step + 1);
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
        setFormError({ title: 'Serveur injoignable', message: 'Nous n’arrivons pas à joindre le serveur. Vérifiez votre connexion puis réessayez dans un instant.' });
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
      if (info.kind === 'conflict' && msg.includes('email')) {
        setServerErrors({ email: info.message });
        setStep(2);
        setFormError({ title: info.title, message: 'Cette adresse est déjà associée à un compte. Connectez-vous, ou utilisez une autre adresse.', action: 'login' });
      } else if (info.kind === 'conflict' && (msg.includes('numéro') || msg.includes('téléphone'))) {
        setServerErrors({ phone: info.message });
        setStep(2);
        setFormError({ title: info.title, message: 'Ce numéro est déjà associé à un compte. Connectez-vous, ou utilisez un autre numéro.', action: 'login' });
      } else if (msg.includes('numéro de téléphone invalide')) {
        setServerErrors({ phone: 'Ce numéro n’est pas reconnu. Vérifiez l’indicatif et le numéro.' });
        setStep(2);
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
      <AuthShell title="Compte créé" subtitle="Bienvenue ! Votre espace est prêt.">
        <View style={s.successIcon}>
          <View style={[s.successRing, { backgroundColor: P.tint, borderColor: P.tintBorder }]}>
            <Ionicons name="checkmark" size={44} color={P.action} />
          </View>
        </View>
        <Text style={s.successText}>
          Dernière étape : confirmez votre adresse email.{'\n'}Nous venons de vous envoyer un code à 6 chiffres à{' '}
          <Text style={{ fontWeight: '800', color: N.ink }}>{email.trim().toLowerCase()}</Text>.
        </Text>
        <View style={{ height: 22 }} />
        <AuthButton label="Vérifier mon email" icon="arrow-forward" iconRight accent={P.action} onPress={continueToVerification} />
      </AuthShell>
    );
  }

  // ═══════════════════════════════════════════════════════
  // FORMULAIRE
  // ═══════════════════════════════════════════════════════
  const meta = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  return (
    <AuthShell compact title={meta.title} subtitle={meta.subtitle} onBack={goBack}>
      {/* ── Progression ── */}
      <View style={s.progress} accessibilityLabel={`Étape ${step + 1} sur ${STEPS.length}`}>
        {STEPS.map((_, i) => (
          <View key={i} style={[s.progSeg, { backgroundColor: i <= step ? P.action : '#E3EBE8' }]} />
        ))}
      </View>
      <Text style={s.progTxt}>Étape {step + 1} sur {STEPS.length}</Text>

      {formError ? (
        <AuthNotice
          kind="error"
          title={formError.title}
          message={formError.message}
          actionLabel={formError.action === 'login' ? 'Aller à la connexion' : undefined}
          onAction={formError.action === 'login' ? () => router.replace('/(auth)/login-v2') : undefined}
        />
      ) : null}
      {waking ? <AuthNotice kind="info" title="Le serveur démarre" message="Quelques secondes après une période d’inactivité, merci de patienter…" /> : null}

      {step === 0 && (
        <>
          <AuthField
            label="Prénom" icon="person-outline" value={firstName} onChangeText={setFirstName}
            error={errors.firstName} autoCapitalize="words" autoComplete="given-name" textContentType="givenName"
            returnKeyType="next" onSubmitEditing={() => lastNameRef.current?.focus()} accent={P.accent} autoFocus
          />
          <AuthField
            label="Nom de famille" icon="person-circle-outline" value={lastName} onChangeText={setLastName}
            error={errors.lastName} autoCapitalize="characters" autoComplete="family-name" textContentType="familyName"
            returnKeyType="next" inputRef={lastNameRef} accent={P.accent}
          />
          <DateOfBirthField value={dob} onChange={setDob} error={errors.dob} accent={P.accent} />
          <SelectField
            label="Nationalité" icon="flag-outline" placeholder="Choisir une nationalité"
            value={nationality ?? undefined} prefix={nationality ? findCountry(nationality)?.flag : undefined}
            error={errors.nationality} onPress={() => setPicker('nationality')}
          />
        </>
      )}

      {step === 1 && (
        <>
          <SelectField
            label="Pays de résidence" icon="location-outline" placeholder="Choisir votre pays"
            value={country ?? undefined} prefix={country ? findCountry(country)?.flag : undefined}
            error={errors.country} onPress={() => setPicker('country')}
          />
          <AuthField
            label="Ville" icon="business-outline" value={city} onChangeText={setCity}
            error={errors.city} autoCapitalize="words" autoComplete="postal-address-locality"
            returnKeyType="next" onSubmitEditing={goNext} inputRef={cityRef} accent={P.accent}
          />
        </>
      )}

      {step === 2 && (
        <>
          <AuthField
            label="Adresse email" icon="mail-outline" value={email}
            onChangeText={(t) => { setEmail(t); clearServer('email'); }}
            error={errors.email} keyboardType="email-address" autoComplete="email" textContentType="emailAddress"
            returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} accent={P.accent} autoFocus
            hint="Elle vous servira à vous connecter et à recevoir vos confirmations."
          />
          <PhoneField
            country={dialCountry}
            onCountryChange={(c) => { setDialCountry(c); setDialTouched(true); }}
            value={phone}
            onChangeText={(t) => { setPhone(t); clearServer('phone'); }}
            error={errors.phone}
            hint="Sans le 0 de tête. Utilisé pour sécuriser votre compte."
            accent={P.accent}
            inputRef={phoneRef}
            onSubmitEditing={goNext}
          />
        </>
      )}

      {step === 3 && (
        <>
          <AuthField
            label="Mot de passe" icon="lock-closed-outline" value={password} onChangeText={setPassword}
            error={errors.password} secure autoComplete="new-password" textContentType="newPassword"
            returnKeyType="next" onSubmitEditing={() => confirmRef.current?.focus()} inputRef={passRef}
            accent={P.accent} maxLength={PASSWORD_MAX} autoFocus
          />
          <PasswordGuide password={password} />
          <AuthField
            label="Confirmer le mot de passe" icon="shield-checkmark-outline" value={confirm} onChangeText={setConfirm}
            error={errors.confirm} secure autoComplete="new-password" textContentType="newPassword"
            returnKeyType="done" inputRef={confirmRef} accent={P.accent} maxLength={PASSWORD_MAX}
            valid={confirm.length > 0 && confirm === password}
          />

          <TouchableOpacity
            style={s.termsRow}
            onPress={() => setTerms((v) => !v)}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: terms }}
            accessibilityLabel="J'accepte les conditions générales et la politique de confidentialité"
          >
            <View style={[s.check, terms && { backgroundColor: P.action, borderColor: P.action }, errors.terms ? { borderColor: N.danger } : null]}>
              {terms ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
            </View>
            <Text style={s.termsTxt}>
              J’accepte les{' '}
              <Text style={[s.termsLink, { color: P.accent }]} onPress={() => router.push('/(auth)/terms')}>conditions générales</Text>
              {' '}et la{' '}
              <Text style={[s.termsLink, { color: P.accent }]} onPress={() => router.push('/(auth)/privacy-policy')}>politique de confidentialité</Text>.
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
        label={isLast ? 'Créer mon compte' : 'Continuer'}
        icon={isLast ? 'checkmark-circle' : 'arrow-forward'}
        iconRight
        accent={P.action}
        loading={submitting}
        onPress={goNext}
        testID="register-next"
      />
      {step === 0 ? (
        <View style={s.loginRow}>
          <Text style={s.loginTxt}>Vous avez déjà un compte ?</Text>
          <AuthButton label="Se connecter" variant="link" accent={P.accent} onPress={() => router.replace('/(auth)/login-v2')} />
        </View>
      ) : null}

      <CountryPickerSheet
        visible={picker === 'country'}
        title="Pays de résidence"
        selected={country ?? undefined}
        accent={P.accent}
        onSelect={pickResidence}
        onClose={() => setPicker(null)}
      />
      <CountryPickerSheet
        visible={picker === 'nationality'}
        title="Nationalité"
        selected={nationality ?? undefined}
        accent={P.accent}
        onSelect={(c) => { setNationality(c.name); setPicker(null); }}
        onClose={() => setPicker(null)}
      />
    </AuthShell>
  );
}

const s = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  progSeg:  { flex: 1, height: 5, borderRadius: 99 },
  progTxt:  { fontFamily: FONT.medium, fontSize: 12, fontWeight: '700', color: N.muted, marginBottom: 18 },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 },
  check: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: '#B8C7C2',
    alignItems: 'center', justifyContent: 'center', marginTop: 1, backgroundColor: N.surface,
  },
  termsTxt:  { flex: 1, fontFamily: FONT.body, fontSize: 13.5, lineHeight: 20, color: N.inkSub },
  termsLink: { fontWeight: '800', textDecorationLine: 'underline' },
  termsErr:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  termsErrTxt: { fontFamily: FONT.body, fontSize: 12.5, color: N.danger },

  loginRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' },
  loginTxt: { fontFamily: FONT.body, fontSize: 14, color: N.inkSub },

  successIcon: { alignItems: 'center', marginVertical: 14 },
  successRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  successText: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23, color: N.inkSub, textAlign: 'center' },
});
