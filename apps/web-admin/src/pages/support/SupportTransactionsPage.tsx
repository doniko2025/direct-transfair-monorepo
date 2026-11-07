// apps/web-admin/src/pages/support/SupportTransactionsPage.tsx
// Service client — recherche d'opérations en lecture seule (référence, nom, email ou téléphone de l'expéditeur).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SupportTransaction } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { SelectField } from '../../components/form';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { toPage } from '../../lib/supportRules';
import { STATUS_LABEL, statusLabel, statusTone, typeLabel } from '../../lib/transactionRules';
import { useDebounced } from '../../lib/useDebounced';
import { MOBILE_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { usePagedList } from '../../lib/usePagedList';
import { formatDateTime } from '../../lib/userRules';

export default function SupportTransactionsPage() {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const search = useDebounced(query.trim());
  const list = usePagedList<SupportTransaction>(async (page) => toPage(await api.support.transactions({ search, status, page, limit: 20 })), [search, status]);

  return (
    <>
      <PageHeader title="Opérations" description="Retrouvez une opération et son statut pour répondre à un client. Lecture seule : aucun code de retrait ni donnée de paiement n'est affiché." />

      <div className="toolbar toolbar--inline">
        <div className="search">
          <Icon name="search" size={18} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={mobile ? 'Rechercher' : 'Référence, nom, email ou téléphone'} aria-label="Rechercher une opération" />
        </div>
        <div className="toolbar__filters">
          <SelectField
            id="sp-tx-status"
            label="Statut"
            className="toolbar__select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
            placeholder="Tous les statuts"
            compactPlaceholder="Statuts"
          />
        </div>
      </div>

      {list.loading && list.items.length === 0 ? (
        <div className="center-block">
          <Spinner label="Chargement des opérations" />
        </div>
      ) : list.error ? (
        <Card>
          <Notice tone="error" title="Impossible de charger les opérations" action={<button type="button" className="link-btn" onClick={list.reload}>Réessayer</button>}>
            {describeError(list.error).message}
          </Notice>
        </Card>
      ) : list.items.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Aucune opération</h2>
          <p>Aucune opération ne correspond à cette recherche.</p>
        </Card>
      ) : (
        <>
          <ul className="sp-tx sp-tx--cards">
            {list.items.map((t) => (
              <li key={t.id}>
                <Link to={`/support/transactions/${encodeURIComponent(t.id)}`} className="sp-tx__row">
                  <div>
                    <strong>{typeLabel(t.type)}</strong>
                    <span>{t.reference}</span>
                    <span>{t.sender?.name ?? ''}</span>
                    <small>{formatDateTime(t.createdAt)}</small>
                  </div>
                  <div className="sp-tx__right">
                    <strong>{formatAmount(t.total, t.currency)}</strong>
                    <Pill tone={statusTone(t.status)}>{statusLabel(t.status)}</Pill>
                    {t.isFlagged ? <Pill tone="warn" icon="alert">Signalée</Pill> : null}
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
