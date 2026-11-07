// src/pages/kyc/KycQueuePage.tsx
// Vérifications d'identité : la file des dossiers à valider (le plus ancien d'abord), les refusés, ceux qui n'ont rien envoyé.
// Le serveur filtre, recherche et pagine : on ne charge que ce qui est affiché.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { KycQueueFilter, KycQueueItem, Page } from '@direct-transfair/shared';
import { KYC_DOC_LABEL, KYC_STATUS_LABEL, can } from '@direct-transfair/shared';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { OVERALL_TONE, KYC_TABS, waitingLabel, waitingTone } from '../../lib/kycRules';
import { MOBILE_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { usePagedList } from '../../lib/usePagedList';
import { useResource } from '../../lib/useResource';
import { formatDateTime, initialsOf } from '../../lib/userRules';
import { useCurrentUser } from '../../providers/AuthProvider';

const PAGE_SIZE = 20;
type Row = KycQueueItem & { id: string };

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function QueueCard({ item }: { item: Row }) {
  const waiting = item.status === 'PENDING' ? waitingLabel(item.submittedAt) : null;
  const tone = waitingTone(item.submittedAt);
  return (
    <li>
      <Link to={`/kyc/${encodeURIComponent(item.userId)}`} className="wc-card kyc-card">
        <div className="wc-card__head">
          <span className="avatar wc-card__avatar" aria-hidden="true">
            {initialsOf({ firstName: item.name?.split(' ')[0] ?? null, lastName: item.name?.split(' ').slice(1).join(' ') || null, email: item.email ?? '' })}
          </span>
          <div className="wc-card__text">
            <strong>{item.name ?? 'Client sans nom'}</strong>
            <span>{item.phone ?? item.email}</span>
          </div>
          <Icon name="chevronRight" size={18} />
        </div>
        <div className="wc-card__foot">
          <Pill tone={OVERALL_TONE[item.status]} icon={item.status === 'VERIFIED' ? 'check' : 'shield'}>
            {KYC_STATUS_LABEL[item.status]}
          </Pill>
          {item.pendingTypes.map((t) => (
            <Pill key={t} tone="neutral">
              {KYC_DOC_LABEL[t]}
            </Pill>
          ))}
        </div>
        {waiting ? (
          <p className={`kyc-card__wait kyc-card__wait--${tone}`}>
            <Icon name="info" size={14} /> En attente depuis {waiting}
          </p>
        ) : item.status === 'NOT_SUBMITTED' || item.status === 'REJECTED' ? (
          <p className="kyc-card__wait">Inscrit le {formatDateTime(item.createdAt)}</p>
        ) : null}
      </Link>
    </li>
  );
}

export default function KycQueuePage() {
  const user = useCurrentUser();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [tab, setTab] = useState<KycQueueFilter>('PENDING');
  const [query, setQuery] = useState('');
  const search = useDebounced(query.trim());

  const stats = useResource(() => api.kyc.adminStats(), []);
  const list = usePagedList<Row>(
    async (page): Promise<Page<Row>> => {
      const r = await api.kyc.adminQueue({ status: tab, search, page, limit: PAGE_SIZE });
      return {
        data: r.items.map((i) => ({ ...i, id: i.userId })),
        meta: { total: r.total, page: r.page, limit: r.limit, totalPages: Math.max(1, Math.ceil(r.total / r.limit)) },
      };
    },
    [tab, search],
  );

  const s = stats.data;
  const counts: Partial<Record<KycQueueFilter, number>> = s
    ? { PENDING: s.pending, REJECTED: s.rejected, NOT_SUBMITTED: s.notSubmitted, APPROVED: s.approved }
    : {};
  const oldest = s?.oldestPendingAt ? waitingLabel(s.oldestPendingAt) : null;

  function refresh() {
    list.reload();
    stats.reload();
  }

  return (
    <>
      <PageHeader
        title="Vérifications d'identité"
        description="Les clients ne peuvent envoyer, virer ni retirer qu'une fois leur identité validée ici. Traitez d'abord les dossiers les plus anciens."
        actions={
          <>
            {can(user, 'KYC_COUNTER') ? (
              <Link className="btn btn--secondary" to="/kyc/passage">
                <Icon name="users" size={18} />
                <span>Clients de passage</span>
              </Link>
            ) : null}
            <Button variant="secondary" icon="refresh" onClick={refresh}>
              Actualiser
            </Button>
          </>
        }
      />

      {s ? (
        <ul className="ag-stats kyc-stats" aria-label="Résumé des vérifications">
          <li className={s.pending > 0 ? 'ag-stats__warn' : undefined}>
            <span>À valider</span>
            <strong>{s.pending}</strong>
          </li>
          <li>
            <span>Refusés</span>
            <strong>{s.rejected}</strong>
          </li>
          <li>
            <span>Rien envoyé</span>
            <strong>{s.notSubmitted}</strong>
          </li>
          <li>
            <span>Vérifiés</span>
            <strong>{s.approved}</strong>
          </li>
        </ul>
      ) : null}
      {oldest ? (
        <p className="kyc-oldest">
          <Icon name="info" size={15} /> Le plus ancien dossier attend depuis {oldest}.
        </p>
      ) : null}

      <div className="toolbar toolbar--inline">
        <div className="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mobile ? 'Rechercher' : 'Nom, téléphone ou e-mail'}
            aria-label="Rechercher un client"
          />
        </div>
        <div className="toolbar__filters">
          <FilterTabs
            id="kyc-status"
            label="Filtrer les dossiers"
            value={tab}
            onChange={setTab}
            options={KYC_TABS.map((t) => ({ id: t.id, label: t.label, ...(counts[t.id] !== undefined ? { count: counts[t.id] as number } : {}) }))}
          />
        </div>
      </div>

      {list.loading && list.items.length === 0 ? (
        <div className="center-block">
          <Spinner label="Chargement des dossiers" />
        </div>
      ) : list.error && list.items.length === 0 ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les dossiers"
            action={
              <button type="button" className="link-btn" onClick={list.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(list.error).message}
          </Notice>
        </Card>
      ) : list.items.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name={tab === 'PENDING' ? 'check' : 'search'} size={26} />
          </span>
          <h2>{tab === 'PENDING' && !search ? 'Aucun dossier en attente' : 'Aucun résultat'}</h2>
          <p>{tab === 'PENDING' && !search ? 'Tout est à jour : chaque pièce reçue a été traitée.' : 'Aucun client ne correspond à ces filtres.'}</p>
        </Card>
      ) : (
        <>
          <ul className="wc-grid kyc-grid">
            {list.items.map((i) => (
              <QueueCard key={i.id} item={i} />
            ))}
          </ul>
          {list.moreError ? (
            <Notice tone="error">{describeError(list.moreError).message}</Notice>
          ) : null}
          {list.hasMore ? (
            <div className="more">
              <Button variant="secondary" busy={list.loadingMore} onClick={list.loadMore}>
                Afficher plus ({list.total - list.items.length} restants)
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
