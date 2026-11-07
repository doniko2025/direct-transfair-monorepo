// apps/web-admin/src/pages/support/SupportTicketsPage.tsx
// Service client — demandes d'assistance et litiges (une demande liée à une opération = un litige).

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TICKET_STATUS_LABEL, type Ticket, type TicketStatus } from '@direct-transfair/shared';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { PRIORITY_LABEL, TICKET_TONE, toPage } from '../../lib/supportRules';
import { useDebounced } from '../../lib/useDebounced';
import { MOBILE_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { usePagedList } from '../../lib/usePagedList';
import { formatDateTime } from '../../lib/userRules';

type Tab = 'ACTIVE' | 'DISPUTES' | 'REQUESTS' | 'RESOLVED' | 'CLOSED';

function queryOf(tab: Tab): { status: string; kind?: 'DISPUTE' | 'REQUEST' } {
  switch (tab) {
    case 'DISPUTES':
      return { status: 'ACTIVE', kind: 'DISPUTE' };
    case 'REQUESTS':
      return { status: 'ACTIVE', kind: 'REQUEST' };
    case 'RESOLVED':
      return { status: 'RESOLVED' };
    case 'CLOSED':
      return { status: 'CLOSED' };
    default:
      return { status: 'ACTIVE' };
  }
}

export default function SupportTicketsPage() {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('kind') === 'DISPUTE' ? 'DISPUTES' : 'ACTIVE');
  const [query, setQuery] = useState(params.get('search') ?? '');
  const [mine, setMine] = useState(false);
  const [counts, setCounts] = useState<Partial<Record<TicketStatus, number>>>({});
  const search = useDebounced(query.trim());

  const list = usePagedList<Ticket>(
    async (page) => {
      const r = await api.support.tickets({ ...queryOf(tab), search, mine, page, limit: 20 });
      setCounts(r.byStatus);
      return toPage(r);
    },
    [tab, search, mine],
  );

  const active = (counts.OPEN ?? 0) + (counts.IN_PROGRESS ?? 0) + (counts.WAITING_USER ?? 0);

  return (
    <>
      <PageHeader title="Demandes et litiges" description="Répondez aux clients. Une demande liée à une opération est un litige : seule la décision finale demande une délégation dédiée." />

      <div className="toolbar toolbar--inline">
        <div className="search">
          <Icon name="search" size={18} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={mobile ? 'Rechercher' : 'Sujet, nom ou email du client'} aria-label="Rechercher une demande" />
        </div>
        <FilterTabs<Tab>
          label="Filtrer les demandes"
          id="sp-ticket-tab"
          value={tab}
          onChange={setTab}
          options={[
            { id: 'ACTIVE', label: 'En cours', count: active },
            { id: 'DISPUTES', label: 'Litiges' },
            { id: 'REQUESTS', label: 'Questions' },
            { id: 'RESOLVED', label: 'Traitées', count: counts.RESOLVED ?? 0 },
            { id: 'CLOSED', label: 'Clôturées', count: counts.CLOSED ?? 0 },
          ]}
        />
        <label className="sp-check">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          <span>Les miennes</span>
        </label>
      </div>

      {list.loading && list.items.length === 0 ? (
        <div className="center-block">
          <Spinner label="Chargement des demandes" />
        </div>
      ) : list.error ? (
        <Card>
          <Notice tone="error" title="Impossible de charger les demandes" action={<button type="button" className="link-btn" onClick={list.reload}>Réessayer</button>}>
            {describeError(list.error).message}
          </Notice>
        </Card>
      ) : list.items.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="check" size={26} />
          </span>
          <h2>Rien à traiter ici</h2>
          <p>Aucune demande ne correspond à ce filtre.</p>
        </Card>
      ) : (
        <>
          <ul className="sp-tickets">
            {list.items.map((t) => (
              <li key={t.id}>
                <Link to={`/support/tickets/${encodeURIComponent(t.id)}`} className="sp-ticket">
                  <div className="sp-ticket__top">
                    <strong>{t.subject}</strong>
                    <Pill tone={TICKET_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Pill>
                  </div>
                  <p className="sp-ticket__excerpt">{t.message}</p>
                  <div className="sp-ticket__meta">
                    {t.isDispute ? (
                      <Pill tone="warn" icon="alert">
                        Litige
                      </Pill>
                    ) : null}
                    {t.priority === 'HIGH' || t.priority === 'URGENT' ? <Pill tone="danger">{PRIORITY_LABEL[t.priority]}</Pill> : null}
                    <span>{t.user?.name ?? '—'}</span>
                    <span>{formatDateTime(t.updatedAt)}</span>
                    {t.repliesCount ? <span>{t.repliesCount} message(s)</span> : null}
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
