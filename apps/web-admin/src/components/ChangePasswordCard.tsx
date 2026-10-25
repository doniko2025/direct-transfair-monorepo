// src/components/ChangePasswordCard.tsx
// v1.1 — props `forced` (changement obligatoire après un mot de passe temporaire : libellé adapté, pas de message de
//        succès, `onChanged` appelé) et `onChanged`. Sans ces props : comportement inchangé.
// v1.0 — Carte « Mot de passe » de la page Mon compte.
// Trois champs (actuel, nouveau, confirmation), indicateur de robustesse, validation
// immédiate côté interface puis appel PATCH /auth/change-password. Les erreurs du
// serveur sont rattachées au bon champ ; le focus va sur le premier champ à corriger.

import { useRef, useState, type FormEvent } from 'react';
import { Button, Card, Field, Notice } from './ui';
import { changeMyPassword, describeChangePasswordError } from '../lib/accountApi';
import {
  PASSWORD_MIN_LENGTH,
  hasErrors,
  passwordStrength,
  validatePasswordChange,
  type PasswordFormErrors,
} from '../lib/passwordRules';

export function ChangePasswordCard({
  email,
  forced = false,
  onChanged,
}: {
  email: string;
  forced?: boolean;
  onChanged?: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<PasswordFormErrors>({});
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const currentRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const strength = passwordStrength(next);
  const inputType = showPasswords ? 'text' : 'password';

  function edit(field: keyof PasswordFormErrors, setter: (value: string) => void, value: string) {
    setter(value);
    setDone(false);
    setFailure(null);
    // L'erreur d'un champ disparaît dès qu'on le corrige.
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setDone(false);
    setFailure(null);

    const found = validatePasswordChange(current, next, confirm);
    setErrors(found);
    if (hasErrors(found)) {
      (found.current ? currentRef : found.next ? nextRef : confirmRef).current?.focus();
      return;
    }

    setBusy(true);
    try {
      await changeMyPassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setErrors({});
      setShowPasswords(false);
      setDone(!forced);
      onChanged?.();
    } catch (err) {
      const problem = describeChangePasswordError(err);
      if (problem.field === 'current') {
        setErrors({ current: problem.message });
        currentRef.current?.focus();
      } else if (problem.field === 'next') {
        setErrors({ next: problem.message });
        nextRef.current?.focus();
      } else {
        setFailure(problem.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="pw-card">
      <div className="pw-head">
        <div>
          <h2 className="card-title">Mot de passe</h2>
          <p className="muted">
            Choisissez un mot de passe que vous n&apos;utilisez nulle part ailleurs.
          </p>
        </div>
        <Button
          variant="ghost"
          icon={showPasswords ? 'eyeOff' : 'eye'}
          onClick={() => setShowPasswords((v) => !v)}
          aria-pressed={showPasswords}
        >
          {showPasswords ? 'Masquer' : 'Afficher'}
        </Button>
      </div>

      {done ? (
        <div className="pw-feedback">
          <Notice tone="ok" title="Mot de passe modifié">
            Votre nouveau mot de passe est actif. Utilisez-le à votre prochaine connexion.
          </Notice>
        </div>
      ) : null}
      {failure ? (
        <div className="pw-feedback">
          <Notice tone="error" title="Modification impossible">
            {failure}
          </Notice>
        </div>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} noValidate>
        {/* Identifiant pour le gestionnaire de mots de passe du navigateur (invisible). */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          defaultValue={email}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          className="pw-username"
        />

        <div className="form-grid">
          <Field
            ref={currentRef}
            className="form-grid__wide"
            label={forced ? 'Mot de passe temporaire (reçu par e-mail)' : 'Mot de passe actuel'}
            name="current-password"
            type={inputType}
            autoComplete="current-password"
            value={current}
            onChange={(e) => edit('current', setCurrent, e.target.value)}
            error={errors.current}
            readOnly={busy}
          />

          <div className="pw-field">
            <Field
              ref={nextRef}
              label="Nouveau mot de passe"
              name="new-password"
              type={inputType}
              autoComplete="new-password"
              value={next}
              onChange={(e) => edit('next', setNext, e.target.value)}
              hint={`Au moins ${PASSWORD_MIN_LENGTH} caractères, avec des lettres et des chiffres.`}
              error={errors.next}
              readOnly={busy}
            />
            {next ? (
              <div className="pw-meter" data-level={strength.level} aria-live="polite">
                <span className="pw-meter__bars" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
                <span className="pw-meter__label">Robustesse : {strength.label}</span>
              </div>
            ) : null}
          </div>

          <Field
            ref={confirmRef}
            label="Confirmer le nouveau mot de passe"
            name="confirm-password"
            type={inputType}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => edit('confirm', setConfirm, e.target.value)}
            error={errors.confirm}
            readOnly={busy}
          />
        </div>

        <div className="form-actions form-actions--start pw-actions">
          <Button type="submit" busy={busy} disabled={!current || !next || !confirm}>
            Changer le mot de passe
          </Button>
        </div>
      </form>
    </Card>
  );
}
