// apps/web-admin/src/pages/support/SupportTransactionPage.tsx
// Une opération, en lecture seule, pour le service client. « Demander un remboursement » n'apparaît que si l'envoi est encore
// remboursable (non payé) ET que l'administrateur a délégué REFUNDS_DECIDE ou DISPUTES_RESOLVE.

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { REFUND_STATUS_LABEL, can } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { REFUND_TONE } from '../../lib/supportRules';
import { statusLabel, statusTone, typeLabel } from '../../lib/transactionRules';
import { useResource } from '../../lib/useResource';
import { formatDateTime } from '../../lib/userRules';
import { useCurrentUser } from '../../providers/AuthProvider';
import { RefundRequestDialog } from './RefundRequestDialog';

export default function SupportTransactionPage() {
  const { id = '' } = useParams();
  const me = useCurrentUser();
  const res = useResource(() => api.support.transaction(id), [id]);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (res.loading && !res.data) {
    return (
      <div className="center-block">
        <Spinner label="Chargement de l'opération" />
      </div>
    );
  }
  if (res.error || !res.data) {
    return (
      <Card>
        <Notice tone="error" title="Opération introuvable" action={<Link to="/support/transactions" className="link-btn">Retour</Link>}>
          {describeError(res.error).message}
        </Notice>
      </Card>
    );
  }

  const { transaction: t, refundable, recall, notRefundableReason, refundRequests } = res.data;
  const pending = refundRequests.some((r) => r.status === 'PENDING');
  const canAsk = refundable && !pending && can(me, 'REFUNDS_DECIDE', 'DISPUTES_RESOLVE');

  return (
    <>
      <PageHeader
        title={typeLabel(t.type)}
        description={t.reference}
        actions={
          <Link to="/support/transactions" className="btn btn--secondary">
            <Icon name="arrowLeft" size={18} />
            <span>Opérations</span>
          </Link>
        }
      />
      {message ? (
        <div className="stack stack--tight">
          <Notice tone="ok" title={message} action={<button type="button" className="link-btn" onClick={() => setMessage(null)}>Fermer</button>} />
        </div>
      ) : null}

      <div className="stack">
        <Card className="sp-client">
          <div className="sp-client__pills">
            <Pill tone={statusTone(t.status)}>{statusLabel(t.status)}</Pill>
            {t.isFlagged ? <Pill tone="warn" icon="alert">Signalée</Pill> : null}
          </div>
          <dl className="kv">
            <div className="kv__row">
              <dt>Expéditeur</dt>
              <dd>{t.sender ? <Link to={`/support/clients/${encodeURIComponent(t.sender.id)}`} className="link">{t.sender.name}</Link> : '—'}</dd>
            </div>
            <div className="kv__row">
              <dt>Montant</dt>
              <dd>{formatAmount(t.amount, t.currency)}</dd>
            </div>
            <div className="kv__row">
              <dt>Frais</dt>
              <dd>{formatAmount(t.fees, t.currency)}</dd>
            </div>
            <div className="kv__row">
              <dt>Total débité</dt>
              <dd>{formatAmount(t.total, t.currency)}</dd>
            </div>
            {t.receivedAmount != null && t.targetCurrency ? (
              <div className="kv__row">
                <dt>Reçu par le bénéficiaire</dt>
                <dd>{formatAmount(t.receivedAmount, t.targetCurrency)}</dd>
              </div>
            ) : null}
            <div className="kv__row">
              <dt>Créée le</dt>
              <dd>{formatDateTime(t.createdAt)}</dd>
            </div>
            {t.paidAt ? (
              <div className="kv__row">
                <dt>Payée le</dt>
                <dd>{formatDateTime(t.paidAt)}</dd>
              </div>
            ) : null}
            {t.cancelledAt ? (
              <div className="kv__row">
                <dt>Annulée le</dt>
                <dd>{formatDateTime(t.cancelledAt)}</dd>
              </div>
            ) : null}
          </dl>

          {canAsk ? (
            <div className="sp-actions">
              <Button variant="secondary" icon="swap" onClick={() => setAsking(true)}>
                {recall ? 'Demander le rappel de l\'envoi' : 'Demander un remboursement'}
              </Button>
            </div>
          ) : null}
          {recall ? (
            <p className="muted">
              Envoi déjà crédité sur le portefeuille du bénéficiaire : le rappel reprend la somme à son portefeuille (s'il l'a encore) et rend {recall.refundAmount} {t.currency} à l'expéditeur
              {recall.refundsFees ? ', frais compris' : ', hors frais'}.
            </p>
          ) : null}
          {!refundable ? <p className="muted">{notRefundableReason ?? 'Cette opération n\'est plus remboursable depuis la plateforme (close ou d\'un autre type).'}</p> : null}
        </Card>

        {refundRequests.length > 0 ? (
          <Card className="section-card">
            <header className="section-card__head">
              <span className="section-card__icon">
                <Icon name="swap" size={20} />
              </span>
              <div className="section-card__title">
                <h2>Demandes de remboursement</h2>
              </div>
            </header>
            <ul className="sp-tx">
              {refundRequests.map((r) => (
                <li key={r.id} className="sp-tx__row sp-tx__row--static">
                  <div>
                    <strong>{formatAmount(r.amount, r.currency)}</strong>
                    <small>{formatDateTime(r.createdAt)}</small>
                  </div>
                  <Pill tone={REFUND_TONE[r.status]}>{REFUND_STATUS_LABEL[r.status]}</Pill>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      {asking ? (
        <RefundRequestDialog
          tx={t}
          onClose={() => setAsking(false)}
          onDone={(m) => {
            setAsking(false);
            setMessage(m);
            res.reload();
          }}
        />
      ) : null}
    </>
  );
}
