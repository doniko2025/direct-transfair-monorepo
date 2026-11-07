// src/pages/kyc/CounterCustomersPage.tsx
// Clients de passage : les personnes qui ont remis du cash au guichet d'un agent sans avoir de compte. Pour chacune, la pièce
// d'identité recopiée par l'agent et les photos prises au comptoir. Le numéro de pièce est masqué dans la liste ; l'ouverture d'une
// fiche et de chaque photo est journalisée (qui, quand).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { can, type CounterCustomerListItem, type Page } from '@direct-transfair/shared';
import { useCurrentUser } from '../../providers/AuthProvider';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { formatDay } from '../../lib/kycRules';
import { MOBILE_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { usePagedList } from '../../lib/usePagedList';
import { formatDateTime, initialsOf } from '../../lib/userRules';

const PAGE_SIZE = 20;

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function CustomerCard({ item }: { item: CounterCustomerListItem }) {
  return (
    <li>
      <Link to={`/kyc/passage/${encodeURIComponent(item.id)}`} className="wc-card kyc-card">
        <div className="wc-card__head">
          <span className="avatar wc-card__avatar" aria-hidden="true">
            {initialsOf({ firstName: item.name.split(' ')[0] ?? null, lastName: item.name.split(' ').slice(1).join(' ') || null, email: '' })}
          </span>
          <div className="wc-card__text">
            <strong>{item.name}</strong>
            <span>{item.phone}</span>
          </div>
          <Icon name="chevronRight" size={18} />
        </div>
        <div className="wc-card__foot">
          <Pill tone="neutral">{item.idTypeLabel}</Pill>
          <Pill tone={item.hasPhoto ? 'ok' : 'warn'} icon={item.hasPhoto ? 'check' : 'alert'}>
            {item.hasPhoto ? 'Pièce photographiée' : 'Sans photo'}
          </Pill>
          {item.idExpired ? <Pill tone="danger">Pièce expirée</Pill> : null}
        </div>
        <p className="kyc-card__wait">
          N° {item.idNumberMasked} · expire le {formatDay(item.idExpiry)} · {item.sends} envoi{item.sends > 1 ? 's' : ''}
        </p>
      </Link>
    </li>
  );
}

export default function CounterCustomersPage() {
  const user = useCurrentUser();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [query, setQuery] = useState('');
  const search = useDebounced(query.trim());

  const list = usePagedList<CounterCustomerListItem>(
    async (page): Promise<Page<CounterCustomerListItem>> => {
      const r = await api.kyc.counterCustomers({ search, page, limit: PAGE_SIZE });
      return { data: r.items, meta: { total: r.total, page: r.page, limit: r.limit, totalPages: Math.max(1, Math.ceil(r.total / r.limit)) } };
    },
    [search],
  );

  return (
    <>
      <PageHeader
        title="Clients de passage"
        description="Personnes ayant remis du cash au guichet d'un agent. La pièce d'identité photographiée au comptoir est consultable ici ; chaque consultation est enregistrée dans le journal d'audit."
        actions={
          <>
            {can(user, 'KYC_REVIEW') ? (
              <Link className="btn btn--secondary" to="/kyc">
                <Icon name="arrowLeft" size={18} />
                <span>Vérifications KYC</span>
              </Link>
            ) : null}
            <Button variant="secondary" icon="refresh" onClick={list.reload}>
              Actualiser
            </Button>
          </>
        }
      />

      <div className="toolbar toolbar--inline">
        <div className="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mobile ? 'Rechercher' : 'Nom, téléphone ou n° de pièce'}
            aria-label="Rechercher un client de passage"
          />
        </div>
      </div>

      {list.loading && list.items.length === 0 ? (
        <div className="center-block">
          <Spinner label="Chargement des clients de passage" />
        </div>
      ) : list.error && list.items.length === 0 ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger la liste"
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
            <Icon name="search" size={26} />
          </span>
          <h2>{search ? 'Aucun résultat' : 'Aucun client de passage'}</h2>
          <p>{search ? 'Aucune fiche ne correspond à cette recherche.' : 'Les fiches apparaissent dès qu’un agent enregistre un envoi au comptoir.'}</p>
        </Card>
      ) : (
        <>
          <ul className="wc-grid kyc-grid">
            {list.items.map((i) => (
              <CustomerCard key={i.id} item={i} />
            ))}
          </ul>
          {list.moreError ? <Notice tone="error">{describeError(list.moreError).message}</Notice> : null}
          {list.hasMore ? (
            <div className="more">
              <Button variant="secondary" busy={list.loadingMore} onClick={list.loadMore}>
                Afficher plus ({list.total - list.items.length} restants)
              </Button>
            </div>
          ) : null}
        </>
      )}
      <p className="kyc-oldest">
        <Icon name="info" size={15} /> Dernière mise à jour : {formatDateTime(new Date().toISOString())}
      </p>
    </>
  );
}
