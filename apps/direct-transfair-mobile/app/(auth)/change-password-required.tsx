// apps/direct-transfair-mobile/app/(auth)/change-password-required.tsx
// =========================================================
// CHANGEMENT DE MOT DE PASSE OBLIGATOIRE v1.0 — Direct Transf'air
// Affiché tant que le compte utilise un mot de passe défini par un administrateur (mot de passe temporaire reçu par
// e-mail). Le serveur refuse tout le reste de l'API tant que ce changement n'est pas fait : cet écran n'est donc pas
// contournable en modifiant l'application. Après succès, le profil est relu et le garde de navigation ouvre l'accueil.
// =========================================================

import React, { useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '../../providers/AuthProvider';
import { api } from '../../services/api';

import AuthShell, { useAuthPalette } from '../../components/auth/AuthShell';
import AuthField from '../../components/auth/AuthField';
import AuthButton from '../../components/auth/AuthButton';
import AuthNotice from '../../components/auth/AuthNotice';
import PasswordGuide from '../../components/auth/PasswordGuide';
import { isPasswordAcceptable, PASSWORD_MAX, PASSWORD_MIN } from '../../components/auth/passwordRules';

export default function ChangePasswordRequiredScreen() {
  const P = useAuthPalette();
  const { refreshUser, logout } = useAuth();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    const found: typeof errors = {};
    if (!current) found.current = 'Saisissez le mot de passe temporaire reçu par e-mail.';
    if (!isPasswordAcceptable(next)) found.next = `Entre ${PASSWORD_MIN} et ${PASSWORD_MAX} caractères.`;
    else if (next === current) found.next = "Le nouveau mot de passe doit être différent du mot de passe temporaire.";
    if (confirm !== next) found.confirm = 'Les deux mots de passe ne sont pas identiques.';
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      await api.changePassword({ oldPassword: current, newPassword: next });
      // Relit le profil : mustChangePassword passe à false, le garde de navigation ouvre alors l'accueil.
      await refreshUser();
    } catch (e: any) {
      const raw = e?.response?.data?.message ?? e?.message ?? 'Impossible de modifier le mot de passe.';
      const msg = Array.isArray(raw) ? String(raw[0]) : String(raw);
      if (/ancien|actuel|incorrect/i.test(msg)) setErrors({ current: 'Mot de passe temporaire incorrect.' });
      else setFailure(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      compact
      title="Choisissez votre mot de passe"
      subtitle="Remplacez le mot de passe temporaire reçu par e-mail par un mot de passe que vous seul connaissez."
    >
      {failure ? <AuthNotice kind="error" message={failure} /> : null}

      <AuthField
        label="Mot de passe temporaire"
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
      <AuthField
        label="Nouveau mot de passe"
        icon="lock-closed-outline"
        value={next}
        onChangeText={(t) => { setNext(t); if (errors.next) setErrors((e) => ({ ...e, next: undefined })); }}
        error={errors.next}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        accent={P.accent}
        maxLength={PASSWORD_MAX}
      />
      <PasswordGuide password={next} />
      <AuthField
        label="Confirmer le nouveau mot de passe"
        icon="lock-closed-outline"
        value={confirm}
        onChangeText={(t) => { setConfirm(t); if (errors.confirm) setErrors((e) => ({ ...e, confirm: undefined })); }}
        error={errors.confirm}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        accent={P.accent}
        maxLength={PASSWORD_MAX}
      />

      <View style={{ gap: 8, marginTop: 8 }}>
        <AuthButton label="Enregistrer et continuer" loading={loading} onPress={() => void submit()} />
        <AuthButton label="Se déconnecter" variant="link" accent={P.accent} disabled={loading} onPress={() => void logout()} />
      </View>
    </AuthShell>
  );
}
