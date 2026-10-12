// src/pages/treasury/PendingPayments.tsx
// Super admin : les virements déclarés par les sociétés, en attente d'être encaissés ou refusés.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Transaction } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/form';
import { Button, Card, Notice, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { senderName } from '../../lib/transactionRules';
import { formatDateTime } from '../../lib/userRules';
import { useResource } from '../../lib/useResource';

interface Props {
  /** Appelé après une décision : la page recharge les soldes et affiche le message. */
  onDecided: (message: string) => void;
}

export default function PendingPayments({ onDecided }: Props) {
  const { data, error, loading, reload } = useResource(
    async () => (await api.transactions.listAdmin()).filter((t) => t.type === 'SERVICE_PAYMENT' && t.status === 'PENDING'),
    [],
  );
  const [pending, setPending] = useState<{ tx: Transaction; kind: 'validate' | 'reject' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setFailure(null);
    try {
      if (pending.kind === 'validate') await api.transactions.validateB2B(pending.tx.id);
      else await api.transactions.rejectB2B(pending.tx.id);
      const amount = formatAmount(pending.tx.amount, pending.tx.currency);
      onDecided(
        pending.kind === 'validate'
          ? `Virement de ${amount} validé et crédité sur votre portefeuille.`
          : `Virement de ${amount} refusé : la société est remboursée.`,
      );
      setPending(null);
      reload();
    } catch (err) {
      setFailure(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  const list = data ?? [];

  return (
    <section aria-labelledby="pending-title" className="tr-section">
      <div className="tr-section__head">
        <h2 id="pending-title">Virements à valider</h2>
        <p>Les sociétés déclarent ici les virements qu’elles vous ont faits. Comparez la référence avec votre relevé bancaire.</p>
      </div>

      {loading && !data ? (
        <div className="center-block">
          <Spinner label="Chargement des virements" />
        </div>
      ) : error && !data ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les virements"
            action={
              <button type="button" className="link-btn" onClick={reload}>
                Réessayer
              </button>
            }
          >
            {describeError(error).message}
          </Notice>
        </Card>
      ) : list.length === 0 ? (
        <Card className="empty empty--compact">
          <span className="empty__icon">
            <Icon name="check" size={26} />
          </span>
          <h3>Aucun virement en attente</h3>
          <p>Les nouvelles déclarations apparaîtront ici.</p>
        </Card>
      ) : (
        <ul className="pay-grid">
          {list.map((tx) => (
            <li key={tx.id} className="pay-card">
              <div className="pay-card__top">
                <div>
                  <strong>{tx.client?.name ?? senderName(tx)}</strong>
                  <span className="muted">Déclaré par {senderName(tx)}</span>
                </div>
                <strong className="pay-card__amount">{formatAmount(tx.amount, tx.currency)}</strong>
              </div>
              <dl className="pay-card__meta">
                <div>
                  <dt>Référence bancaire</dt>
                  <dd>
                    <code>{tx.providerRef ?? '—'}</code>
                  </dd>
                </div>
                <div>
                  <dt>Déclaré le</dt>
                  <dd>{formatDateTime(tx.createdAt)}</dd>
                </div>
              </dl>
              <div className="pay-card__actions">
                <Button onClick={() => setPending({ tx, kind: 'validate' })}>Valider</Button>
                <Button variant="secondary" className="btn--danger-outline" onClick={() => setPending({ tx, kind: 'reject' })}>
                  Refuser
                </Button>
                <Link className="link" to={`/transactions/${encodeURIComponent(tx.id)}`}>
                  Voir la fiche
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pending ? (
        <ConfirmDialog
          open
          title={pending.kind === 'validate' ? 'Valider ce virement ?' : 'Refuser ce virement ?'}
          confirmLabel={pending.kind === 'validate' ? 'Valider et créditer' : 'Refuser et rembourser'}
          tone={pending.kind === 'reject' ? 'danger' : 'default'}
          busy={busy}
          onConfirm={() => void confirm()}
          onCancel={() => {
            setPending(null);
            setFailure(null);
          }}
        >
          <p>
            {pending.kind === 'validate'
              ? `Vous confirmez avoir reçu ${formatAmount(pending.tx.amount, pending.tx.currency)} sur votre compte bancaire. Le montant est crédité sur votre portefeuille.`
              : `${formatAmount(pending.tx.amount, pending.tx.currency)} sont rendus à la société et la déclaration est annulée. Cette décision est définitive.`}
          </p>
          <p className="muted">
            {pending.tx.client?.name ?? senderName(pending.tx)} · référence {pending.tx.providerRef ?? pending.tx.reference}
          </p>
          {failure ? <Notice tone="error">{failure}</Notice> : null}
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
