// apps/direct-transfair-mobile/app/(auth)/forgot-password.tsx
// =========================================================
// FORGOT PASSWORD v2.0 — Direct Transf'air
// ✅ v2.0 : REFONTE COMPLÈTE de la réinitialisation — Thierno Doniko (Grand Chef).
//   🔥 CAUSE RACINE (lecture du code, auth.service.ts) : l'ancien écran appelait d'abord
//   POST /auth/verify-otp pour contrôler le code, puis POST /auth/reset-password avec le
//   MÊME code. Or verify-otp MARQUE LE CODE COMME UTILISÉ, et reset-password n'accepte que
//   les codes non utilisés : la dernière étape échouait donc à tous les coups
//   (« Impossible de modifier le mot de passe »). Le code est maintenant saisi sur le même
//   écran que le nouveau mot de passe et vérifié UNE SEULE fois, par reset-password.
//   AUTRES CORRECTIONS :
//   - règle de mot de passe alignée sur l'inscription (10–35 caractères, components/auth/passwordRules.ts) ;
//   - messages d'erreur précis (compte introuvable, code expiré, trop de demandes) au lieu d'un
//     « Erreur » générique, affichés dans le formulaire ;
//   - renvoi du code avec compte à rebours aligné sur le délai du serveur (45 s) ;
//   - serveur en veille : nouvelle tentative automatique de la recherche de compte et de l'envoi du code ;
//   - retour à la connexion avec un message de succès (login-v2 v3.0, paramètre reset=1) ;
//   - plus de pop-up (Alert) : tout est affiché dans l'écran, identique sur mobile et web.
// =========================================================

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../services/api';
import { authRequest, useServerStatus } from '../../services/serverWarmup';

import AuthShell, { useAuthPalette } from '../../components/auth/AuthShell';
import AuthField        from '../../components/auth/AuthField';
import AuthButton       from '../../components/auth/AuthButton';
import AuthNotice       from '../../components/auth/AuthNotice';
import OtpCodeInput     from '../../components/auth/OtpCodeInput';
import PasswordGuide    from '../../components/auth/PasswordGuide';
import ServerStatusPill from '../../components/auth/ServerStatusPill';
import { describeAuthError } from '../../components/auth/authErrors';
import { isPasswordAcceptable, PASSWORD_MAX, PASSWORD_MIN } from '../../components/auth/passwordRules';
import { FONT, N, RADIUS } from '../../components/auth/authTheme';

type Step = 'IDENTIFIER' | 'CHANNEL' | 'RESET';
type Channel = 'EMAIL' | 'PHONE';
type NoticeState = { kind: 'error' | 'info' | 'success' | 'warning'; title?: string; message: string } | null;

const RESEND_SECONDS = 45;   // aligné sur l'intervalle minimal imposé par le serveur entre deux codes

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const P = useAuthPalette();
  const { status: serverStatus, retry: retryServer } = useServerStatus();

  const [step, setStep]       = useState<Step>('IDENTIFIER');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice]   = useState<NoticeState>(null);

  const [identifier, setIdentifier] = useState('');
  const [idError, setIdError]       = useState<string | null>(null);
  const [userId, setUserId]         = useState<string | null>(null);
  const [channels, setChannels]     = useState<Channel[]>([]);
  const [channel, setChannel]       = useState<Channel>('EMAIL');
  const [countdown, setCountdown]   = useState(0);

  const [code, setCode]               = useState('');
  const [codeWrong, setCodeWrong]     = useState(false);
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showErrors, setShowErrors]   = useState(false);
  const confirmRef = useRef<TextInput>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const onServerRetry = (attempt: number) =>
    setNotice({ kind: 'info', title: 'Le serveur démarre', message: `Nouvelle tentative automatique (${attempt}/2)…` });

  // ── 1. Retrouver le compte ────────────────────────────
  const findAccount = async () => {
    const raw = identifier.trim();
    if (!raw) { setIdError('Saisissez votre email ou votre numéro de téléphone.'); return; }
    setIdError(null);
    setNotice(null);
    setLoading(true);
    try {
      const id = raw.includes('@') ? raw.toLowerCase() : raw;
      const res = await authRequest(() => api.findAccount(id), { onRetry: onServerRetry });
      const list = (res.channels?.length ? res.channels : ['EMAIL']) as Channel[];
      setUserId(res.userId);
      setChannels(list);
      setChannel(list[0]!);
      if (list.length > 1) {
        setNotice(null);
        setStep('CHANNEL');
      } else {
        await sendCode(res.userId, list[0]!);
      }
    } catch (e: any) {
      const info = describeAuthError(e, 'reset');
      setNotice({ kind: 'error', title: info.title, message: info.message });
    } finally {
      setLoading(false);
    }
  };

  // ── 2. Envoyer le code ────────────────────────────────
  const sendCode = async (uid: string, ch: Channel) => {
    setLoading(true);
    setNotice(null);
    try {
      await authRequest(() => api.sendOtp(uid, ch, 'PASSWORD_RESET'), { onRetry: onServerRetry });
      setChannel(ch);
      setCode('');
      setCodeWrong(false);
      setCountdown(RESEND_SECONDS);
      setStep('RESET');
    } catch (e: any) {
      const info = describeAuthError(e, 'reset');
      setNotice({ kind: 'error', title: info.title, message: info.message });
      // Compte trouvé mais code non envoyé (ex. « patientez 30 s ») : on reste sur l'étape courante.
    } finally {
      setLoading(false);
    }
  };

  // ── 3. Code + nouveau mot de passe, validés ensemble ──
  const pwdError = !isPasswordAcceptable(password) ? `Entre ${PASSWORD_MIN} et ${PASSWORD_MAX} caractères.` : null;
  const confirmError = !confirm ? 'Confirmez votre mot de passe.' : confirm !== password ? 'Les deux mots de passe ne correspondent pas.' : null;

  const resetPassword = async () => {
    setShowErrors(true);
    if (code.length < 6) { setCodeWrong(true); setNotice({ kind: 'error', message: 'Saisissez le code à 6 chiffres reçu.' }); return; }
    if (pwdError || confirmError || !userId) return;
    setLoading(true);
    setNotice(null);
    try {
      await api.resetPassword(userId, code, password);
      router.replace({ pathname: '/(auth)/login-v2', params: { reset: '1' } } as any);
    } catch (e: any) {
      const info = describeAuthError(e, 'otp');
      if (info.kind === 'validation' || info.kind === 'unknown') {
        // Code faux / expiré (400) : on vide le code, on garde le mot de passe saisi.
        setCodeWrong(true);
        setCode('');
        setNotice({
          kind: 'error',
          title: 'Code incorrect ou expiré',
          message: 'Vérifiez le code reçu, ou demandez-en un nouveau avec « Renvoyer le code ».',
        });
      } else {
        setNotice({ kind: 'error', title: info.title, message: info.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const back = () => {
    setNotice(null);
    if (step === 'RESET') { setStep(channels.length > 1 ? 'CHANNEL' : 'IDENTIFIER'); return; }
    if (step === 'CHANNEL') { setStep('IDENTIFIER'); return; }
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/login-v2');
  };

  const pill = <ServerStatusPill status={serverStatus} onRetry={retryServer} />;

  // ═══════════════════════════════════════════════════════
  // ÉTAPE 1 — identifiant
  // ═══════════════════════════════════════════════════════
  if (step === 'IDENTIFIER') {
    return (
      <AuthShell
        compact
        title="Mot de passe oublié"
        subtitle="Pas de souci : nous vous envoyons un code pour en choisir un nouveau."
        onBack={back}
        headerRight={pill}
      >
        {notice ? <AuthNotice {...notice} /> : null}
        <AuthField
          label="Email ou téléphone"
          icon="person-outline"
          value={identifier}
          onChangeText={(t) => { setIdentifier(t); if (idError) setIdError(null); }}
          error={idError}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="username"
          returnKeyType="go"
          onSubmitEditing={findAccount}
          hint="Pour un téléphone, ajoutez l'indicatif : +33612345678."
          accent={P.accent}
          autoFocus
        />
        <AuthButton
          label="Recevoir un code"
          icon="paper-plane-outline"
          iconRight
          accent={P.action}
          loading={loading}
          disabled={identifier.trim().length === 0}
          onPress={findAccount}
        />
        <View style={s.centerRow}>
          <AuthButton label="Retour à la connexion" variant="link" accent={P.accent} onPress={() => router.replace('/(auth)/login-v2')} />
        </View>
      </AuthShell>
    );
  }

  // ═══════════════════════════════════════════════════════
  // ÉTAPE 1 bis — choix du canal (email ou SMS)
  // ═══════════════════════════════════════════════════════
  if (step === 'CHANNEL') {
    const opts: Array<{ ch: Channel; icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }> = [
      { ch: 'EMAIL', icon: 'mail-outline', title: 'Par email', sub: 'Recevoir le code dans votre boîte mail' },
      { ch: 'PHONE', icon: 'chatbubble-ellipses-outline', title: 'Par SMS', sub: 'Recevoir le code sur votre téléphone' },
    ];
    return (
      <AuthShell compact title="Où envoyer le code ?" subtitle="Choisissez comment recevoir votre code de sécurité." onBack={back} headerRight={pill}>
        {notice ? <AuthNotice {...notice} /> : null}
        <View style={{ gap: 12 }}>
          {opts.filter((o) => channels.includes(o.ch)).map((o) => {
            const on = channel === o.ch;
            return (
              <TouchableOpacity
                key={o.ch}
                onPress={() => setChannel(o.ch)}
                activeOpacity={0.85}
                style={[s.choice, on && { borderColor: P.accent, backgroundColor: P.tint }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <View style={[s.choiceIcon, { backgroundColor: on ? P.action : '#E7EEEC' }]}>
                  <Ionicons name={o.icon} size={20} color={on ? '#fff' : N.inkSub} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.choiceTitle}>{o.title}</Text>
                  <Text style={s.choiceSub}>{o.sub}</Text>
                </View>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? P.accent : N.muted} />
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ height: 22 }} />
        <AuthButton label="Envoyer le code" icon="paper-plane-outline" iconRight accent={P.action} loading={loading} onPress={() => userId && sendCode(userId, channel)} />
      </AuthShell>
    );
  }

  // ═══════════════════════════════════════════════════════
  // ÉTAPE 2 — code reçu + nouveau mot de passe
  // ═══════════════════════════════════════════════════════
  return (
    <AuthShell
      compact
      title="Nouveau mot de passe"
      subtitle={channel === 'PHONE' ? 'Saisissez le code reçu par SMS, puis choisissez votre nouveau mot de passe.' : 'Saisissez le code reçu par email, puis choisissez votre nouveau mot de passe.'}
      onBack={back}
      headerRight={pill}
    >
      {notice ? <AuthNotice {...notice} /> : null}

      <Text style={s.label}>Code à 6 chiffres</Text>
      <OtpCodeInput
        value={code}
        onChange={(c) => { setCode(c); if (codeWrong) setCodeWrong(false); }}
        accent={P.accent}
        error={codeWrong}
        disabled={loading}
      />
      <View style={s.resendRow}>
        {countdown > 0 ? (
          <Text style={s.hint}>Renvoyer le code dans {countdown} s</Text>
        ) : (
          <AuthButton label="Renvoyer le code" variant="link" accent={P.accent} disabled={loading} onPress={() => userId && sendCode(userId, channel)} />
        )}
      </View>

      <AuthField
        label="Nouveau mot de passe"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        error={showErrors ? pwdError : null}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        accent={P.accent}
        maxLength={PASSWORD_MAX}
      />
      <PasswordGuide password={password} />
      <AuthField
        label="Confirmer le mot de passe"
        icon="shield-checkmark-outline"
        value={confirm}
        onChangeText={setConfirm}
        error={showErrors ? confirmError : null}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={resetPassword}
        inputRef={confirmRef}
        accent={P.accent}
        maxLength={PASSWORD_MAX}
        valid={confirm.length > 0 && confirm === password}
      />

      <AuthButton label="Modifier mon mot de passe" icon="checkmark-circle" iconRight accent={P.action} loading={loading} onPress={resetPassword} />
    </AuthShell>
  );
}

const s = StyleSheet.create({
  centerRow: { alignItems: 'center', marginTop: 14 },
  label:     { fontFamily: FONT.medium, fontSize: 13, fontWeight: '700', color: N.inkSub, marginBottom: 10 },
  resendRow: { alignItems: 'center', marginTop: 6, marginBottom: 20 },
  hint:      { fontFamily: FONT.body, fontSize: 13.5, color: N.muted, paddingVertical: 12 },

  choice: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
    borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: N.border, backgroundColor: N.field,
  },
  choiceIcon:  { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  choiceTitle: { fontFamily: FONT.medium, fontSize: 15.5, fontWeight: '800', color: N.ink },
  choiceSub:   { fontFamily: FONT.body, fontSize: 13, color: N.inkSub, marginTop: 1 },
});
