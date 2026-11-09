// apps/web-admin/src/pages/support/SupportRefundsPage.tsx
// Remboursements en attente. Règle des quatre yeux : on ne valide jamais sa propre demande.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { REFUND_STATUS_LABEL, type RefundRequest, type RefundStatus } from '@direct-transfair/shared';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, TextAreaField } from '../../components/form';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { REFUND_TONE, toPage } from '../../lib/supportRules';
import { usePagedList } from '../../lib/usePagedList';
import { formatDateTime } from '../../lib/userRules';
import { useDialogAction } from '../treasury/useDialogAction';

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FAILED';

function DecideDialog({ refund, approve, onClose, onDone }: { refund: RefundRequest; approve: boolean; onClose: () => void; onDone: (m: string) => void }) {
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const { busy, error, run } = useDialogAction(onDone);

  return (
    <ConfirmDialog
      open
      title={approve ? 'Accepter le remboursement' : 'Refuser le remboursement'}
      confirmLabel={approve ? 'Rembourser' : 'Refuser'}
      tone={approve ? 'default' : 'danger'}
      busy={busy}
      onCancel={onClose}
      onConfirm={() => {
        if (!approve && note.trim().length < 5) return setProblem('Indiquez pourquoi (5 caractères minimum).');
        void run(async () => {
          const r = await api.support.decideRefund(refund.id, approve, note.trim() || undefined);
          return r.status === 'FAILED' ? 'Cette opération ne peut plus être remboursée ici : à traiter hors plateforme.' : approve ? 'Remboursement effectué. Le client a été prévenu.' : 'Demande refusée. Le client a été prévenu.';
        });
      }}
    >
      <div className="dialog-form">
        <p>
          {approve ? 'Le client sera recrédité de' : 'Aucun mouvement d\'argent pour'} <strong>{formatAmount(refund.amount, refund.currency)}</strong>
          {refund.reference ? ` (envoi ${refund.reference})` : ''}.
        </p>
        <TextAreaField
          id="sp-decide-note"
          label={approve ? 'Commentaire (facultatif)' : 'Motif du refus'}
          value={note}
          error={problem}
          maxLength={500}
          onChange={(e) => {
            setNote(e.target.value);
            setProblem(null);
          }}
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}

export default function SupportRefundsPage() {
  const [tab, setTab] = useState<Tab>('PENDING');
  const [pending, setPending] = useState(0);
  const [dialog, setDialog] = useState<{ refund: RefundRequest; approve: boolean } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const list = usePagedList<RefundRequest>(
    async (page) => {
      const r = await api.support.refunds({ status: tab as RefundStatus, page, limit: 20 });
      setPending(r.pending);
      return toPage(r);
    },
    [tab],
  );

  return (
    <>
      <PageHeader title="Remboursements" description="Remboursements demandés par l'équipe. Une demande doit toujours être validée par une autre personne que celle qui l'a créée." />
      {message ? (
        <div className="stack stack--tight">
          <Notice tone="ok" title={message} action={<button type="button" className="link-btn" onClick={() => setMessage(null)}>Fermer</button>} />
        </div>
      ) : null}

      <div className="toolbar toolbar--inline">
        <FilterTabs<Tab>
          label="Filtrer les remboursements"
          id="sp-refund-tab"
          value={tab}
          onChange={setTab}
          options={[
            { id: 'PENDING', label: 'À valider', count: pending },
            { id: 'APPROVED', label: 'Remboursés' },
            { id: 'REJECTED', label: 'Refusés' },
            { id: 'FAILED', label: 'Hors plateforme' },
          ]}
        />
      </div>

      {list.loading && list.items.length === 0 ? (
        <div className="center-block">
          <Spinner label="Chargement des remboursements" />
        </div>
      ) : list.error ? (
        <Card>
          <Notice tone="error" title="Impossible de charger les remboursements" action={<button type="button" className="link-btn" onClick={list.reload}>Réessayer</button>}>
            {describeError(list.error).message}
          </Notice>
        </Card>
      ) : list.items.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="check" size={26} />
          </span>
          <h2>Aucun remboursement</h2>
          <p>Rien dans cette liste pour le moment.</p>
        </Card>
      ) : (
        <>
          <ul className="sp-refunds">
            {list.items.map((r) => (
              <li key={r.id} className="sp-refund">
                <div className="sp-refund__top">
                  <strong>{formatAmount(r.amount, r.currency)}</strong>
                  <Pill tone={REFUND_TONE[r.status]}>{REFUND_STATUS_LABEL[r.status]}</Pill>
                </div>
                <p className="sp-refund__reason">{r.reason}</p>
                <div className="sp-ticket__meta">
                  {r.customer ? <span>{r.customer}</span> : null}
                  {r.reference ? <Link to={`/support/transactions/${encodeURIComponent(r.transactionId)}`} className="link">{r.reference}</Link> : null}
                  <span>Demandé par {r.requestedBy ?? '—'}</span>
                  <span>{formatDateTime(r.createdAt)}</span>
                </div>
                {r.decisionNote ? <p className="sp-note">{r.decidedBy ? `${r.decidedBy} : ` : ''}{r.decisionNote}</p> : null}
                {r.status === 'FAILED' ? <p className="muted">Le remboursement n'a pas pu être exécuté (bénéficiaire ayant déjà dépensé la somme, envoi clos…) : voir le motif dans la décision, à régler hors plateforme si besoin.</p> : null}
                {r.status === 'PENDING' ? (
                  r.canDecide ? (
                    <div className="sp-actions">
                      <Button onClick={() => setDialog({ refund: r, approve: true })}>Accepter</Button>
                      <Button variant="secondary" onClick={() => setDialog({ refund: r, approve: false })}>
                        Refuser
                      </Button>
                    </div>
                  ) : (
                    <p className="muted">Vous avez créé cette demande : un collègue (ou l'administrateur) doit la valider.</p>
                  )
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

      {dialog ? (
        <DecideDialog
          refund={dialog.refund}
          approve={dialog.approve}
          onClose={() => setDialog(null)}
          onDone={(m) => {
            setDialog(null);
            setMessage(m);
            list.reload();
          }}
        />
      ) : null}
    </>
  );
}
