// src/pages/agencies/AgencyDetailPage.tsx
// Fiche d'une agence : informations modifiables (dont le pays : la caisse principale suit sa devise), caisse,
// équipe et désactivation.

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/form';
import { Button, Card, Field, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { AGENCY_CODE, AGENCY_TYPE_OPTIONS, PHONE, agentName, managerOf, typeLabel } from '../../lib/agencyRules';
import { EMAIL, formatAmount, formatDate } from '../../lib/companyRules';
import { COUNTRIES, countryName } from '../../lib/countries';
import { describeError } from '../../lib/errors';
import { useResource } from '../../lib/useResource';
import { initialsOf } from '../../lib/userRules';
import { EditableSection, type FieldDef } from '../companies/EditableSection';

const FIELDS: readonly FieldDef[] = [
  { key: 'name', label: "Nom de l'agence", required: true, maxLength: 120, wide: true },
  { key: 'city', label: 'Ville', required: true, maxLength: 80 },
  {
    key: 'country',
    label: 'Pays',
    kind: 'select',
    required: true,
    options: COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
    hint: 'En changeant de pays, la caisse principale passe dans la devise du nouveau pays. L’ancienne caisse reste visible avec son solde.',
  },
  { key: 'address', label: 'Adresse', required: true, maxLength: 200 },
  {
    key: 'phone',
    label: 'Téléphone',
    kind: 'tel',
    maxLength: 25,
    hint: 'Format international. C’est aussi le numéro du responsable.',
    validate: (v) => (PHONE.test(v) ? null : 'Numéro de téléphone invalide.'),
  },
  {
    key: 'code',
    label: 'Code agence',
    maxLength: 16,
    hint: 'Majuscules, chiffres et tiret. Exemple : CKY-01.',
    validate: (v) => (AGENCY_CODE.test(v) ? null : '2 à 16 caractères : majuscules, chiffres, tiret.'),
  },
  {
    key: 'email',
    label: 'Email du responsable',
    kind: 'email',
    required: true,
    maxLength: 160,
    hint: 'C’est son identifiant de connexion.',
    validate: (v) => (EMAIL.test(v) ? null : 'Adresse email invalide.'),
  },
  { key: 'managerName', label: 'Nom du responsable', maxLength: 120, hint: 'Prénom puis nom.' },
  { key: 'type', label: 'Type', kind: 'select', options: AGENCY_TYPE_OPTIONS },
];

export default function AgencyDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useResource(() => api.agencies.get(id), [id]);

  const [removeOpen, setRemoveOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const backLink = (
    <Link to="/agencies" className="btn btn--secondary">
      <Icon name="arrowLeft" size={18} />
      <span>Toutes les agences</span>
    </Link>
  );

  const notFound =
    !id || (!loading && !error && !data) || (error instanceof ApiError && (error.status === 404 || error.status === 403));

  if (notFound) {
    return (
      <>
        <PageHeader title="Agence introuvable" actions={backLink} />
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Cette agence n'est pas accessible</h2>
          <p>Elle n'existe pas, ou elle n'appartient pas à votre société.</p>
        </Card>
      </>
    );
  }

  if (loading && !data) {
    return (
      <div className="center-block">
        <Spinner label="Chargement de l'agence" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Agence" actions={backLink} />
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger l'agence"
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

  const agency = data;
  const manager = managerOf(agency);
  const agents = agency.agents ?? [];
  const wallets = agency.wallets ?? [];
  const place = [agency.city, countryName(agency.country)].filter(Boolean).join(', ');
  const balanced = wallets.every((w) => Number(w.balance) === 0);
  const since = formatDate(agency.createdAt);
  const editable = agency.isActive;

  const values: Record<string, string | null | undefined> = {
    name: agency.name,
    city: agency.city,
    country: agency.country ? agency.country.toUpperCase() : '',
    address: agency.address,
    phone: agency.phone,
    code: agency.code,
    email: agency.email,
    managerName: manager ? [manager.firstName, manager.lastName].filter(Boolean).join(' ') : '',
    type: agency.type,
  };

  async function save(patch: Record<string, string | null>) {
    await api.agencies.update(agency.id, patch);
    reload();
  }

  async function remove() {
    setBusy(true);
    setActionError(null);
    try {
      const result = await api.agencies.remove(agency.id);
      navigate('/agencies', { replace: true, state: { removed: agency.name, warnings: result.warnings ?? [] } });
    } catch (err) {
      setActionError(describeError(err).message);
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={agency.name} actions={backLink} />

      <div className="stack">
        <Card className="company-hero">
          <span className="ag-card__icon ag-hero__icon" aria-hidden="true">
            <Icon name="building" size={30} />
          </span>
          <div className="company-hero__main">
            <div className="company-hero__line">
              <Pill tone={agency.type === 'PARTNER' ? 'neutral' : 'brand'}>{typeLabel(agency.type)}</Pill>
              <Pill tone={agency.isActive ? 'ok' : 'neutral'}>{agency.isActive ? 'Active' : 'Désactivée'}</Pill>
              {agency.isCertified ? (
                <Pill tone="ok" icon="shield">
                  Certifiée
                </Pill>
              ) : null}
            </div>
            <p className="company-hero__meta">
              {[place, agency.code, since ? `créée le ${since}` : null].filter(Boolean).join(' · ')}
            </p>
          </div>
          {editable ? (
            <div className="company-hero__actions">
              <Link to={`/agents/new?agency=${encodeURIComponent(agency.id)}`} className="btn btn--primary">
                <Icon name="plus" size={18} />
                <span>Ajouter un agent</span>
              </Link>
            </div>
          ) : null}
        </Card>

        {!agency.isActive ? (
          <Notice tone="info" title="Agence désactivée">
            Elle n'apparaît plus dans la liste et ses agents ne peuvent plus se connecter. Cette fiche reste consultable pour
            l'audit.
          </Notice>
        ) : !manager ? (
          <Notice tone="info" title="Cette agence n'a pas de responsable">
            Choisissez-en un parmi ses agents depuis la page Agents.
          </Notice>
        ) : null}

        <div className="detail-grid">
          <EditableSection
            id="agency-info"
            title="Informations"
            icon="building"
            description={`Caisse principale en ${agency.primaryCurrency}, la devise de ${countryName(agency.country) ?? 'son pays'}.`}
            fields={FIELDS}
            values={values}
            onSave={save}
            readOnly={!editable}
          />

          <Card as="section" aria-labelledby="ag-funds-title" className="section-card">
            <header className="section-card__head">
              <span className="section-card__icon">
                <Icon name="vault" size={20} />
              </span>
              <div className="section-card__title">
                <h2 id="ag-funds-title">Caisse</h2>
                <p>Solde par devise. Les recharges et retraits de fonds se font en trésorerie.</p>
              </div>
            </header>
            {wallets.length === 0 ? (
              <p className="muted">Cette agence n'a pas de caisse active.</p>
            ) : (
              <ul className="wallets">
                {wallets.map((w) => (
                  <li key={String(w.id)} className="wallet">
                    <span className="wallet__cur">{w.currency}</span>
                    <strong>{formatAmount(w.balance, w.currency)}</strong>
                    {Number(w.reservedBalance) > 0 ? (
                      <span className="muted wallet__sub">dont {formatAmount(w.reservedBalance, w.currency)} réservés</span>
                    ) : null}
                    {w.isDefault ? (
                      <span className="wallet__pills">
                        <Pill tone="brand">Principale</Pill>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {editable ? (
              <Link to="/treasury" className="link">
                Ouvrir la trésorerie
              </Link>
            ) : null}
          </Card>
        </div>

        <Card as="section" aria-labelledby="ag-team-title" className="section-card">
          <header className="section-card__head">
            <span className="section-card__icon">
              <Icon name="users" size={20} />
            </span>
            <div className="section-card__title">
              <h2 id="ag-team-title">Équipe</h2>
              <p>
                {agents.length === 0
                  ? "Aucun agent n'est rattaché à cette agence."
                  : `${agents.length} ${agents.length > 1 ? 'agents' : 'agent'} dans cette agence.`}
              </p>
            </div>
          </header>
          {agents.length > 0 ? (
            <ul className="people">
              {agents.map((a) => (
                <li key={a.id}>
                  <Link to={`/users/${encodeURIComponent(a.id)}`} className="person">
                    <span className="avatar" aria-hidden="true">
                      {initialsOf(a)}
                    </span>
                    <span className="person__text">
                      <strong>{agentName(a)}</strong>
                      <span>{a.email}</span>
                    </span>
                    {a.id === agency.managerId ? <Pill tone="brand">Responsable</Pill> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <Link to={`/agents?agency=${encodeURIComponent(agency.id)}`} className="link">
            Gérer les agents de cette agence
          </Link>
        </Card>

        {editable ? (
          <Card tone="flat" className="danger-zone">
            <div>
              <h2>Désactiver cette agence</h2>
              <p>
                L'agence et {agents.length === 0 ? 'son équipe' : `ses ${agents.length} agents`} ne peuvent plus se connecter.
                Les opérations passées sont conservées pour l'audit.
                {balanced ? '' : ' La caisse n’est pas vide : récupérez les fonds en trésorerie avant de désactiver.'}
              </p>
            </div>
            <Button
              variant="secondary"
              icon="trash"
              className="btn--danger-outline"
              onClick={() => {
                setConfirmName('');
                setActionError(null);
                setRemoveOpen(true);
              }}
            >
              Désactiver
            </Button>
          </Card>
        ) : null}
      </div>

      <ConfirmDialog
        open={removeOpen}
        title={`Désactiver ${agency.name} ?`}
        confirmLabel="Désactiver l'agence"
        tone="danger"
        busy={busy}
        confirmDisabled={confirmName.trim().toLowerCase() !== agency.name.trim().toLowerCase()}
        onConfirm={() => void remove()}
        onCancel={() => setRemoveOpen(false)}
      >
        <div className="dialog-form">
          <p>
            L'agence disparaît de la liste et {agents.length === 0 ? "son équipe n'a plus accès" : `ses ${agents.length} agents n'ont plus accès`} à
            l'application. Cette action ne se défait pas depuis cet écran.
          </p>
          {!balanced ? (
            <Notice tone="info" title="La caisse n'est pas vide">
              Les fonds restent enregistrés mais ne sont plus utilisables. Récupérez-les d'abord en trésorerie.
            </Notice>
          ) : null}
          <Field
            id="ag-confirm"
            label={`Tapez « ${agency.name} » pour confirmer`}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            autoComplete="off"
          />
          {actionError ? <Notice tone="error">{actionError}</Notice> : null}
        </div>
      </ConfirmDialog>
    </>
  );
}
