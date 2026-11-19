// apps/web-admin/src/pages/LoginPage.tsx
// ✅ v4 : design plus sobre et professionnel (panneau marque à points, atouts détaillés, formulaire plat aux champs plus grands, bouton gradient) + carte « Installer l'application » dès la connexion.
// ✅ v3 : REFONTE moderne et responsive. Ordinateur : panneau marque en dégradé (couleurs du super admin) avec logo, pitch et trois atouts, carte de
//    connexion flottante à droite. Mobile / tablette : bandeau en dégradé avec le logo, puis une FEUILLE arrondie qui porte le formulaire (tient sur un écran,
//    clavier compris). Logo à ratio automatique (jamais déformé ni dans une tuile d'une autre forme), apparition en cascade, « Réduire les animations » respecté.
// ✅ v2 (mobile) : le héro disparaît sur mobile — logo dans une tuile arrondie + nom de la société centrés au-dessus du formulaire, page épurée qui tient
//    sur un seul écran sans défilement. Sur ordinateur, le héro (rosace) est conservé tel quel.
// ✅ « Mot de passe oublié ? » : lien sous le champ mot de passe → ForgotPasswordPanel (code par email puis nouveau mot de passe), retour à la connexion avec un message de succès.
// ✅ phase 7 : message « compte client » avec le nom de marque du branding (plus de « Direct Transf'air » en dur).
// Connexion à l'espace de gestion. À gauche l'identité de la société (ou de la
// plateforme) sur un motif de guilloché ; à droite le formulaire.

import { useState, type FormEvent } from 'react';
import { PLATFORM_LOGO_URL } from '../config';
import { Navigate, useLocation } from 'react-router-dom';
import type { VerificationNeeded, VerifyContactResult } from '@direct-transfair/shared';
import { BrandMark } from '../components/BrandMark';
import { Icon } from '../components/Icon';
import { Button, Card, Field, LoadingScreen, Notice } from '../components/ui';
import { describeError, type DescribedError } from '../lib/errors';
import { useInstallPrompt } from '../lib/useInstallPrompt';
import { useAuth, type LoginOutcome } from '../providers/AuthProvider';
import { useTenant } from '../providers/TenantProvider';
import { ForgotPasswordPanel } from './login/ForgotPasswordPanel';
import { VerifyContactPanel } from './login/VerifyContactPanel';

// ✅ phase 7 : le nom de l'application vient du branding (plus de « Direct Transf'air » en dur).
const clientAccountMessage = (brandName: string): string =>
  `Ce compte est un compte client. Utilisez l'application mobile ${brandName} pour vous connecter.`;

/** Logo à ratio automatique : hauteur fixe, largeur déduite (plafonnée), jamais déformé ; repli sur le monogramme si l'image ne charge pas. */
function LoginLogo({ name, logoUrl, size }: { name: string; logoUrl: string | null; size: number }) {
  const [failed, setFailed] = useState(false);
  if (!logoUrl || failed) return <BrandMark name={name} logoUrl={null} size={size} />;
  const platform = logoUrl === PLATFORM_LOGO_URL;   // « t’ » : déjà une tuile arrondie
  return (
    <img
      className={platform ? 'login-logo login-logo--tile' : 'login-logo'}
      src={logoUrl}
      alt=""
      style={{ height: size, maxWidth: size * 2.4 }}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

const PERKS: readonly { icon: 'shield' | 'swap' | 'building'; title: string; text: string }[] = [
  { icon: 'shield', title: 'Connexion sécurisée', text: 'Vos accès sont protégés et vérifiés.' },
  { icon: 'building', title: 'Un seul espace de gestion', text: 'Agences, agents, clients et trésorerie réunis.' },
  { icon: 'swap', title: 'Suivi en temps réel', text: 'Chaque opération est visible dès son enregistrement.' },
];

/** Installation de l'application (écran d'accueil, plein écran) : proposée dès la page de connexion, avant même d'avoir un compte ouvert. */
function InstallCard() {
  const { canInstall, showHowTo, install } = useInstallPrompt();
  if (!canInstall && !showHowTo) return null;
  return (
    <div className="login__install">
      <span className="login__install-icon" aria-hidden="true">
        <Icon name="download" size={20} />
      </span>
      <div className="login__install-text">
        <strong>Installer l'application</strong>
        {canInstall ? (
          <span>Accès direct depuis l'écran d'accueil, en plein écran.</span>
        ) : (
          <span>Menu ⋮ du navigateur → « Installer l'application » (et non « Ajouter à l'écran d'accueil »).</span>
        )}
      </div>
      {canInstall ? (
        <Button variant="secondary" onClick={() => void install()}>
          Installer
        </Button>
      ) : null}
    </div>
  );
}

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
  const [forgot, setForgot] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (state.status === 'loading') return <LoadingScreen label="Vérification de votre session…" />;
  if (state.status === 'authenticated') return <Navigate to={from} replace />;

  const notice = state.notice;
  const pitch =
    branding.welcomeMessage ||
    branding.tagline ||
    (isPlatform
      ? 'Pilotez les sociétés de transfert, leurs contrats et la supervision de la plateforme.'
      : 'Gérez vos agences, vos agents et vos transferts depuis un seul espace.');

  function handleOutcome(outcome: LoginOutcome): void {
    if (outcome.kind === 'verification') {
      setPending(outcome.pending);
      return;
    }
    if (outcome.kind === 'client-account') setError({ message: clientAccountMessage(branding.name) });
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

  function backToLogin(): void {
    setForgot(false);
    setError(null);
  }

  function onResetDone(address: string): void {
    setEmail(address);
    setPassword('');
    setShowPassword(false);
    setForgot(false);
    setError(null);
    setResetDone(true);
  }

  return (
    <div className="login">
      {/* Ordinateur : panneau marque (masqué sur mobile par login.css). */}
      <aside className="login__brand">
        <div className="login__glow login__glow--a" aria-hidden="true" />
        <div className="login__glow login__glow--b" aria-hidden="true" />
        <div className="login__brand-inner">
          <span className="login__badge">
            <LoginLogo name={branding.name} logoUrl={branding.logoUrl} size={56} />
          </span>
          <div className="login__brand-copy">
            <span className="login__eyebrow login__eyebrow--light">Espace de gestion</span>
            <h1>{branding.name}</h1>
            <p>{pitch}</p>
          </div>
          <ul className="login__perks">
            {PERKS.map((perk) => (
              <li key={perk.title}>
                <span className="login__perk-icon" aria-hidden="true">
                  <Icon name={perk.icon} size={18} />
                </span>
                <span className="login__perk-text">
                  <strong>{perk.title}</strong>
                  <small>{perk.text}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="login__brand-foot">© {new Date().getFullYear()} {branding.name}</p>
      </aside>

      <main className="login__panel">
        {/* Mobile / tablette : bandeau en dégradé avec le logo (masqué sur ordinateur). */}
        <header className="login__mbrand">
          <span className="login__logo">
            <LoginLogo name={branding.name} logoUrl={branding.logoUrl} size={64} />
          </span>
          <strong>{branding.name}</strong>
        </header>

        <Card className="login__card">
          {forgot ? (
            <ForgotPasswordPanel initialEmail={email} onBack={backToLogin} onDone={onResetDone} />
          ) : pending ? (
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
                <span className="login__eyebrow">Espace de gestion</span>
                <h2>Connexion</h2>
                <p>Entrez les identifiants de votre compte de gestion.</p>
              </div>

              {resetDone ? (
                <Notice tone="ok">Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.</Notice>
              ) : null}
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
                autoFocus={resetDone}
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

              <button
                type="button"
                className="link-btn login__forgot"
                onClick={() => {
                  setError(null);
                  setResetDone(false);
                  setForgot(true);
                }}
              >
                Mot de passe oublié ?
              </button>

              <Button type="submit" block busy={busy} disabled={!email.trim() || !password}>
                Se connecter
              </Button>

              <p className="login__footnote">
                <Icon name="shield" size={14} />
                <span>Vous êtes client ? Votre espace se trouve dans l'application mobile.</span>
              </p>

              <InstallCard />
            </form>
          )}
        </Card>
      </main>
    </div>
  );
}
