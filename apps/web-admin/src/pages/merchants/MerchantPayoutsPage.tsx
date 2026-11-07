// apps/web-admin/src/pages/merchants/MerchantPayoutsPage.tsx
// Retraits des marchands à traiter. Le montant a déjà été débité du portefeuille du marchand :
//   « Payé »   → vous avez envoyé l'argent (Orange Money / virement) ; saisissez la référence de l'opérateur ;
//   « Refuser » → le marchand est recrédité intégralement, avec votre motif.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PAYOUT_METHOD_LABEL, PAYOUT_STATUS_LABEL, type MerchantPayoutAdmin, type MerchantPayoutStatus } from '@direct-transfair/shared';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, TextAreaField } from '../../components/form';
import { Button, Card, Field, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { PAYOUT_TONE, toPayoutPage } from '../../lib/merchantRules';
import { usePagedList } from '../../lib/usePagedList';
import { formatDateTime } from '../../lib/userRules';
import { useDialogAction } from '../treasury/useDialogAction';

type Tab = MerchantPayoutStatus;

function PaidDialog({ payout, onClose, onDone }: { payout: MerchantPayoutAdmin; onClose: () => void; onDone: (m: string) => void }) {
  const [ref, setRef] = useState('');
  const { busy, error, run } = useDialogAction(onDone);
  return (
    <ConfirmDialog
      open
      title="Confirmer l’envoi"
      confirmLabel="C’est payé"
      busy={busy}
      onCancel={onClose}
      onConfirm={() =>
        void run(async () => {
          await api.merchants.markPayoutPaid(payout.id, ref.trim() || undefined);
          return 'Retrait marqué payé. Le marchand a été prévenu.';
        })
      }
    >
      <div className="dialog-form">
        <p>
          Confirmez que vous avez envoyé <strong>{formatAmount(payout.netAmount, payout.currency)}</strong> à{' '}
          <strong>{payout.merchant.businessName ?? payout.merchant.name}</strong> par {PAYOUT_METHOD_LABEL[payout.method]} vers <strong>{payout.destination}</strong>.
        </p>
        <Field id="mc-ref" label="Référence de l’opérateur (facultatif)" value={ref} maxLength={80} onChange={(e) => setRef(e.target.value)} />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}

function RejectDialog({ payout, onClose, onDone }: { payout: MerchantPayoutAdmin; onClose: () => void; onDone: (m: string) => void }) {
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const { busy, error, run } = useDialogAction(onDone);
  return (
    <ConfirmDialog
      open
      title="Refuser le retrait"
      confirmLabel="Refuser"
      tone="danger"
      busy={busy}
      onCancel={onClose}
      onConfirm={() => {
        if (reason.trim().length < 3) return setProblem('Indiquez le motif.');
        void run(async () => {
          await api.merchants.rejectPayout(payout.id, reason.trim());
          return 'Retrait refusé. Le montant a été remis sur le portefeuille du marchand.';
        });
      }}
    >
      <div className="dialog-form">
        <p>
          <strong>{formatAmount(payout.amount, payout.currency)}</strong> seront recrédités à {payout.merchant.businessName ?? payout.merchant.name}.
        </p>
        <TextAreaField
          id="mc-reject"
          label="Motif du refus"
          value={reason}
          error={problem}
          maxLength={300}
          onChange={(e) => {
            setReason(e.target.value);
            setProblem(null);
          }}
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}

export default function MerchantPayoutsPage() {
  const [tab, setTab] = useState<Tab>('PENDING');
  const [pending, setPending] = useState(0);
  const [dialog, setDialog] = useState<{ payout: MerchantPayoutAdmin; kind: 'paid' | 'reject' } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const list = usePagedList<MerchantPayoutAdmin>(
    async (page) => {
      const r = await api.merchants.payouts({ status: tab, page, limit: 20 });
      setPending(r.pendingCount);
      return toPayoutPage(r);
    },
    [tab],
  );

  const done = (text: string) => {
    setDialog(null);
    setMessage(text);
    list.reload();
  };

  return (
    <>
      <PageHeader
        title="Retraits des marchands"
        description="Le montant est déjà débité du portefeuille du marchand. Envoyez l’argent à la destination indiquée, puis confirmez ; ou refusez pour le recréditer."
        actions={
          <Link to="/merchants" className="btn btn--secondary">
            <Icon name="arrowLeft" size={18} />
            <span>Marchands</span>
          </Link>
        }
      />
      {message ? (
        <div className="stack stack--tight">
          <Notice tone="ok" title={message} action={<button type="button" className="link-btn" onClick={() => setMessage(null)}>Fermer</button>} />
        </div>
      ) : null}

      <div className="toolbar toolbar--inline">
        <FilterTabs<Tab>
          id="mc-payout-tab"
          label="Filtrer les retraits"
          value={tab}
          onChange={setTab}
          options={[
            { id: 'PENDING', label: 'À traiter', count: pending },
            { id: 'PAID', label: 'Payés' },
            { id: 'REJECTED', label: 'Refusés' },
          ]}
        />
      </div>

      {list.loading && list.items.length === 0 ? (
        <div className="center-block">
          <Spinner label="Chargement des retraits" />
        </div>
      ) : list.error ? (
        <Card>
          <Notice tone="error" title="Impossible de charger les retraits" action={<button type="button" className="link-btn" onClick={list.reload}>Réessayer</button>}>
            {describeError(list.error).message}
          </Notice>
        </Card>
      ) : list.items.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon"><Icon name="check" size={26} /></span>
          <h2>Aucun retrait</h2>
          <p>Rien dans cette liste pour le moment.</p>
        </Card>
      ) : (
        <>
          <ul className="mc-grid">
            {list.items.map((p) => (
              <li key={p.id} className="mc-payout">
                <div className="mc-payout__head">
                  <div className="mc-payout__who">
                    <strong>{p.merchant.businessName ?? p.merchant.name}</strong>
                    <span className="muted">{p.merchant.name}{p.merchant.phone ? ` · ${p.merchant.phone}` : ''}</span>
                  </div>
                  <Pill tone={PAYOUT_TONE[p.status]}>{PAYOUT_STATUS_LABEL[p.status]}</Pill>
                </div>
                <p className="mc-payout__amount">{formatAmount(p.netAmount, p.currency)}</p>
                <dl className="kv kv--compact">
                  <div className="kv__row"><dt>Débité</dt><dd>{formatAmount(p.amount, p.currency)}{p.fee > 0 ? ` (commission ${formatAmount(p.fee, p.currency)})` : ''}</dd></div>
                  <div className="kv__row"><dt>{PAYOUT_METHOD_LABEL[p.method]}</dt><dd className="mc-break">{p.destination}</dd></div>
                  {p.destinationLabel && p.method === 'BANK_TRANSFER' ? <div className="kv__row"><dt>Titulaire</dt><dd>{p.destinationLabel}</dd></div> : null}
                  <div className="kv__row"><dt>Demandé le</dt><dd>{formatDateTime(p.createdAt)}</dd></div>
                  <div className="kv__row"><dt>Référence</dt><dd>{p.reference}</dd></div>
                  {p.providerRef ? <div className="kv__row"><dt>Réf. opérateur</dt><dd className="mc-break">{p.providerRef}</dd></div> : null}
                  {p.failureReason ? <div className="kv__row"><dt>Motif</dt><dd>{p.failureReason}</dd></div> : null}
                </dl>
                {p.status === 'PENDING' ? (
                  <div className="mc-actions">
                    <Button onClick={() => setDialog({ payout: p, kind: 'paid' })}>Payé</Button>
                    <Button variant="danger" onClick={() => setDialog({ payout: p, kind: 'reject' })}>Refuser</Button>
                  </div>
                ) : null}
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

      {dialog?.kind === 'paid' ? <PaidDialog payout={dialog.payout} onClose={() => setDialog(null)} onDone={done} /> : null}
      {dialog?.kind === 'reject' ? <RejectDialog payout={dialog.payout} onClose={() => setDialog(null)} onDone={done} /> : null}
    </>
  );
}
