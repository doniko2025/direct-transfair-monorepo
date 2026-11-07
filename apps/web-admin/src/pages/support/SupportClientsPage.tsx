// apps/web-admin/src/pages/support/SupportClientsPage.tsx
// Service client — les clients wallet de la société (lecture ; actions sur la fiche selon les délégations).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SupportClient } from '@direct-transfair/shared';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { toPage } from '../../lib/supportRules';
import { useDebounced } from '../../lib/useDebounced';
import { MOBILE_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { usePagedList } from '../../lib/usePagedList';
import { fullName, initialsOf } from '../../lib/userRules';

type Tab = 'ALL' | 'ACTIVE' | 'SUSPENDED';

export default function SupportClientsPage() {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('ALL');
  const search = useDebounced(query.trim());

  const list = usePagedList<SupportClient>(async (page) => toPage(await api.support.clients({ search, status: tab, page, limit: 20 })), [search, tab]);

  return (
    <>
      <PageHeader title="Clients" description="Les clients wallet de votre société. Ouvrez une fiche pour agir selon les droits que votre administrateur vous a donnés." />

      <div className="toolbar toolbar--inline">
        <div className="search">
          <Icon name="search" size={18} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={mobile ? 'Rechercher' : 'Nom, email ou téléphone'} aria-label="Rechercher un client" />
        </div>
        <div className="toolbar__filters">
          <FilterTabs
            id="sp-clients-status"
            label="Filtrer les clients"
            value={tab}
            onChange={setTab}
            options={[
              { id: 'ALL', label: 'Tous' },
              { id: 'ACTIVE', label: 'Actifs' },
              { id: 'SUSPENDED', label: 'Suspendus' },
            ]}
          />
        </div>
      </div>

      {list.loading && list.items.length === 0 ? (
        <div className="center-block">
          <Spinner label="Chargement des clients" />
        </div>
      ) : list.error ? (
        <Card>
          <Notice tone="error" title="Impossible de charger les clients" action={<button type="button" className="link-btn" onClick={list.reload}>Réessayer</button>}>
            {describeError(list.error).message}
          </Notice>
        </Card>
      ) : list.items.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Aucun client</h2>
          <p>Aucun client ne correspond à cette recherche.</p>
        </Card>
      ) : (
        <>
          <ul className="wc-grid">
            {list.items.map((c) => (
              <li key={c.id}>
                <Link to={`/support/clients/${encodeURIComponent(c.id)}`} className="wc-card">
                  <div className="wc-card__head">
                    <span className="avatar wc-card__avatar" aria-hidden="true">
                      {initialsOf(c)}
                    </span>
                    <div className="wc-card__text">
                      <strong>{fullName(c)}</strong>
                      <span>{c.phone ?? c.email}</span>
                    </div>
                    <Icon name="chevronRight" size={18} />
                  </div>
                  <div className="wc-card__foot">
                    {c.suspended ? <Pill tone="danger">Suspendu</Pill> : <Pill tone="ok">Actif</Pill>}
                    <Pill tone={c.kycLevel === 'LEVEL_0' ? 'warn' : 'neutral'} icon="shield">
                      {c.kycLevel === 'LEVEL_0' ? 'Identité non vérifiée' : 'Identité vérifiée'}
                    </Pill>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {list.hasMore ? (
            <div className="center-block">
              <Button variant="secondary" busy={list.loadingMore} onClick={list.loadMore}>
                Afficher plus ({list.total - list.items.length})
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
