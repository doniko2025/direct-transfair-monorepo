// apps/web-admin/src/pages/support/SupportTicketPage.tsx
// Fil d'une demande. Chaque action n'apparaît que si elle est déléguée :
//   répondre / prendre en charge / clôturer → TICKETS_HANDLE · trancher un litige → DISPUTES_RESOLVE · remboursement → REFUNDS_DECIDE ou DISPUTES_RESOLVE

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { OUTCOME_LABEL, TICKET_STATUS_LABEL, can, type TicketDetail, type TicketOutcome } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, SelectField, TextAreaField } from '../../components/form';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { OUTCOME_TONE, PRIORITY_LABEL, TICKET_TONE } from '../../lib/supportRules';
import { statusLabel, statusTone, typeLabel } from '../../lib/transactionRules';
import { useResource } from '../../lib/useResource';
import { formatDateTime } from '../../lib/userRules';
import { useCurrentUser } from '../../providers/AuthProvider';
import { useDialogAction } from '../treasury/useDialogAction';
import { RefundRequestDialog } from './RefundRequestDialog';

function ResolveDialog({ detail, onClose, onDone }: { detail: TicketDetail; onClose: () => void; onDone: (m: string) => void }) {
  const dispute = detail.ticket.isDispute;
  const [outcome, setOutcome] = useState<TicketOutcome>(dispute ? 'ACCEPTED' : 'INFO');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const { busy, error, run } = useDialogAction(onDone);

  return (
    <ConfirmDialog
      open
      title={dispute ? 'Trancher le litige' : 'Marquer comme traitée'}
      confirmLabel="Valider"
      busy={busy}
      onCancel={onClose}
      onConfirm={() => {
        if (note.trim().length < 5) return setProblem('Expliquez la décision au client (5 caractères minimum).');
        void run(async () => {
          await api.support.resolveTicket(detail.ticket.id, outcome, note.trim());
          return 'La demande est traitée. Le client a été prévenu.';
        });
      }}
    >
      <div className="dialog-form">
        {dispute ? (
          <SelectField
            id="sp-outcome"
            label="Décision"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as TicketOutcome)}
            options={(['ACCEPTED', 'REJECTED', 'INFO'] as const).map((o) => ({ value: o, label: OUTCOME_LABEL[o] }))}
          />
        ) : null}
        <TextAreaField
          id="sp-resolve-note"
          label="Message au client"
          value={note}
          error={problem}
          maxLength={1000}
          onChange={(e) => {
            setNote(e.target.value);
            setProblem(null);
          }}
          hint="Ce message lui est envoyé par notification et par email."
        />
        {outcome === 'ACCEPTED' && dispute ? <Notice tone="info">Accepter un litige ne rembourse rien automatiquement : créez ensuite une demande de remboursement si besoin.</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}

export default function SupportTicketPage() {
  const { id = '' } = useParams();
  const me = useCurrentUser();
  const res = useResource(() => api.support.ticket(id), [id]);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [replyProblem, setReplyProblem] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'resolve' | 'refund' | 'close' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const after = (m: string) => {
    setDialog(null);
    setMessage(m);
    res.reload();
  };
  const send = useDialogAction((m) => {
    setReply('');
    setInternal(false);
    after(m);
  });
  const take = useDialogAction(after);
  const close = useDialogAction(after);

  if (res.loading && !res.data) {
    return (
      <div className="center-block">
        <Spinner label="Chargement de la demande" />
      </div>
    );
  }
  if (res.error || !res.data) {
    return (
      <Card>
        <Notice tone="error" title="Demande introuvable" action={<Link to="/support/tickets" className="link-btn">Retour aux demandes</Link>}>
          {describeError(res.error).message}
        </Notice>
      </Card>
    );
  }

  const detail = res.data;
  const { ticket: t, replies, transaction, refundRequests } = detail;
  const finished = t.status === 'RESOLVED' || t.status === 'CLOSED';
  const canHandle = can(me, 'TICKETS_HANDLE');
  const canResolveDispute = can(me, 'DISPUTES_RESOLVE');
  const canResolve = canHandle && (!t.isDispute || canResolveDispute);
  const canAskRefund = !!transaction && can(me, 'REFUNDS_DECIDE', 'DISPUTES_RESOLVE') && !refundRequests.some((r) => r.status === 'PENDING');

  return (
    <>
      <PageHeader
        title={t.subject}
        description={t.user ? `${t.user.name} · ${t.user.email}` : undefined}
        actions={
          <Link to="/support/tickets" className="btn btn--secondary">
            <Icon name="arrowLeft" size={18} />
            <span>Demandes</span>
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
            <Pill tone={TICKET_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Pill>
            {t.isDispute ? (
              <Pill tone="warn" icon="alert">
                Litige
              </Pill>
            ) : null}
            <Pill>{PRIORITY_LABEL[t.priority] ?? t.priority}</Pill>
            {t.outcome ? <Pill tone={OUTCOME_TONE[t.outcome]}>{OUTCOME_LABEL[t.outcome]}</Pill> : null}
          </div>
          {t.resolutionNote ? <p className="sp-note">Décision : {t.resolutionNote}</p> : null}

          <div className="sp-actions">
            {t.user ? (
              <Link className="btn btn--secondary" to={`/support/clients/${encodeURIComponent(t.user.id)}`}>
                <Icon name="user" size={18} />
                <span>Fiche client</span>
              </Link>
            ) : null}
            {canHandle && !finished && !t.assignedTo ? (
              <Button variant="secondary" busy={take.busy} onClick={() => void take.run(async () => { await api.support.takeTicket(t.id); return 'Vous avez pris cette demande en charge.'; })}>
                Prendre en charge
              </Button>
            ) : null}
            {canAskRefund ? (
              <Button variant="secondary" onClick={() => setDialog('refund')}>
                Demander un remboursement
              </Button>
            ) : null}
            {canResolve && !finished ? <Button onClick={() => setDialog('resolve')}>{t.isDispute ? 'Trancher le litige' : 'Marquer traitée'}</Button> : null}
            {canHandle && t.status === 'RESOLVED' ? (
              <Button variant="ghost" onClick={() => setDialog('close')}>
                Clôturer
              </Button>
            ) : null}
          </div>
          {t.isDispute && canHandle && !canResolveDispute && !finished ? (
            <p className="muted">Vous pouvez répondre au client, mais la décision finale sur un litige n'est pas déléguée à votre compte.</p>
          ) : null}
          {take.error ? <Notice tone="error">{take.error}</Notice> : null}
        </Card>

        {transaction ? (
          <Card className="section-card">
            <header className="section-card__head">
              <span className="section-card__icon">
                <Icon name="swap" size={20} />
              </span>
              <div className="section-card__title">
                <h2>Opération contestée</h2>
              </div>
            </header>
            <Link to={`/support/transactions/${encodeURIComponent(transaction.id)}`} className="sp-tx__row">
              <div>
                <strong>{typeLabel(transaction.type)}</strong>
                <span>{transaction.reference}</span>
              </div>
              <div className="sp-tx__right">
                <strong>{formatAmount(transaction.total, transaction.currency)}</strong>
                <Pill tone={statusTone(transaction.status)}>{statusLabel(transaction.status)}</Pill>
              </div>
            </Link>
          </Card>
        ) : null}

        <Card className="section-card">
          <header className="section-card__head">
            <span className="section-card__icon">
              <Icon name="mail" size={20} />
            </span>
            <div className="section-card__title">
              <h2>Échanges</h2>
            </div>
          </header>
          <ol className="sp-thread">
            <li className="sp-msg">
              <div className="sp-msg__head">
                <strong>{t.user?.name ?? 'Client'}</strong>
                <small>{formatDateTime(t.createdAt)}</small>
              </div>
              <p>{t.message}</p>
            </li>
            {replies.map((r) => (
              <li key={r.id} className={['sp-msg', r.author.isStaff ? 'sp-msg--staff' : '', r.internal ? 'sp-msg--internal' : ''].filter(Boolean).join(' ')}>
                <div className="sp-msg__head">
                  <strong>{r.fromMe ? 'Vous' : r.author.name}</strong>
                  {r.internal ? <Pill tone="warn">Note interne</Pill> : null}
                  <small>{formatDateTime(r.createdAt)}</small>
                </div>
                <p>{r.message}</p>
              </li>
            ))}
          </ol>

          {canHandle && t.status !== 'CLOSED' ? (
            <form
              className="sp-reply"
              onSubmit={(e) => {
                e.preventDefault();
                if (reply.trim().length < 2) return setReplyProblem('Écrivez votre réponse.');
                void send.run(async () => {
                  await api.support.replyTicket(t.id, reply.trim(), internal);
                  return internal ? 'Note interne ajoutée.' : 'Réponse envoyée au client.';
                });
              }}
            >
              <TextAreaField id="sp-reply" label="Votre réponse" value={reply} error={replyProblem} maxLength={2000} onChange={(e) => { setReply(e.target.value); setReplyProblem(null); }} />
              <label className="sp-check">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                <span>Note interne (invisible pour le client)</span>
              </label>
              {send.error ? <Notice tone="error">{send.error}</Notice> : null}
              <Button type="submit" busy={send.busy} icon="send">
                {internal ? 'Ajouter la note' : 'Envoyer'}
              </Button>
            </form>
          ) : null}
          {!canHandle ? <p className="muted">Le traitement des demandes n'est pas délégué à votre compte : lecture seule.</p> : null}
        </Card>
      </div>

      {dialog === 'resolve' ? <ResolveDialog detail={detail} onClose={() => setDialog(null)} onDone={after} /> : null}
      {dialog === 'refund' && transaction ? <RefundRequestDialog tx={transaction} ticketId={t.id} onClose={() => setDialog(null)} onDone={after} /> : null}
      {dialog === 'close' ? (
        <ConfirmDialog
          open
          title="Clôturer la demande"
          confirmLabel="Clôturer"
          busy={close.busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => void close.run(async () => { await api.support.closeTicket(t.id); return 'Demande clôturée.'; })}
        >
          <div className="dialog-form">
            <p>Le client ne pourra plus y répondre.</p>
            {close.error ? <Notice tone="error">{close.error}</Notice> : null}
          </div>
        </ConfirmDialog>
      ) : null}
    </>
  );
}
