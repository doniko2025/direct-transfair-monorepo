// src/pages/treasury/WalletLedgerPage.tsx
// Mouvements d'un portefeuille : une carte par écriture, de la plus récente à la plus ancienne.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, type LedgerEntry } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { LEDGER_LABEL, LEDGER_TONE, ledgerSign } from '../../lib/treasuryRules';
import { formatDateTime } from '../../lib/userRules';
import { useResource } from '../../lib/useResource';

const PAGE = 30;

export default function WalletLedgerPage() {
  const { id = '' } = useParams();
  const wallets = useResource(() => api.treasury.wallets().catch(() => []), []);
  const first = useResource(() => api.treasury.ledger(id, 1, PAGE), [id]);

  const [more, setMore] = useState<LedgerEntry[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  // Un nouveau chargement de la première page (autre portefeuille, actualisation) repart de zéro.
  useEffect(() => {
    setMore([]);
    setPage(1);
    setMoreError(null);
  }, [id, first.data]);

  const back = (
    <Link to="/treasury" className="btn btn--secondary">
      <Icon name="arrowLeft" size={18} />
      <span>Trésorerie</span>
    </Link>
  );

  const denied = !id || (first.error instanceof ApiError && (first.error.status === 404 || first.error.status === 403));
  if (denied) {
    return (
      <>
        <PageHeader title="Portefeuille introuvable" actions={back} />
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Ce portefeuille n’est pas accessible</h2>
          <p>Il n’existe pas, ou il n’appartient pas à votre périmètre.</p>
        </Card>
      </>
    );
  }

  if (first.loading && !first.data) {
    return (
      <div className="center-block">
        <Spinner label="Chargement des mouvements" />
      </div>
    );
  }

  if (first.error && !first.data) {
    return (
      <>
        <PageHeader title="Mouvements" actions={back} />
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les mouvements"
            action={
              <button type="button" className="link-btn" onClick={first.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(first.error).message}
          </Notice>
        </Card>
      </>
    );
  }

  const meta = first.data?.meta;
  const entries = [...(first.data?.data ?? []), ...more];
  const wallet = wallets.data?.find((w) => w.id === id);
  const total = meta?.total ?? entries.length;
  const hasMore = entries.length < total;

  async function loadMore() {
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await api.treasury.ledger(id, page + 1, PAGE);
      setMore((m) => [...m, ...next.data]);
      setPage(page + 1);
    } catch (err) {
      setMoreError(describeError(err).message);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <PageHeader
        title={wallet ? `Mouvements en ${wallet.currency}` : 'Mouvements'}
        description={wallet ? `Solde actuel : ${formatAmount(wallet.balance, wallet.currency)}` : undefined}
        actions={back}
      />

      {entries.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="list" size={26} />
          </span>
          <h2>Aucun mouvement</h2>
          <p>Les entrées et sorties de ce portefeuille apparaîtront ici.</p>
        </Card>
      ) : (
        <>
          <p className="tx-summary">
            <strong>
              {total} mouvement{total > 1 ? 's' : ''}
            </strong>
          </p>
          <ul className="ledger-list">
            {entries.map((e) => {
              const sign = ledgerSign(e.type);
              return (
                <li key={e.id} className="ledger-item">
                  <div className="ledger-item__main">
                    <Pill tone={LEDGER_TONE[e.type]}>{LEDGER_LABEL[e.type] ?? e.type}</Pill>
                    <strong className="ledger-item__desc">{e.description?.trim() || 'Sans libellé'}</strong>
                    <span className="muted">
                      <time dateTime={e.createdAt}>{formatDateTime(e.createdAt)}</time>
                      {e.transactionId ? (
                        <>
                          {' · '}
                          <Link className="link" to={`/transactions/${encodeURIComponent(e.transactionId)}`}>
                            Voir la transaction
                          </Link>
                        </>
                      ) : null}
                    </span>
                  </div>
                  <div className="ledger-item__amount">
                    <strong className={e.type === 'CREDIT' ? 'tx-amount tx-amount--in' : 'tx-amount'}>
                      {sign ? `${sign} ` : ''}
                      {formatAmount(e.amount, e.currency)}
                    </strong>
                    <span className="muted">Solde après : {formatAmount(e.balanceAfter, e.currency)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          {moreError ? (
            <div className="stack stack--tight">
              <Notice tone="error" title="Impossible de charger la suite">
                {moreError}
              </Notice>
            </div>
          ) : null}
          {hasMore ? (
            <div className="more">
              <Button variant="secondary" busy={loadingMore} onClick={() => void loadMore()}>
                Afficher {Math.min(PAGE, total - entries.length)} de plus ({total - entries.length} restants)
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
