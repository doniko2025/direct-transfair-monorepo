// apps/web-admin/src/pages/login/ForgotPasswordPanel.tsx
// « Mot de passe oublié » — deux étapes dans la carte de connexion :
//   1. l'adresse email du compte → un code à 6 chiffres est envoyé par email ;
//   2. le code + le nouveau mot de passe (saisi deux fois) → le mot de passe est remplacé.
// Le code n'est contrôlé qu'une seule fois, par POST /auth/reset-password (voir passwordResetApi.ts).

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { Button, Field, Notice } from '../../components/ui';
import {
  describeResetError,
  findAccount,
  resetPassword,
  sendResetCode,
} from '../../lib/passwordResetApi';
import {
  PASSWORD_MIN_LENGTH,
  passwordStrength,
  validateNewPassword,
  type NewPasswordErrors,
} from '../../lib/passwordRules';

/** Le serveur impose 45 s entre deux envois de code pour le même compte. */
const COOLDOWN_SECONDS = 45;

interface Props {
  /** Adresse déjà saisie sur l'écran de connexion. */
  initialEmail: string;
  /** Retour à l'écran de connexion sans rien changer. */
  onBack(): void;
  /** Mot de passe remplacé : retour à la connexion avec l'adresse utilisée. */
  onDone(email: string): void;
}

export function ForgotPasswordPanel({ initialEmail, onBack, onDone }: Props) {
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [userId, setUserId] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [errors, setErrors] = useState<NewPasswordErrors>({});

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const nextRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submitEmail(e: FormEvent): Promise<void> {
    e.preventDefault();
    const address = email.trim();
    if (busy || !address) return;
    setBusy(true);
    setError(null);
    setInfo(null);

    let found: string;
    try {
      found = (await findAccount(address)).userId;
    } catch (err) {
      setError(describeResetError(err, 'find'));
      setBusy(false);
      return;
    }

    try {
      await sendResetCode(found);
    } catch (err) {
      setError(describeResetError(err, 'send'));
      setBusy(false);
      return;
    }

    setUserId(found);
    setInfo(`Un code à 6 chiffres vient d'être envoyé à ${address}.`);
    setCooldown(COOLDOWN_SECONDS);
    setStep('reset');
    setBusy(false);
  }

  async function resend(): Promise<void> {
    if (!userId || busy || cooldown > 0) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await sendResetCode(userId);
      setInfo('Un nouveau code vient d’être envoyé.');
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      setError(describeResetError(err, 'send'));
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (busy || !userId) return;
    setError(null);
    setInfo(null);

    if (code.length !== 6) {
      setError('Saisissez le code à 6 chiffres reçu par email.');
      return;
    }
    const found = validateNewPassword(next, confirm);
    setErrors(found);
    if (found.next || found.confirm) {
      (found.next ? nextRef : confirmRef).current?.focus();
      return;
    }

    setBusy(true);
    try {
      await resetPassword(userId, code, next);
      onDone(email.trim());
    } catch (err) {
      setError(describeResetError(err, 'reset'));
      setBusy(false);
    }
  }

  if (step === 'email') {
    return (
      <form className="login__form" onSubmit={(e) => void submitEmail(e)} noValidate>
        <div className="login__heading">
          <h2>Mot de passe oublié</h2>
          <p>Indiquez l'adresse email de votre compte : nous vous envoyons un code pour en choisir un nouveau.</p>
        </div>

        {error ? <Notice tone="error">{error}</Notice> : null}

        <Field
          label="Adresse email"
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          inputMode="email"
          placeholder="prenom.nom@societe.com"
          autoFocus
          required
        />

        <Button type="submit" block busy={busy} disabled={!email.trim()}>
          Recevoir le code
        </Button>

        <div className="login__links">
          <button type="button" className="link-btn" onClick={onBack} disabled={busy}>
            Retour à la connexion
          </button>
        </div>
      </form>
    );
  }

  const strength = passwordStrength(next);
  const inputType = showPasswords ? 'text' : 'password';

  return (
    <form className="login__form" onSubmit={(e) => void submitReset(e)} noValidate>
      <div className="login__heading">
        <h2>Nouveau mot de passe</h2>
        <p>Saisissez le code reçu par email, puis choisissez votre nouveau mot de passe.</p>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {info && !error ? <Notice tone="ok">{info}</Notice> : null}

      <Field
        label="Code à 6 chiffres"
        value={code}
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
          setError(null);
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="123456"
        autoFocus
        required
      />

      <Field
        ref={nextRef}
        label="Nouveau mot de passe"
        type={inputType}
        value={next}
        onChange={(e) => {
          setNext(e.target.value);
          if (errors.next) setErrors((p) => ({ ...p, next: undefined }));
        }}
        autoComplete="new-password"
        error={errors.next}
        hint={
          strength.label
            ? `${strength.label} · au moins ${PASSWORD_MIN_LENGTH} caractères, lettres et chiffres.`
            : `Au moins ${PASSWORD_MIN_LENGTH} caractères, lettres et chiffres.`
        }
        required
        trailing={
          <button
            type="button"
            className="icon-btn icon-btn--quiet"
            onClick={() => setShowPasswords((v) => !v)}
            aria-label={showPasswords ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
            aria-pressed={showPasswords}
          >
            <Icon name={showPasswords ? 'eyeOff' : 'eye'} size={18} />
          </button>
        }
      />

      <Field
        ref={confirmRef}
        label="Confirmer le mot de passe"
        type={inputType}
        value={confirm}
        onChange={(e) => {
          setConfirm(e.target.value);
          if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }));
        }}
        autoComplete="new-password"
        error={errors.confirm}
        required
      />

      <Button type="submit" block busy={busy} disabled={code.length !== 6 || !next || !confirm}>
        Enregistrer le mot de passe
      </Button>

      <div className="login__links">
        <button type="button" className="link-btn" onClick={() => void resend()} disabled={cooldown > 0 || busy}>
          {cooldown > 0 ? `Renvoyer le code dans ${cooldown} s` : 'Renvoyer le code'}
        </button>
        <button type="button" className="link-btn" onClick={onBack} disabled={busy}>
          Retour à la connexion
        </button>
      </div>
    </form>
  );
}
