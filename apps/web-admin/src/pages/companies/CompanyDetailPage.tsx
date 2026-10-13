// src/pages/companies/CompanyDetailPage.tsx
// Lot C : la section « Portail web » renvoie vers /portal-domains pour la mise en ligne réelle du domaine.
// Fiche d'une société : identité, portail, apparence, mentions légales (édition par section),
// équipe, portefeuilles, statut d'abonnement et suppression.

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, type CompanyDetail, type SubscriptionStatus } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { CompanyMark } from '../../components/CompanyMark';
import { ConfirmDialog } from '../../components/form';
import { Button, Card, Field, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { readableOn } from '../../lib/colors';
import {
  formatAmount,
  formatDate,
  isActiveStatus,
  safeColor,
  statusLabel,
  statusTone,
} from '../../lib/companyRules';
import { countryName } from '../../lib/countries';
import { describeError } from '../../lib/errors';
import { useResource } from '../../lib/useResource';
import { ROLE_LABEL } from '../../navigation';
import { APPEARANCE_FIELDS, IDENTITY_FIELDS, LEGAL_FIELDS, PORTAL_FIELDS } from './companyFields';
import { EditableSection } from './EditableSection';

const PERSON_ROLE: Record<string, string> = {
  ...ROLE_LABEL,
  USER: 'Client wallet',
};

function initials(first: string | null, last: string | null, email: string): string {
  const letters = `${first?.[0] ?? ''}${last?.[0] ?? ''}`.trim();
  return (letters || email[0] || '?').toUpperCase();
}

function AppearancePreview({ draft }: { draft: Record<string, string> }) {
  const primary = safeColor(draft.primaryColor, '#059669');
  const accent = safeColor(draft.secondaryColor, '#10B981');
  return (
    <div className="preview" aria-label="Aperçu de la page de connexion">
      <div className="preview__brand" style={{ background: primary, color: readableOn(primary) }}>
        <span className="preview__dot" style={{ background: accent }} aria-hidden="true" />
        <strong>{draft.tagline || 'Votre slogan apparaît ici'}</strong>
      </div>
      <div className="preview__form" aria-hidden="true">
        <span />
        <span />
        <i style={{ background: primary }} />
      </div>
    </div>
  );
}

export default function CompanyDetailPage() {
  const { id } = useParams();
  const companyId = Number(id);
  const navigate = useNavigate();

  const valid = Number.isInteger(companyId) && companyId > 0;
  const { data, error, loading, reload } = useResource<CompanyDetail | null>(
    () => (valid ? api.companies.get(companyId) : Promise.resolve(null)),
    [companyId],
  );

  const [statusTarget, setStatusTarget] = useState<SubscriptionStatus | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const backLink = (
    <Link to="/companies" className="btn btn--secondary">
      <Icon name="arrowLeft" size={18} />
      <span>Toutes les sociétés</span>
    </Link>
  );

  const notFound = !valid || (!loading && !error && !data) || (error instanceof ApiError && error.status === 404);

  if (notFound) {
    return (
      <>
        <PageHeader title="Société introuvable" actions={backLink} />
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Cette société n'existe pas</h2>
          <p>Elle a peut-être été supprimée, ou l'adresse est incorrecte.</p>
        </Card>
      </>
    );
  }

  if (loading && !data) {
    return (
      <div className="center-block">
        <Spinner label="Chargement de la société" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Société" actions={backLink} />
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger la société"
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

  const company = data;
  const active = isActiveStatus(company.subscriptionStatus);
  const created = formatDate(company.createdAt);
  const location = [company.city, countryName(company.country ?? company.ownerCountry)].filter(Boolean).join(', ');
  const portalHost = company.customDomain ?? null;

  async function save(patch: Record<string, string | null>) {
    await api.companies.update(company.id, patch);
    reload();
  }

  async function applyStatus() {
    if (!statusTarget) return;
    setStatusBusy(true);
    setStatusError(null);
    try {
      await api.companies.setStatus(company.id, statusTarget);
      setStatusTarget(null);
      reload();
    } catch (err) {
      setStatusError(describeError(err).message);
    } finally {
      setStatusBusy(false);
    }
  }

  function openDelete() {
    setConfirmCode('');
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function removeCompany() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await api.companies.remove(company.id);
      navigate('/companies', { replace: true, state: { deleted: company.name, warnings: res.warnings ?? [] } });
    } catch (err) {
      setDeleteError(describeError(err).message);
      setDeleteBusy(false);
    }
  }

  const people = company.users ?? [];
  const wallets = company.wallets ?? [];

  return (
    <>
      <PageHeader title={company.name} description={undefined} actions={backLink} />

      <div className="stack">
        <Card className="company-hero">
          <CompanyMark name={company.name} logoUrl={company.logoUrl} color={company.primaryColor} size={64} />
          <div className="company-hero__main">
            <div className="company-hero__line">
              <span className="company-card__code">{company.code}</span>
              <Pill tone={statusTone(company.subscriptionStatus)}>{statusLabel(company.subscriptionStatus)}</Pill>
              {company.defaultCurrency ? <Pill>{company.defaultCurrency}</Pill> : null}
            </div>
            <p className="company-hero__meta">
              {[location || null, created ? `Créée le ${created}` : null].filter(Boolean).join(' · ') ||
                'Société de transfert'}
            </p>
            {portalHost ? (
              <a className="company-hero__portal" href={`https://${portalHost}`} target="_blank" rel="noopener noreferrer">
                <Icon name="external" size={15} />
                {portalHost}
              </a>
            ) : null}
          </div>
          <div className="company-hero__actions">
            {active ? (
              <Button variant="secondary" onClick={() => setStatusTarget('SUSPENDED')}>
                Suspendre
              </Button>
            ) : (
              <Button onClick={() => setStatusTarget('ACTIVE')}>Réactiver</Button>
            )}
          </div>
        </Card>

        <div className="detail-grid">
          <EditableSection
            id="identity"
            title="Identité et contact"
            icon="building"
            fields={IDENTITY_FIELDS}
            values={company as unknown as Record<string, string | null | undefined>}
            onSave={save}
          />

          <EditableSection
            id="portal"
            title="Portail web"
            icon="globe"
            description="Les administrateurs et agents de la société se connectent depuis ces adresses."
            fields={PORTAL_FIELDS}
            values={company as unknown as Record<string, string | null | undefined>}
            onSave={save}
            extra={(_draft, editing) => (
              <Notice
                tone="info"
                action={
                  <Link className="link-btn" to={`/portal-domains?company=${company.id}`}>
                    Gérer le domaine du portail
                  </Link>
                }
              >
                {editing
                  ? "Modifier ces champs ne configure ni le DNS ni l'hébergeur."
                  : "Pour qu'un domaine soit réellement mis en ligne (DNS, hébergeur, certificat), attribuez-le depuis « Domaines »."}
              </Notice>
            )}
          />

          <EditableSection
            id="appearance"
            title="Apparence"
            icon="palette"
            description="Couleurs, slogan et logo de l'espace de la société."
            fields={APPEARANCE_FIELDS}
            values={company as unknown as Record<string, string | null | undefined>}
            onSave={save}
            extra={(draft) => <AppearancePreview draft={draft} />}
          />

          <EditableSection
            id="legal"
            title="Mentions légales"
            icon="shield"
            description="Affichées aux clients dans les conditions d'utilisation et l'assistance."
            fields={LEGAL_FIELDS}
            values={company as unknown as Record<string, string | null | undefined>}
            onSave={save}
          />
        </div>

        <Card as="section" aria-labelledby="team-title" className="section-card">
          <header className="section-card__head">
            <span className="section-card__icon">
              <Icon name="users" size={20} />
            </span>
            <div className="section-card__title">
              <h2 id="team-title">Équipe</h2>
              <p>Les comptes rattachés à cette société.</p>
            </div>
          </header>
          {people.length === 0 ? (
            <p className="muted">Aucun utilisateur pour l'instant.</p>
          ) : (
            <ul className="people">
              {people.map((p) => {
                const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email;
                return (
                  <li key={String(p.id)} className="person">
                    <span className="avatar" aria-hidden="true">
                      {initials(p.firstName, p.lastName, p.email)}
                    </span>
                    <div className="person__text">
                      <strong>{name}</strong>
                      <span>{p.email}</span>
                    </div>
                    <Pill tone={p.role === 'COMPANY_ADMIN' ? 'brand' : 'neutral'}>{PERSON_ROLE[p.role] ?? p.role}</Pill>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card as="section" aria-labelledby="wallets-title" className="section-card">
          <header className="section-card__head">
            <span className="section-card__icon">
              <Icon name="wallet" size={20} />
            </span>
            <div className="section-card__title">
              <h2 id="wallets-title">Portefeuilles de la société</h2>
              <p>Un portefeuille par devise prise en charge.</p>
            </div>
          </header>
          {wallets.length === 0 ? (
            <p className="muted">Aucun portefeuille actif.</p>
          ) : (
            <ul className="wallets">
              {wallets.map((w) => (
                <li key={String(w.id)} className="wallet">
                  <span className="wallet__cur">{w.currency}</span>
                  <strong>{formatAmount(w.balance, w.currency)}</strong>
                  {w.isDefault ? <Pill tone="brand">Par défaut</Pill> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card tone="flat" className="danger-zone">
          <div>
            <h2>Supprimer cette société</h2>
            <p>
              La société, ses utilisateurs, ses agences et ses portefeuilles sont désactivés. Les soldes
              restants ne sont pas transférés.
            </p>
          </div>
          <Button variant="secondary" icon="trash" className="btn--danger-outline" onClick={openDelete}>
            Supprimer
          </Button>
        </Card>
      </div>

      <ConfirmDialog
        open={statusTarget !== null}
        title={statusTarget === 'ACTIVE' ? `Réactiver ${company.name} ?` : `Suspendre ${company.name} ?`}
        confirmLabel={statusTarget === 'ACTIVE' ? 'Réactiver' : 'Suspendre'}
        busy={statusBusy}
        onConfirm={() => void applyStatus()}
        onCancel={() => {
          setStatusTarget(null);
          setStatusError(null);
        }}
      >
        <p>
          {statusTarget === 'ACTIVE'
            ? "Le statut d'abonnement repasse à « Active »."
            : "Le statut d'abonnement passe à « Suspendue ». Le serveur applique aujourd'hui ce statut aux opérations de trésorerie ; la connexion des utilisateurs n'est pas bloquée."}
        </p>
        {statusError ? <Notice tone="error">{statusError}</Notice> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteOpen}
        title={`Supprimer ${company.name} ?`}
        confirmLabel="Supprimer définitivement"
        tone="danger"
        busy={deleteBusy}
        confirmDisabled={confirmCode.trim().toUpperCase() !== company.code}
        onConfirm={() => void removeCompany()}
        onCancel={() => setDeleteOpen(false)}
      >
        <p>
          Les comptes de la société ne pourront plus se connecter et son code de portail est libéré.
          Cette action ne peut pas être annulée depuis la console.
        </p>
        <Field
          id="confirm-code"
          label={`Tapez ${company.code} pour confirmer`}
          value={confirmCode}
          onChange={(e) => setConfirmCode(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {deleteError ? <Notice tone="error">{deleteError}</Notice> : null}
      </ConfirmDialog>
    </>
  );
}
