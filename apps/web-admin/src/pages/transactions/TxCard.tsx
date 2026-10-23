// src/pages/transactions/TxCard.tsx
// Une carte par opération, partagée par l'historique des transactions, la fiche d'un client wallet
// et les mouvements de caisse des agences.

import { Link } from 'react-router-dom';
import type { Transaction } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Pill } from '../../components/ui';
import { statusLabel, statusTone, viewFor } from '../../lib/transactionRules';

export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function TxCard({ tx, viewer, showCompany }: { tx: Transaction; viewer: { id: string | number; role: string }; showCompany: boolean }) {
  const view = viewFor(tx, viewer);
  const company = showCompany ? tx.client?.name : null;
  const agency = tx.agency?.name ?? null;

  return (
    <li>
      <Link
        to={`/transactions/${encodeURIComponent(tx.id)}`}
        className="tx-card"
        aria-label={`${view.title}, ${view.amount}, ${statusLabel(tx.status)}`}
      >
        <span className={`tx-card__icon tx-card__icon--${view.flow}`} aria-hidden="true">
          <Icon name={view.icon} size={20} />
        </span>
        <div className="tx-card__text">
          <strong className="tx-card__title">{view.title}</strong>
          <span className="tx-card__sub">{view.subtitle}</span>
          {agency ? (
            <span className="tx-card__agency" title="Agence dont la caisse a bougé">
              <Icon name="building" size={14} />
              <span>{agency}</span>
            </span>
          ) : null}
          {company ? <span className="tx-card__company">{company}</span> : null}
        </div>
        <div className="tx-card__amount">
          <strong className={`tx-amount tx-amount--${view.flow}`}>
            {view.flow === 'in' ? '+ ' : view.flow === 'out' ? '− ' : ''}
            {view.amount}
          </strong>
          {view.amountNote ? <span>{view.amountNote}</span> : null}
        </div>
        <div className="tx-card__foot">
          <Pill tone={statusTone(tx.status)}>{statusLabel(tx.status)}</Pill>
          {tx.isFlagged ? (
            <Pill tone="danger" icon="alert">
              Signalée
            </Pill>
          ) : null}
          <span className="tx-card__meta">
            <time dateTime={tx.createdAt}>{shortDate(tx.createdAt)}</time>
            <span className="tx-card__ref">{tx.reference}</span>
          </span>
        </div>
      </Link>
    </li>
  );
}
