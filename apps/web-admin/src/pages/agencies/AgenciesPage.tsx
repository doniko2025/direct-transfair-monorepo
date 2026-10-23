// src/pages/agencies/AgenciesPage.tsx
// Les agences de la société : une carte par agence (responsable, équipe, fonds), recherche et filtre par type.

import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Agency, AgencyType } from '@direct-transfair/shared';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { agencyMatches, AGENCY_TYPE_LABEL, agentName, managerOf, totalsByCurrency, typeLabel } from '../../lib/agencyRules';
import { formatAmount } from '../../lib/companyRules';
import { countryName } from '../../lib/countries';
import { describeError } from '../../lib/errors';
import { useResource } from '../../lib/useResource';

type Filter = 'all' | AgencyType;

interface Flash {
  removed?: string;
  warnings?: string[];
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

function AgencyCard({ agency }: { agency: Agency }) {
  const manager = managerOf(agency);
  const agents = agency.agents?.length ?? 0;
  const place = [agency.city, countryName(agency.country)].filter(Boolean).join(', ');

  return (
    <li>
      <Link to={`/agencies/${encodeURIComponent(agency.id)}`} className="ag-card">
        <div className="ag-card__head">
          <span className="ag-card__icon" aria-hidden="true">
            <Icon name="building" size={22} />
          </span>
          <div className="ag-card__title">
            <strong>{agency.name}</strong>
            <span>{place}</span>
          </div>
          <Pill tone={agency.type === 'PARTNER' ? 'neutral' : 'brand'}>{typeLabel(agency.type)}</Pill>
        </div>

        {agency.isActive ? (
          <p className="ag-card__manager">
            {manager ? (
              <>
                <Icon name="user" size={16} />
                <span>{agentName(manager)}</span>
              </>
            ) : (
              <Pill tone="warn">Aucun responsable</Pill>
            )}
          </p>
        ) : null}

        {agency.wallets && agency.wallets.length > 0 ? (
          <ul className="ag-card__funds">
            {agency.wallets.map((w) => (
              <li key={String(w.id)}>{formatAmount(w.balance, w.currency)}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">Pas encore de caisse.</p>
        )}

        <div className="ag-card__foot">
          <span>{agents === 0 ? 'Aucun agent' : plural(agents, 'agent', 'agents')}</span>
          {!agency.isActive ? <Pill tone="neutral">Désactivée</Pill> : null}
          {agency.isCertified ? <Pill tone="ok" icon="shield">Certifiée</Pill> : null}
        </div>
      </Link>
    </li>
  );
}

export default function AgenciesPage() {
  const navigate = useNavigate();
  const flash = (useLocation().state ?? null) as Flash | null;
  const [flashVisible, setFlashVisible] = useState(Boolean(flash?.removed));

  const { data, error, loading, reload } = useResource(() => api.agencies.list(), []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const agencies = data ?? [];

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agencies.filter((a) => agencyMatches(a, q));
  }, [agencies, query]);

  const visible = useMemo(() => (filter === 'all' ? scoped : scoped.filter((a) => a.type === filter)), [scoped, filter]);

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'Toutes', count: scoped.length },
    { id: 'SUBSIDIARY', label: `${AGENCY_TYPE_LABEL.SUBSIDIARY}s`, count: scoped.filter((a) => a.type === 'SUBSIDIARY').length },
    { id: 'PARTNER', label: `${AGENCY_TYPE_LABEL.PARTNER}s`, count: scoped.filter((a) => a.type === 'PARTNER').length },
  ];

  const totals = useMemo(() => totalsByCurrency(agencies), [agencies]);
  const agentTotal = agencies.reduce((n, a) => n + (a.agents?.length ?? 0), 0);
  const withoutManager = agencies.filter((a) => a.isActive && !a.managerId).length;

  return (
    <>
      <PageHeader
        title="Agences"
        description="Les points de service de votre société : responsable, équipe et fonds en caisse."
        actions={
          <Button icon="plus" onClick={() => navigate('/agencies/new')}>
            Nouvelle agence
          </Button>
        }
      />

      {flashVisible && flash?.removed ? (
        <div className="stack stack--tight">
          <Notice
            tone="ok"
            title={`L'agence ${flash.removed} a été désactivée.`}
            action={
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setFlashVisible(false);
                  navigate('.', { replace: true, state: null });
                }}
              >
                Fermer
              </button>
            }
          >
            {flash.warnings && flash.warnings.length > 0 ? flash.warnings.join(' ') : 'Ses agents ne peuvent plus se connecter.'}
          </Notice>
        </div>
      ) : null}

      {data && agencies.length > 0 ? (
        <ul className="ag-stats" aria-label="Résumé du réseau">
          <li>
            <span>Agences</span>
            <strong>{agencies.length}</strong>
          </li>
          <li>
            <span>Agents</span>
            <strong>{agentTotal}</strong>
          </li>
          <li className={withoutManager > 0 ? 'ag-stats__warn' : undefined}>
            <span>Sans responsable</span>
            <strong>{withoutManager}</strong>
          </li>
          <li className="ag-stats__funds">
            <span>Fonds en caisse</span>
            {totals.length === 0 ? (
              <strong>0</strong>
            ) : (
              <strong>
                {totals.map((t) => (
                  <span key={t.currency}>{formatAmount(t.amount, t.currency)}</span>
                ))}
              </strong>
            )}
          </li>
        </ul>
      ) : null}

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, ville, code ou responsable"
            aria-label="Rechercher une agence"
          />
        </div>
        <div className="toolbar__filters">
          <FilterTabs
            id="agencies-type"
            label="Filtrer par type"
            rowOnDesktop
            value={filter}
            onChange={setFilter}
            options={tabs}
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="center-block">
          <Spinner label="Chargement des agences" />
        </div>
      ) : error ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les agences"
            action={
              <button type="button" className="link-btn" onClick={reload}>
                Réessayer
              </button>
            }
          >
            {describeError(error).message}
          </Notice>
        </Card>
      ) : agencies.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="building" size={26} />
          </span>
          <h2>Aucune agence pour l'instant</h2>
          <p>Créez votre première agence : son responsable reçoit un accès pour gérer la caisse et son équipe.</p>
          <Link to="/agencies/new" className="btn btn--primary">
            <Icon name="plus" size={18} />
            <span>Créer une agence</span>
          </Link>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Aucun résultat</h2>
          <p>Aucune agence ne correspond à cette recherche.</p>
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
        <ul className="ag-grid">
          {visible.map((a) => (
            <AgencyCard key={a.id} agency={a} />
          ))}
        </ul>
      )}
    </>
  );
}
