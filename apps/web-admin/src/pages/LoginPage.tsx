// src/pages/LoginPage.tsx
// Connexion à l'espace de gestion. À gauche l'identité de la société (ou de la
// plateforme) sur un motif de guilloché ; à droite le formulaire.

import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { VerificationNeeded, VerifyContactResult } from '@direct-transfair/shared';
import { BrandMark } from '../components/BrandMark';
import { Icon } from '../components/Icon';
import { Rosette } from '../components/Rosette';
import { Button, Card, Field, LoadingScreen, Notice } from '../components/ui';
import { describeError, type DescribedError } from '../lib/errors';
import { useAuth, type LoginOutcome } from '../providers/AuthProvider';
import { useTenant } from '../providers/TenantProvider';
import { VerifyContactPanel } from './login/VerifyContactPanel';

const CLIENT_ACCOUNT_MESSAGE =
  "Ce compte est un compte client. Utilisez l'application mobile Direct Transf'air pour vous connecter.";

export default function LoginPage() {
  const { state, login, dismissNotice } = useAuth();
  const { branding, isPlatform } = useTenant();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DescribedError | null>(null);
  const [pending, setPending] = useState<VerificationNeeded | null>(null);
  const [autoSend, setAutoSend] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (state.status === 'loading') return <LoadingScreen label="Vérification de votre session…" />;
  if (state.status === 'authenticated') return <Navigate to={from} replace />;

  const notice = state.notice;
  const pitch =
    branding.welcomeMessage ||
    branding.tagline ||
    (isPlatform
      ? 'Pilotez les sociétés de transfert, les taux et la supervision de la plateforme.'
      : 'Gérez vos agences, vos agents et vos transferts depuis un seul espace.');

  function handleOutcome(outcome: LoginOutcome): void {
    if (outcome.kind === 'verification') {
      setPending(outcome.pending);
      return;
    }
    if (outcome.kind === 'client-account') setError({ message: CLIENT_ACCOUNT_MESSAGE });
    // « success » : l'état d'authentification change, <Navigate> prend le relais.
  }

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    dismissNotice();
    try {
      handleOutcome(await login(email, password));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onVerified(result: VerifyContactResult): Promise<void> {
    if (!pending) return;

    if (!result.allVerified) {
      // Il reste un contact à vérifier (le téléphone après l'email) : on enchaîne.
      setPending({
        ...pending,
        emailVerified: result.emailVerified,
        phoneVerified: result.phoneVerified,
        hasPhone: result.hasPhone,
      });
      setAutoSend(true);
      return;
    }

    // Tout est vérifié : on rejoue la connexion avec les identifiants saisis.
    try {
      const outcome = await login(email, password);
      if (outcome.kind !== 'verification') setPending(null);
      handleOutcome(outcome);
    } catch (err) {
      setPending(null);
      setError(describeError(err));
    }
  }

  function cancelVerification(): void {
    setPending(null);
    setAutoSend(false);
    setPassword('');
    setError(null);
  }

  return (
    <div className="login">
      <aside className="login__brand">
        <Rosette className="login__rosette" />
        <div className="login__brand-inner">
          <BrandMark name={branding.name} logoUrl={branding.logoUrl} size={56} />
          <h1>{branding.name}</h1>
          <p>{pitch}</p>
        </div>
      </aside>

      <main className="login__panel">
        <Card className="login__card">
          {pending ? (
            <VerifyContactPanel
              key={pending.emailVerified ? 'PHONE' : 'EMAIL'}
              pending={pending}
              autoSend={autoSend}
              onVerified={onVerified}
              onCancel={cancelVerification}
            />
          ) : (
            <form className="login__form" onSubmit={(e) => void submit(e)} noValidate>
              <div className="login__heading">
                <h2>Connexion</h2>
                <p>Entrez les identifiants de votre compte de gestion.</p>
              </div>

              {notice ? <Notice tone="info">{notice}</Notice> : null}
              {error ? (
                <Notice
                  tone="error"
                  action={
                    error.companyUrl ? (
                      <a className="link" href={error.companyUrl}>
                        Ouvrir mon espace
                      </a>
                    ) : null
                  }
                >
                  {error.message}
                </Notice>
              ) : null}

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

              <Field
                label="Mot de passe"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                trailing={
                  <button
                    type="button"
                    className="icon-btn icon-btn--quiet"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    aria-pressed={showPassword}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                  </button>
                }
              />

              <Button type="submit" block busy={busy} disabled={!email.trim() || !password}>
                Se connecter
              </Button>

              <p className="login__footnote">
                Vous êtes client ? Votre espace se trouve dans l'application mobile.
              </p>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
}
