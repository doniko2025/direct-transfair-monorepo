// apps/direct-transfair-mobile/app/(auth)/change-password-required.tsx
// =========================================================
// CHANGEMENT DE MOT DE PASSE OBLIGATOIRE v2.0 — Direct Transf'air
// ✅ v2.0 (lot 10) : le nouveau secret est un CODE À 6 CHIFFRES robuste (cases masquées, jauge, règle identique au serveur). Cet écran sert
//   aussi à la migration des clients qui avaient un ancien mot de passe : ils saisissent l'ancien, puis choisissent leur code.
// Affiché tant que le compte utilise un mot de passe défini par un administrateur (mot de passe temporaire reçu par
// e-mail) ou un ancien mot de passe à remplacer par le code à 6 chiffres. Le serveur refuse tout le reste de l'API tant que ce changement n'est pas fait : cet écran n'est donc pas
// contournable en modifiant l'application. Après succès, le profil est relu et le garde de navigation ouvre l'accueil.
// =========================================================

import React, { useRef, useState } from 'react';
import { TextInput as RNTextInput, View } from 'react-native';

import { useAuth } from '../../providers/AuthProvider';
import { api } from '../../services/api';

import AuthShell, { useAuthPalette } from '../../components/auth/AuthShell';
import AuthField from '../../components/auth/AuthField';
import AuthButton from '../../components/auth/AuthButton';
import AuthNotice from '../../components/auth/AuthNotice';
import PinGuide from '../../components/auth/PinGuide';
import PinInput from '../../components/auth/PinInput';
import { PIN_LENGTH, pinProblem } from '../../components/auth/pinRules';

export default function ChangePasswordRequiredScreen() {
  const P = useAuthPalette();
  const { user, refreshUser, logout } = useAuth();
  const confirmRef = useRef<RNTextInput | null>(null);
  const pinContext = { birthDate: (user as any)?.birthDate ?? null, phone: user?.phone ?? null };

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    const found: typeof errors = {};
    if (!current) found.current = 'Saisissez votre mot de passe actuel (ou le mot de passe temporaire reçu).';
    if (next.length !== PIN_LENGTH) found.next = `Le code doit contenir exactement ${PIN_LENGTH} chiffres.`;
    else if (next === current) found.next = 'Le nouveau code doit être différent de l’ancien.';
    else {
      const weak = pinProblem(next, pinContext);
      if (weak) found.next = weak;
    }
    if (confirm !== next) found.confirm = 'Les deux codes ne sont pas identiques.';
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      await api.changePassword({ oldPassword: current, newPassword: next });
      // Relit le profil : mustChangePassword passe à false, le garde de navigation ouvre alors l'accueil.
      await refreshUser();
    } catch (e: any) {
      const raw = e?.response?.data?.message ?? e?.message ?? 'Impossible de modifier le code secret.';
      const msg = Array.isArray(raw) ? String(raw[0]) : String(raw);
      if (e?.response?.data?.code === 'PIN_WEAK') setErrors({ next: msg });
      else if (/ancien|actuel|incorrect/i.test(msg)) setErrors({ current: 'Mot de passe actuel incorrect.' });
      else setFailure(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      compact
      title="Choisissez votre code secret"
      subtitle="Remplacez votre ancien mot de passe par un code à 6 chiffres que vous seul connaissez. Il protège votre portefeuille."
    >
      {failure ? <AuthNotice kind="error" message={failure} /> : null}

      <AuthField
        label="Mot de passe actuel ou temporaire"
        icon="key-outline"
        value={current}
        onChangeText={(t) => { setCurrent(t); if (errors.current) setErrors((e) => ({ ...e, current: undefined })); }}
        error={errors.current}
        secure
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="next"
        accent={P.accent}
        maxLength={128}
      />
      <PinInput
        label="Nouveau code secret (6 chiffres)"
        value={next}
        onChange={(v) => { setNext(v); if (errors.next) setErrors((e) => ({ ...e, next: undefined })); }}
        onComplete={() => confirmRef.current?.focus()}
        accent={P.accent}
        error={errors.next}
        disabled={loading}
      />
      <PinGuide pin={next} context={pinContext} />
      <PinInput
        label="Confirmer le code secret"
        value={confirm}
        onChange={(v) => { setConfirm(v); if (errors.confirm) setErrors((e) => ({ ...e, confirm: undefined })); }}
        accent={P.accent}
        error={errors.confirm}
        disabled={loading}
        noReveal
        inputRef={confirmRef}
      />

      <View style={{ gap: 8, marginTop: 8 }}>
        <AuthButton label="Enregistrer et continuer" loading={loading} onPress={() => void submit()} />
        <AuthButton label="Se déconnecter" variant="link" accent={P.accent} disabled={loading} onPress={() => void logout()} />
      </View>
    </AuthShell>
  );
}
