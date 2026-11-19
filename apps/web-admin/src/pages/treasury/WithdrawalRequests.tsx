// src/pages/treasury/WithdrawalRequests.tsx
// Double validation des retraits (audit argent I4) : un administrateur demande, UN AUTRE valide. Cartes mobile d'abord.
// Les droits (canDecide / canCancel) viennent du serveur : le demandeur ne voit jamais « Valider » sur sa propre demande.

import { useState } from 'react';
import type { TreasuryWithdrawalRequest } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, TextAreaField } from '../../components/form';
import { Button, Card, Notice, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { formatDateTime } from '../../lib/userRules';
import { useResource } from '../../lib/useResource';

interface Props {
  /** Appelé après une décision : la page recharge les soldes et affiche le message. */
  onDecided: (message: string) => void;
  /** Change quand la page recharge (ex. après une nouvelle demande). */
  refreshKey?: number;
}

type Action = { req: TreasuryWithdrawalRequest; kind: 'approve' | 'reject' | 'cancel' };

const STATUS: Record<string, { label: string; tone: 'neutral' | 'ok' | 'warn' | 'danger' }> = {
  PENDING: { label: 'À valider', tone: 'warn' },
  APPROVED: { label: 'Exécuté', tone: 'ok' },
  REJECTED: { label: 'Refusé', tone: 'danger' },
  CANCELLED: { label: 'Annulé', tone: 'neutral' },
  EXPIRED: { label: 'Expiré', tone: 'neutral' },
};

export default function WithdrawalRequests({ onDecided, refreshKey = 0 }: Props) {
  const { data, error, loading, reload } = useResource(() => api.treasury.withdrawalRequests(), [refreshKey]);
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const close = () => { setAction(null); setNote(''); setFailure(null); };

  async function confirm() {
    if (!action) return;
    setBusy(true);
    setFailure(null);
    const amount = formatAmount(action.req.amount, action.req.currency);
    try {
      if (action.kind === 'approve') {
        await api.treasury.approveWithdrawal(action.req.id);
        onDecided(`Retrait de ${amount} validé et exécuté.`);
      } else if (action.kind === 'reject') {
        await api.treasury.rejectWithdrawal(action.req.id, note.trim() || undefined);
        onDecided(`Demande de retrait de ${amount} refusée.`);
      } else {
        await api.treasury.cancelWithdrawal(action.req.id);
        onDecided(`Votre demande de retrait de ${amount} est annulée.`);
      }
      close();
      reload();
    } catch (err) {
      setFailure(describeError(err).message);
      reload();
    } finally {
      setBusy(false);
    }
  }

  const list = data ?? [];
  // Les demandes en attente d'abord ; l'historique récent en dessous (5 au plus).
  const waiting = list.filter((r) => r.status === 'PENDING');
  const history = list.filter((r) => r.status !== 'PENDING').slice(0, 5);

  return (
    <section aria-labelledby="wr-title" className="tr-section">
      <div className="tr-section__head">
        <h2 id="wr-title">Retraits à valider</h2>
        <p>Un retrait ne part qu’après la validation d’un autre administrateur de la société. Sans réponse sous 48 h, la demande expire.</p>
      </div>

      {loading && !data ? (
        <div className="center-block"><Spinner label="Chargement des demandes de retrait" /></div>
      ) : error && !data ? (
        <Card>
          <Notice tone="error" title="Impossible de charger les demandes" action={<button type="button" className="link-btn" onClick={reload}>Réessayer</button>}>
            {describeError(error).message}
          </Notice>
        </Card>
      ) : list.length === 0 ? (
        <Card className="empty empty--compact">
          <span className="empty__icon"><Icon name="check" size={26} /></span>
          <h3>Aucune demande de retrait</h3>
          <p>Les demandes apparaîtront ici.</p>
        </Card>
      ) : (
        <ul className="pay-grid">
          {[...waiting, ...history].map((r) => {
            const st = STATUS[r.status] ?? { label: r.status, tone: 'neutral' as const };
            return (
              <li key={r.id} className="pay-card wr-card" data-status={r.status}>
                <div className="pay-card__top">
                  <div>
                    <strong>{r.requestedByName ?? 'Administrateur'}</strong>
                    <span className="muted">Demandé le {formatDateTime(r.requestedAt)}</span>
                  </div>
                  <strong className="pay-card__amount">{formatAmount(r.amount, r.currency)}</strong>
                </div>
                <div className="wr-card__pills"><Pill tone={st.tone}>{st.label}</Pill></div>
                <dl className="pay-card__meta">
                  {r.reason ? <div><dt>Motif</dt><dd>{r.reason}</dd></div> : null}
                  {r.status === 'PENDING' ? <div><dt>Expire le</dt><dd>{formatDateTime(r.expiresAt)}</dd></div> : null}
                  {r.decidedByName ? <div><dt>Décidé par</dt><dd>{r.decidedByName}</dd></div> : null}
                  {r.decisionNote ? <div><dt>Note</dt><dd>{r.decisionNote}</dd></div> : null}
                </dl>
                {r.status === 'PENDING' && r.failureReason ? <Notice tone="error" title="La dernière validation a échoué">{r.failureReason}</Notice> : null}
                {r.status === 'PENDING' ? (
                  <div className="pay-card__actions">
                    {r.canDecide ? (
                      <>
                        <Button onClick={() => setAction({ req: r, kind: 'approve' })}>Valider le retrait</Button>
                        <Button variant="secondary" className="btn--danger-outline" onClick={() => setAction({ req: r, kind: 'reject' })}>Refuser</Button>
                      </>
                    ) : (
                      <span className="muted">En attente de la validation d’un autre administrateur.</span>
                    )}
                    {r.canCancel ? <button type="button" className="link-btn" onClick={() => setAction({ req: r, kind: 'cancel' })}>Annuler ma demande</button> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {action ? (
        <ConfirmDialog
          open
          title={action.kind === 'approve' ? 'Valider ce retrait ?' : action.kind === 'reject' ? 'Refuser ce retrait ?' : 'Annuler votre demande ?'}
          confirmLabel={action.kind === 'approve' ? 'Valider et exécuter' : action.kind === 'reject' ? 'Refuser' : 'Annuler la demande'}
          busy={busy}
          onCancel={close}
          onConfirm={() => void confirm()}
        >
          <div className="dialog-form">
            <p>
              {formatAmount(action.req.amount, action.req.currency)}
              {action.req.reason ? ` — ${action.req.reason}` : ''}
            </p>
            {action.kind === 'approve' ? <p>L’argent sera retiré du portefeuille de la société immédiatement. Vérifiez que cette demande est légitime.</p> : null}
            {action.kind === 'reject' ? <TextAreaField id="wr-note" label="Motif (facultatif)" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /> : null}
            {failure ? <Notice tone="error">{failure}</Notice> : null}
          </div>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
