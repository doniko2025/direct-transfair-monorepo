// apps/web-admin/src/pages/merchants/MerchantsPage.tsx
// Marchands de la société : cartes (jamais de tableau), recherche, filtre par statut. Une carte ouvre la fiche.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MERCHANT_STATUS_LABEL, type MerchantListItem } from '@direct-transfair/shared';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { MERCHANT_TONE, ownerName, salesLine, toMerchantPage } from '../../lib/merchantRules';
import { useDebounced } from '../../lib/useDebounced';
import { MOBILE_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { usePagedList } from '../../lib/usePagedList';
import { initialsOf } from '../../lib/userRules';

type Tab = 'ALL' | 'ACTIVE' | 'SUSPENDED';

export default function MerchantsPage() {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('ALL');
  const search = useDebounced(query.trim());

  const list = usePagedList<MerchantListItem & { id: string }>(
    async (page) => toMerchantPage(await api.merchants.list({ search, status: tab === 'ALL' ? undefined : tab, page, limit: 20 })),
    [search, tab],
  );
  const toProcess = list.items.reduce((n, m) => n + m.pendingPayouts, 0);

  return (
    <>
      <PageHeader
        title="Marchands"
        description="Les commerçants de votre société qui encaissent par téléphone ou par QR code. La commission, les durées et les plafonds se règlent dans Réglages › Comptes marchands."
        actions={
          <Link to="/merchants/payouts" className="btn btn--secondary only-desktop">
            <Icon name="withdraw" size={18} />
            <span>Retraits à traiter</span>
          </Link>
        }
      />

      {toProcess > 0 ? (
        <div className="stack stack--tight">
          <Notice tone="info" title={`${toProcess} retrait${toProcess > 1 ? 's' : ''} marchand en attente`} action={<Link className="link-btn" to="/merchants/payouts">Traiter</Link>}>
            Les marchands attendent que vous leur envoyiez l’argent.
          </Notice>
        </div>
      ) : null}

      <div className="toolbar toolbar--inline">
        <div className="search">
          <Icon name="search" size={18} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={mobile ? 'Rechercher' : 'Commerce, nom, ville ou téléphone'} aria-label="Rechercher un marchand" />
        </div>
        <Link to="/merchants/payouts" className="btn btn--secondary toolbar__icon only-mobile" aria-label={toProcess > 0 ? `Retraits à traiter : ${toProcess}` : 'Retraits à traiter'}>
          <Icon name="withdraw" size={19} />
          {toProcess > 0 ? <b className="toolbar__icon-badge">{toProcess}</b> : null}
        </Link>
        <div className="toolbar__filters">
          <FilterTabs<Tab>
            id="mc-status"
            label="Filtrer les marchands"
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
          <Spinner label="Chargement des marchands" />
        </div>
      ) : list.error ? (
        <Card>
          <Notice tone="error" title="Impossible de charger les marchands" action={<button type="button" className="link-btn" onClick={list.reload}>Réessayer</button>}>
            {describeError(list.error).message}
          </Notice>
        </Card>
      ) : list.items.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="wallet" size={26} />
          </span>
          <h2>Aucun marchand</h2>
          <p>Les clients deviennent marchands à l’inscription (« Je suis marchand ») ou depuis leur profil.</p>
        </Card>
      ) : (
        <>
          <ul className="mc-grid">
            {list.items.map((m) => (
              <li key={m.userId}>
                <Link to={`/merchants/${encodeURIComponent(m.userId)}`} className="mc-card">
                  <div className="mc-card__head">
                    <span className="avatar mc-card__avatar" aria-hidden="true">
                      {initialsOf({ firstName: m.businessName, lastName: null, email: m.owner.email })}
                    </span>
                    <div className="mc-card__text">
                      <strong>{m.businessName}</strong>
                      <span>
                        {ownerName(m.owner)}
                        {m.city ? ` · ${m.city}` : ''}
                      </span>
                      {m.rccm ? <span>RCCM {m.rccm}</span> : <span>RCCM non renseigné</span>}
                    </div>
                    <Icon name="chevronRight" size={18} />
                  </div>
                  <p className="mc-card__sales">{salesLine(m.sales, formatAmount)}</p>
                  <div className="mc-card__foot">
                    <Pill tone={MERCHANT_TONE[m.status]}>{MERCHANT_STATUS_LABEL[m.status]}</Pill>
                    <Pill tone="neutral" icon="wallet">
                      {m.orangeMoneyMasked || 'Orange Money non renseigné'}
                    </Pill>
                    {m.hasBank ? <Pill tone="neutral" icon="building">Compte bancaire</Pill> : null}
                    {m.pendingPayouts > 0 ? <Pill tone="warn" icon="withdraw">{m.pendingPayouts} retrait{m.pendingPayouts > 1 ? 's' : ''} à traiter</Pill> : null}
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
