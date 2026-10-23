// apps/web-admin/src/pages/companies/CompaniesPage.tsx
// Liste des sociétés de transfert (SUPER_ADMIN) : une carte par société, recherche et filtre par statut.

import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { CompanySummary } from '@direct-transfair/shared';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { CompanyMark } from '../../components/CompanyMark';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount, isActiveStatus, safeColor, statusLabel, statusTone } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { MOBILE_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { useResource } from '../../lib/useResource';

type Filter = 'all' | 'active' | 'attention';

interface ListState {
  deleted?: string;
  warnings?: string[];
}

function matches(c: CompanySummary, q: string): boolean {
  if (!q) return true;
  const hay = [c.name, c.code, c.customDomain, c.subdomain, c.city, c.contactEmail]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

function CompanyCard({ company }: { company: CompanySummary }) {
  const users = company._count?.users ?? 0;
  const agencies = company._count?.agencies ?? 0;
  const wallets = (company.wallets ?? []).filter((w) => Number(w.balance) !== 0).slice(0, 3);
  const domain = company.customDomain ?? (company.subdomain ? `${company.subdomain}` : null);

  return (
    <li>
      <Link to={`/companies/${company.id}`} className="company-card">
        <span
          className="company-card__bar"
          style={{
            background: `linear-gradient(90deg, ${safeColor(company.primaryColor, '#059669')} 70%, ${safeColor(company.secondaryColor, '#10B981')})`,
          }}
          aria-hidden="true"
        />
        <div className="company-card__top">
          <CompanyMark name={company.name} logoUrl={company.logoUrl} color={company.primaryColor} size={46} />
          <div className="company-card__id">
            <h2>{company.name}</h2>
            <span className="company-card__code">{company.code}</span>
          </div>
          <Icon name="chevronRight" size={18} className="company-card__chevron" />
        </div>

        <div className="company-card__status">
          <Pill tone={statusTone(company.subscriptionStatus)}>{statusLabel(company.subscriptionStatus)}</Pill>
          {domain ? (
            <span className="company-card__domain" title={domain}>
              <Icon name="globe" size={14} />
              {domain}
            </span>
          ) : (
            <span className="company-card__domain company-card__domain--none">Aucun domaine</span>
          )}
        </div>

        <dl className="company-card__facts">
          <div>
            <dt>Utilisateurs</dt>
            <dd>{users}</dd>
          </div>
          <div>
            <dt>Agences</dt>
            <dd>{agencies}</dd>
          </div>
        </dl>

        {wallets.length > 0 ? (
          <ul className="company-card__wallets" aria-label="Soldes de la société">
            {wallets.map((w) => (
              <li key={String(w.id)}>{formatAmount(w.balance, w.currency)}</li>
            ))}
          </ul>
        ) : null}
      </Link>
    </li>
  );
}

export default function CompaniesPage() {
  const navigate = useNavigate();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const location = useLocation();
  const flash = (location.state ?? null) as ListState | null;

  const { data, error, loading, reload } = useResource(() => api.companies.list(), []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [flashVisible, setFlashVisible] = useState(Boolean(flash?.deleted));

  const companies = data ?? [];
  const counts = useMemo(() => {
    const active = companies.filter((c) => isActiveStatus(c.subscriptionStatus)).length;
    return { all: companies.length, active, attention: companies.length - active };
  }, [companies]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies
      .filter((c) => matches(c, q))
      .filter((c) =>
        filter === 'all' ? true : filter === 'active' ? isActiveStatus(c.subscriptionStatus) : !isActiveStatus(c.subscriptionStatus),
      );
  }, [companies, query, filter]);

  function dismissFlash() {
    setFlashVisible(false);
    navigate('.', { replace: true, state: null });
  }

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'Toutes', count: counts.all },
    { id: 'active', label: 'Actives', count: counts.active },
    { id: 'attention', label: 'À surveiller', count: counts.attention },
  ];

  return (
    <>
      <PageHeader
        title="Sociétés"
        description="Les sociétés de transfert hébergées sur la plateforme. Chacune a son portail, ses administrateurs et sa trésorerie."
        actions={
          <Button icon="plus" onClick={() => navigate('/companies/new')}>
            Nouvelle société
          </Button>
        }
      />

      {flashVisible && flash?.deleted ? (
        <div className="stack stack--tight">
          <Notice
            tone={flash.warnings?.length ? 'info' : 'ok'}
            title={`« ${flash.deleted} » a été désactivée.`}
            action={
              <button type="button" className="link-btn" onClick={dismissFlash}>
                Fermer
              </button>
            }
          >
            {flash.warnings?.length ? flash.warnings.join(' ') : 'Ses utilisateurs, agences et portefeuilles sont désactivés.'}
          </Notice>
        </div>
      ) : null}

      <div className="toolbar toolbar--inline">
        <div className="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mobile ? 'Rechercher' : 'Rechercher par nom, code ou domaine'}
            aria-label="Rechercher une société"
          />
        </div>
        <div className="toolbar__filters">
          <FilterTabs
            id="companies-status"
            label="Filtrer par statut"
            value={filter}
            onChange={setFilter}
            options={tabs}
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="center-block">
          <Spinner label="Chargement des sociétés" />
        </div>
      ) : error ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les sociétés"
            action={
              <button type="button" className="link-btn" onClick={reload}>
                Réessayer
              </button>
            }
          >
            {describeError(error).message}
          </Notice>
        </Card>
      ) : companies.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="building" size={26} />
          </span>
          <h2>Aucune société pour l'instant</h2>
          <p>Créez la première société de transfert : son administrateur recevra ses accès par email.</p>
          <Button icon="plus" onClick={() => navigate('/companies/new')}>
            Créer une société
          </Button>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Aucun résultat</h2>
          <p>Aucune société ne correspond à cette recherche.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
          >
            Effacer les filtres
          </Button>
        </Card>
      ) : (
        <ul className="company-grid">
          {visible.map((c) => (
            <CompanyCard key={c.id} company={c} />
          ))}
        </ul>
      )}
    </>
  );
}
