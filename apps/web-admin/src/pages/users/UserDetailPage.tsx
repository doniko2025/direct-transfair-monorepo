// src/pages/users/UserDetailPage.tsx
// Fiche d'un compte : profil modifiable, informations de compte, conformité,
// portefeuilles, suspension / réactivation et suppression.

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, TextAreaField } from '../../components/form';
import { Button, Card, Field, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { countryName } from '../../lib/countries';
import { describeError } from '../../lib/errors';
import { useResource } from '../../lib/useResource';
import {
  ACCOUNT_LABEL,
  ACCOUNT_TONE,
  COMPLIANCE_LABEL,
  COMPLIANCE_TONE,
  KYC_LABEL,
  accountState,
  canManage,
  formatDateTime,
  fullName,
  initialsOf,
  roleName,
  roleTone,
} from '../../lib/userRules';
import { useCurrentUser } from '../../providers/AuthProvider';
import type { FieldDef } from '../companies/EditableSection';
import { EditableSection } from '../companies/EditableSection';

const PROFILE_FIELDS: readonly FieldDef[] = [
  { key: 'firstName', label: 'Prénom', required: true, maxLength: 80 },
  { key: 'lastName', label: 'Nom', required: true, maxLength: 80 },
  {
    key: 'phone',
    label: 'Téléphone',
    kind: 'tel',
    maxLength: 25,
    hint: 'Format international, exemple : +33612345678. Laisser vide pour retirer le numéro.',
    validate: (v) => (/^\+?[0-9 ().-]{6,25}$/.test(v) ? null : 'Numéro de téléphone invalide.'),
  },
  { key: 'city', label: 'Ville', maxLength: 80 },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="kv__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function yesNo(value: boolean | undefined, yes: string, no: string, noTone: 'warn' | 'neutral' = 'warn') {
  if (value === undefined) return <span className="muted">Inconnu</span>;
  return <Pill tone={value ? 'ok' : noTone}>{value ? yes : no}</Pill>;
}

export default function UserDetailPage() {
  const { id = '' } = useParams();
  const me = useCurrentUser();
  const navigate = useNavigate();

  const { data, error, loading, reload } = useResource(() => api.users.get(id), [id]);

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const backLink = (
    <Link to="/users" className="btn btn--secondary">
      <Icon name="arrowLeft" size={18} />
      <span>Tous les utilisateurs</span>
    </Link>
  );

  const notFound =
    !id ||
    (!loading && !error && !data) ||
    (error instanceof ApiError && (error.status === 404 || error.status === 403));

  if (notFound) {
    return (
      <>
        <PageHeader title="Compte introuvable" actions={backLink} />
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Ce compte n'est pas accessible</h2>
          <p>Il n'existe pas, ou il n'appartient pas à votre périmètre.</p>
        </Card>
      </>
    );
  }

  if (loading && !data) {
    return (
      <div className="center-block">
        <Spinner label="Chargement du compte" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Utilisateur" actions={backLink} />
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger le compte"
            action={
              <button type="button" className="link-btn" onClick={reload}>
                Réessayer
              </button>
            }
          >
            {describeError(error).message}
          </Notice>
        </Card>
      </>
    );
  }

  const user = data;
  const state = accountState(user);
  const manageable = canManage(me, user);
  const isSelf = String(me.id) === user.id;
  const wallets = user.wallets ?? [];
  const location = [user.city, countryName(user.country)].filter(Boolean).join(', ');
  const company = user.client?.name ?? null;

  async function save(patch: Record<string, string | null>) {
    await api.users.update(user.id, patch);
    reload();
  }

  async function run(action: () => Promise<unknown>, done: () => void) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      done();
      reload();
    } catch (err) {
      setActionError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeUser() {
    setBusy(true);
    setActionError(null);
    try {
      await api.users.remove(user.id);
      navigate('/users', { replace: true, state: { deleted: fullName(user) } });
    } catch (err) {
      setActionError(describeError(err).message);
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={fullName(user)} actions={backLink} />

      <div className="stack">
        <Card className="company-hero">
          <span className="avatar user-hero__avatar" aria-hidden="true">
            {initialsOf(user)}
          </span>
          <div className="company-hero__main">
            <div className="company-hero__line">
              <Pill tone={roleTone(user.role)} icon="shield">
                {roleName(user.role)}
              </Pill>
              <Pill tone={ACCOUNT_TONE[state]}>{ACCOUNT_LABEL[state]}</Pill>
            </div>
            <p className="company-hero__meta">
              {[company, user.agency?.name, location || null].filter(Boolean).join(' · ') || user.email}
            </p>
          </div>
          {manageable ? (
            <div className="company-hero__actions">
              {state === 'active' ? (
                <Button variant="secondary" onClick={() => setSuspendOpen(true)}>
                  Suspendre
                </Button>
              ) : (
                <Button onClick={() => setReactivateOpen(true)}>Réactiver</Button>
              )}
            </div>
          ) : null}
        </Card>

        {state === 'suspended' ? (
          <Notice tone="info" title="Compte suspendu">
            {[user.suspendedReason, user.suspendedAt ? `depuis le ${formatDateTime(user.suspendedAt)}` : null]
              .filter(Boolean)
              .join(' — ') || 'Ce compte ne peut plus se connecter.'}
          </Notice>
        ) : null}

        <div className="detail-grid">
          <EditableSection
            id="profile"
            title="Profil"
            icon="user"
            fields={PROFILE_FIELDS}
            values={user as unknown as Record<string, string | null | undefined>}
            onSave={save}
            readOnly={!manageable}
          />

          <Card as="section" aria-labelledby="account-title" className="section-card">
            <header className="section-card__head">
              <span className="section-card__icon">
                <Icon name="shield" size={20} />
              </span>
              <div className="section-card__title">
                <h2 id="account-title">Compte</h2>
                <p>Identifiant de connexion et vérifications.</p>
              </div>
            </header>
            <dl className="kv">
              <Row label="Adresse email">{user.email}</Row>
              <Row label="Email vérifié">{yesNo(user.isEmailVerified, 'Vérifié', 'Non vérifié')}</Row>
              <Row label="Téléphone vérifié">
                {user.phone ? yesNo(user.isPhoneVerified, 'Vérifié', 'Non vérifié') : <span className="muted">Aucun numéro</span>}
              </Row>
              <Row label="Double authentification">{yesNo(user.mfaEnabled, 'Activée', 'Désactivée', 'neutral')}</Row>
              {company ? <Row label="Société">{company}</Row> : null}
              {user.agency?.name ? <Row label="Agence">{user.agency.name}</Row> : null}
              <Row label="Inscription">{formatDateTime(user.createdAt) ?? <span className="muted">Inconnue</span>}</Row>
              <Row label="Dernière connexion">
                {formatDateTime(user.lastLoginAt) ?? <span className="muted">Jamais connecté</span>}
              </Row>
            </dl>
          </Card>
        </div>

        {user.role === 'USER' || user.kycLevel ? (
          <Card as="section" aria-labelledby="kyc-title" className="section-card">
            <header className="section-card__head">
              <span className="section-card__icon">
                <Icon name="shield" size={20} />
              </span>
              <div className="section-card__title">
                <h2 id="kyc-title">Conformité</h2>
                <p>Niveau de vérification d'identité et statut de conformité.</p>
              </div>
            </header>
            <dl className="kv">
              <Row label="Vérification d'identité">
                {user.kycLevel ? KYC_LABEL[user.kycLevel] : <span className="muted">Inconnue</span>}
              </Row>
              <Row label="Statut de conformité">
                {user.complianceStatus ? (
                  <Pill tone={COMPLIANCE_TONE[user.complianceStatus]}>{COMPLIANCE_LABEL[user.complianceStatus]}</Pill>
                ) : (
                  <span className="muted">Inconnu</span>
                )}
              </Row>
            </dl>
          </Card>
        ) : null}

        {wallets.length > 0 ? (
          <Card as="section" aria-labelledby="uw-title" className="section-card">
            <header className="section-card__head">
              <span className="section-card__icon">
                <Icon name="wallet" size={20} />
              </span>
              <div className="section-card__title">
                <h2 id="uw-title">Portefeuilles</h2>
                <p>Soldes par devise.</p>
              </div>
            </header>
            <ul className="wallets">
              {wallets.map((w) => (
                <li key={String(w.id)} className="wallet">
                  <span className="wallet__cur">{w.currency}</span>
                  <strong>{formatAmount(w.balance, w.currency)}</strong>
                  {Number(w.reservedBalance ?? 0) > 0 ? (
                    <span className="muted wallet__sub">dont {formatAmount(w.reservedBalance ?? 0, w.currency)} réservés</span>
                  ) : null}
                  <span className="wallet__pills">
                    {w.isDefault ? <Pill tone="brand">Par défaut</Pill> : null}
                    {w.isFrozen ? <Pill tone="warn">Gelé</Pill> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card tone="flat" className="danger-zone">
          <div>
            <h2>Supprimer ce compte</h2>
            <p>
              {manageable
                ? 'Le compte ne peut plus se connecter. Ses données sont conservées pour l’audit et son email est libéré.'
                : isSelf
                  ? 'C’est votre propre compte : vous ne pouvez ni le suspendre ni le supprimer ici.'
                  : 'Ce type de compte est géré par la plateforme : vous ne pouvez pas le modifier.'}
            </p>
          </div>
          {manageable ? (
            <Button
              variant="secondary"
              icon="trash"
              className="btn--danger-outline"
              onClick={() => {
                setConfirmEmail('');
                setActionError(null);
                setDeleteOpen(true);
              }}
            >
              Supprimer
            </Button>
          ) : null}
        </Card>
      </div>

      <ConfirmDialog
        open={suspendOpen}
        title={`Suspendre ${fullName(user)} ?`}
        confirmLabel="Suspendre"
        busy={busy}
        onConfirm={() => void run(() => api.users.suspend(user.id, reason.trim() || undefined), () => setSuspendOpen(false))}
        onCancel={() => {
          setSuspendOpen(false);
          setActionError(null);
        }}
      >
        <p>Le compte est déconnecté immédiatement et ne peut plus se connecter tant qu'il n'est pas réactivé.</p>
        <TextAreaField
          id="suspend-reason"
          label="Motif (facultatif)"
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
        />
        {actionError ? <Notice tone="error">{actionError}</Notice> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={reactivateOpen}
        title={`Réactiver ${fullName(user)} ?`}
        confirmLabel="Réactiver"
        busy={busy}
        onConfirm={() => void run(() => api.users.reactivate(user.id), () => setReactivateOpen(false))}
        onCancel={() => {
          setReactivateOpen(false);
          setActionError(null);
        }}
      >
        <p>Le compte pourra de nouveau se connecter.</p>
        {actionError ? <Notice tone="error">{actionError}</Notice> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteOpen}
        title={`Supprimer ${fullName(user)} ?`}
        confirmLabel="Supprimer le compte"
        tone="danger"
        busy={busy}
        confirmDisabled={confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()}
        onConfirm={() => void removeUser()}
        onCancel={() => setDeleteOpen(false)}
      >
        <p>Cette action ne peut pas être annulée depuis la console.</p>
        <Field
          id="confirm-email"
          label={`Tapez ${user.email} pour confirmer`}
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {actionError ? <Notice tone="error">{actionError}</Notice> : null}
      </ConfirmDialog>
    </>
  );
}
