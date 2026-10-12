// src/pages/login/VerifyContactPanel.tsx
// Étape « vérifier mon contact » : le backend refuse la connexion tant que
// l'email (puis le téléphone, s'il y en a un) n'est pas vérifié par un code
// à 6 chiffres. Au login, le serveur envoie déjà le premier code.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  VerificationChannel,
  VerificationNeeded,
  VerifyContactResult,
} from '@direct-transfair/shared';
import { Button, Field, Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';

const COOLDOWN_SECONDS = 30;

interface Props {
  pending: VerificationNeeded;
  /** true = le code n'a pas encore été envoyé pour ce canal (2e étape). */
  autoSend: boolean;
  onVerified(result: VerifyContactResult): Promise<void> | void;
  onCancel(): void;
}

export function VerifyContactPanel({ pending, autoSend, onVerified, onCancel }: Props) {
  const channel: VerificationChannel = !pending.emailVerified ? 'EMAIL' : 'PHONE';
  const target = channel === 'EMAIL' ? 'votre adresse email' : 'votre téléphone';

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const sentOnMount = useRef(false);

  async function send(): Promise<void> {
    setError(null);
    setInfo(null);
    try {
      await api.auth.sendVerification(pending.userId, channel);
      setInfo(`Un nouveau code vient d'être envoyé à ${target}.`);
      setCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      setError(describeError(err).message);
    }
  }

  // 2e étape (téléphone après email) : le code n'a pas encore été envoyé.
  useEffect(() => {
    if (autoSend && !sentOnMount.current) {
      sentOnMount.current = true;
      void send();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (busy || code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.auth.verifyContact(pending.userId, code, channel);
      await onVerified(result);
    } catch (err) {
      setError(describeError(err).message);
      setBusy(false);
    }
  }

  return (
    <form className="login__form" onSubmit={(e) => void submit(e)} noValidate>
      <div className="login__heading">
        <h2>Vérifiez {target}</h2>
        <p>
          {pending.message ||
            'Pour sécuriser votre compte, confirmez ce contact avec le code reçu.'}
        </p>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {info && !error ? <Notice tone="ok">{info}</Notice> : null}

      <Field
        label="Code à 6 chiffres"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="123456"
        autoFocus
        required
      />

      <Button type="submit" block busy={busy} disabled={code.length !== 6}>
        Vérifier et continuer
      </Button>

      <div className="login__links">
        <button
          type="button"
          className="link-btn"
          onClick={() => void send()}
          disabled={cooldown > 0 || busy}
        >
          {cooldown > 0 ? `Renvoyer le code dans ${cooldown} s` : 'Renvoyer le code'}
        </button>
        <button type="button" className="link-btn" onClick={onCancel} disabled={busy}>
          Changer de compte
        </button>
      </div>
    </form>
  );
}
