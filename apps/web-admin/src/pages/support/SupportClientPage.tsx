// apps/web-admin/src/pages/support/SupportClientPage.tsx
// Fiche d'un client pour le service client. Chaque bouton n'existe que si l'administrateur a délégué l'action correspondante :
//   Suspendre → ACCOUNT_SUSPEND · Réactiver → ACCOUNT_REACTIVATE · Vérifier l'identité → KYC_REVIEW
//   Demandes du client → TICKETS_HANDLE · Opérations récentes → TRANSACTIONS_VIEW

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { can } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, TextAreaField } from '../../components/form';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { statusLabel, statusTone, typeLabel } from '../../lib/transactionRules';
import { useResource } from '../../lib/useResource';
import { formatDateTime, fullName, initialsOf } from '../../lib/userRules';
import { useCurrentUser } from '../../providers/AuthProvider';
import { useDialogAction } from '../treasury/useDialogAction';

function SuspendDialog({ id, name, onClose, onDone }: { id: string; name: string; onClose: () => void; onDone: (m: string) => void }) {
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const { busy, error, run } = useDialogAction(onDone);

  return (
    <ConfirmDialog
      open
      title="Suspendre ce compte"
      confirmLabel="Suspendre"
      tone="danger"
      busy={busy}
      onConfirm={() => {
        if (reason.trim().length < 5) return setProblem('Indiquez le motif (5 caractères minimum).');
        void run(async () => {
          await api.support.suspendClient(id, reason.trim());
          return `${name} est suspendu. Il a été prévenu.`;
        });
      }}
      onCancel={onClose}
    >
      <div className="dialog-form">
        <p>{name} ne pourra plus se connecter ni effectuer d'opération, et ses sessions seront fermées immédiatement.</p>
        <TextAreaField
          id="sp-suspend"
          label="Motif"
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

export default function SupportClientPage() {
  const { id = '' } = useParams();
  const me = useCurrentUser();
  const res = useResource(() => api.support.client(id), [id]);
  const [dialog, setDialog] = useState<'suspend' | 'reactivate' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const reactivate = useDialogAction((m) => {
    setDialog(null);
    setMessage(m);
    res.reload();
  });

  if (res.loading && !res.data) {
    return (
      <div className="center-block">
        <Spinner label="Chargement du client" />
      </div>
    );
  }
  if (res.error || !res.data) {
    return (
      <Card>
        <Notice tone="error" title="Client introuvable" action={<Link to="/support/clients" className="link-btn">Retour aux clients</Link>}>
          {describeError(res.error).message}
        </Notice>
      </Card>
    );
  }

  const { client, recentTransactions, openTickets } = res.data;
  const name = fullName(client);
  const canSuspend = can(me, 'ACCOUNT_SUSPEND') && !client.suspended;
  const canReactivate = can(me, 'ACCOUNT_REACTIVATE') && client.suspended;

  return (
    <>
      <PageHeader
        title={name}
        description={client.email}
        actions={
          <Link to="/support/clients" className="btn btn--secondary">
            <Icon name="arrowLeft" size={18} />
            <span>Clients</span>
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
          <div className="sp-client__head">
            <span className="avatar sp-client__avatar" aria-hidden="true">
              {initialsOf(client)}
            </span>
            <div className="sp-client__pills">
              {client.suspended ? <Pill tone="danger">Suspendu</Pill> : <Pill tone="ok">Actif</Pill>}
              <Pill tone={client.kycLevel === 'LEVEL_0' ? 'warn' : 'neutral'} icon="shield">
                {client.kycLevel === 'LEVEL_0' ? 'Identité non vérifiée' : 'Identité vérifiée'}
              </Pill>
            </div>
          </div>

          <dl className="kv">
            <div className="kv__row">
              <dt>Téléphone</dt>
              <dd>{client.phone ?? '—'}</dd>
            </div>
            <div className="kv__row">
              <dt>Pays</dt>
              <dd>{client.country ?? '—'}</dd>
            </div>
            <div className="kv__row">
              <dt>Inscrit le</dt>
              <dd>{formatDateTime(client.createdAt) ?? '—'}</dd>
            </div>
            <div className="kv__row">
              <dt>Dernière connexion</dt>
              <dd>{formatDateTime(client.lastLoginAt) ?? 'Jamais connecté'}</dd>
            </div>
            {client.suspended ? (
              <div className="kv__row">
                <dt>Suspendu</dt>
                <dd>
                  {formatDateTime(client.suspendedAt) ?? ''}
                  {client.suspendedReason ? ` — ${client.suspendedReason}` : ''}
                </dd>
              </div>
            ) : null}
            {openTickets != null ? (
              <div className="kv__row">
                <dt>Demandes en cours</dt>
                <dd>{openTickets}</dd>
              </div>
            ) : null}
          </dl>

          <div className="sp-actions">
            {can(me, 'KYC_REVIEW') ? (
              <Link className="btn btn--secondary" to={`/kyc/${encodeURIComponent(client.id)}`}>
                <Icon name="shield" size={18} />
                <span>Vérifier l'identité</span>
              </Link>
            ) : null}
            {can(me, 'TICKETS_HANDLE') && (openTickets ?? 0) > 0 ? (
              <Link className="btn btn--secondary" to={`/support/tickets?search=${encodeURIComponent(client.email)}`}>
                <Icon name="list" size={18} />
                <span>Ses demandes</span>
              </Link>
            ) : null}
            {canSuspend ? (
              <Button variant="danger" onClick={() => setDialog('suspend')}>
                Suspendre le compte
              </Button>
            ) : null}
            {canReactivate ? (
              <Button variant="primary" onClick={() => setDialog('reactivate')}>
                Réactiver le compte
              </Button>
            ) : null}
          </div>
        </Card>

        {recentTransactions ? (
          <Card className="section-card">
            <header className="section-card__head">
              <span className="section-card__icon">
                <Icon name="list" size={20} />
              </span>
              <div className="section-card__title">
                <h2>Dernières opérations</h2>
              </div>
            </header>
            {recentTransactions.length === 0 ? (
              <p className="muted">Aucune opération.</p>
            ) : (
              <ul className="sp-tx">
                {recentTransactions.map((t) => (
                  <li key={t.id}>
                    <Link to={`/support/transactions/${encodeURIComponent(t.id)}`} className="sp-tx__row">
                      <div>
                        <strong>{typeLabel(t.type)}</strong>
                        <span>{t.reference}</span>
                      </div>
                      <div className="sp-tx__right">
                        <strong>{formatAmount(t.total, t.currency)}</strong>
                        <Pill tone={statusTone(t.status)}>{statusLabel(t.status)}</Pill>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}
      </div>

      {dialog === 'suspend' ? (
        <SuspendDialog
          id={client.id}
          name={name}
          onClose={() => setDialog(null)}
          onDone={(m) => {
            setDialog(null);
            setMessage(m);
            res.reload();
          }}
        />
      ) : null}
      {dialog === 'reactivate' ? (
        <ConfirmDialog
          open
          title="Réactiver ce compte"
          confirmLabel="Réactiver"
          busy={reactivate.busy}
          onConfirm={() =>
            void reactivate.run(async () => {
              await api.support.reactivateClient(client.id);
              return `${name} est réactivé. Il a été prévenu.`;
            })
          }
          onCancel={() => setDialog(null)}
        >
          <div className="dialog-form">
            <p>{name} pourra de nouveau se connecter et utiliser son portefeuille.</p>
            {reactivate.error ? <Notice tone="error">{reactivate.error}</Notice> : null}
          </div>
        </ConfirmDialog>
      ) : null}
    </>
  );
}
