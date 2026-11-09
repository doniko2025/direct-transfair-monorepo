// apps/web-admin/src/pages/merchants/MerchantPage.tsx
// Fiche d'un marchand : commerce, destination des retraits (masquée), derniers encaissements et retraits, suspension / réactivation.

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MERCHANT_STATUS_LABEL, PAYMENT_STATUS_LABEL, PAYOUT_METHOD_LABEL, PAYOUT_STATUS_LABEL } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, TextAreaField } from '../../components/form';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { MERCHANT_TONE, ownerName, PAYMENT_TONE, PAYOUT_TONE } from '../../lib/merchantRules';
import { useResource } from '../../lib/useResource';
import { formatDateTime } from '../../lib/userRules';
import { useDialogAction } from '../treasury/useDialogAction';

function SuspendDialog({ userId, name, onClose, onDone }: { userId: string; name: string; onClose: () => void; onDone: (m: string) => void }) {
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const { busy, error, run } = useDialogAction(onDone);
  return (
    <ConfirmDialog
      open
      title="Suspendre ce marchand"
      confirmLabel="Suspendre"
      tone="danger"
      busy={busy}
      onCancel={onClose}
      onConfirm={() => {
        if (reason.trim().length < 5) return setProblem('Indiquez le motif (5 caractères minimum).');
        void run(async () => {
          await api.merchants.suspend(userId, reason.trim());
          return `${name} est suspendu. Ses QR code ouverts sont annulés et il a été prévenu.`;
        });
      }}
    >
      <div className="dialog-form">
        <p>{name} ne pourra plus encaisser ni retirer. Les demandes en attente sont annulées. Son solde reste intact.</p>
        <TextAreaField
          id="mc-suspend"
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

export default function MerchantPage() {
  const { userId = '' } = useParams();
  const res = useResource(() => api.merchants.get(userId), [userId]);
  const [dialog, setDialog] = useState<'suspend' | 'reactivate' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const reactivate = useDialogAction((m) => {
    setDialog(null);
    setMessage(m);
    res.reload();
  });

  const m = res.data;
  const done = (text: string) => {
    setDialog(null);
    setMessage(text);
    res.reload();
  };

  return (
    <>
      <PageHeader
        title={m?.businessName ?? 'Marchand'}
        description={m ? `${ownerName(m.owner)}${m.city ? ` · ${m.city}` : ''}` : undefined}
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

      {res.loading && !m ? (
        <div className="center-block">
          <Spinner label="Chargement du marchand" />
        </div>
      ) : res.error || !m ? (
        <Card>
          <Notice tone="error" title="Marchand introuvable" action={<button type="button" className="link-btn" onClick={res.reload}>Réessayer</button>}>
            {describeError(res.error).message}
          </Notice>
        </Card>
      ) : (
        <div className="stack">
          <Card className="mc-detail">
            <div className="mc-detail__pills">
              <Pill tone={MERCHANT_TONE[m.status]}>{MERCHANT_STATUS_LABEL[m.status]}</Pill>
              {m.payoutLockedUntil ? <Pill tone="warn" icon="shield">Retraits bloqués jusqu’au {formatDateTime(m.payoutLockedUntil)}</Pill> : null}
            </div>
            <dl className="kv">
              <div className="kv__row"><dt>Responsable</dt><dd>{ownerName(m.owner)}</dd></div>
              <div className="kv__row"><dt>Téléphone du responsable</dt><dd>{m.owner.phone ?? '—'}</dd></div>
              <div className="kv__row"><dt>E-mail du responsable</dt><dd>{m.owner.email}</dd></div>
              <div className="kv__row"><dt>Catégorie</dt><dd>{m.category ?? '—'}</dd></div>
              <div className="kv__row"><dt>RCCM</dt><dd>{m.rccm ?? 'Non renseigné'}</dd></div>
              <div className="kv__row"><dt>NIF / IFU</dt><dd>{m.taxId ?? '—'}</dd></div>
              <div className="kv__row"><dt>Adresse du commerce</dt><dd>{[m.address, m.district, [m.postalCode, m.city].filter(Boolean).join(' '), m.country].filter(Boolean).join(', ') || 'Non renseignée'}</dd></div>
              <div className="kv__row"><dt>Téléphone du commerce</dt><dd>{m.businessPhone ?? '—'}</dd></div>
              <div className="kv__row"><dt>Orange Money de retrait</dt><dd>{m.orangeMoneyMasked || '—'}</dd></div>
              <div className="kv__row"><dt>Compte bancaire</dt><dd>{m.bank ? `${m.bank.holderName ?? ''} · ${m.bank.ibanMasked}` : '—'}</dd></div>
              <div className="kv__row"><dt>Destination modifiée</dt><dd>{formatDateTime(m.destinationChangedAt) ?? 'Jamais'}</dd></div>
              <div className="kv__row"><dt>Marchand depuis</dt><dd>{formatDateTime(m.createdAt) ?? '—'}</dd></div>
              {m.status === 'SUSPENDED' && m.suspendedReason ? <div className="kv__row"><dt>Motif de suspension</dt><dd>{m.suspendedReason}</dd></div> : null}
            </dl>
            <div className="mc-actions">
              {m.status === 'ACTIVE' ? (
                <Button variant="danger" onClick={() => setDialog('suspend')}>Suspendre le marchand</Button>
              ) : (
                <Button variant="primary" busy={reactivate.busy} onClick={() => void reactivate.run(async () => { await api.merchants.reactivate(userId); return `${m.businessName} est réactivé.`; })}>
                  Réactiver le marchand
                </Button>
              )}
              <Link className="btn btn--secondary" to={`/merchants/payouts`}>
                <Icon name="withdraw" size={18} />
                <span>Retraits</span>
              </Link>
            </div>
            {reactivate.error ? <Notice tone="error">{reactivate.error}</Notice> : null}
          </Card>

          <Card className="section-card">
            <header className="section-card__head">
              <span className="section-card__icon"><Icon name="wallet" size={20} /></span>
              <div className="section-card__title"><h2>Derniers encaissements</h2></div>
            </header>
            {m.recentPayments.length === 0 ? (
              <p className="muted">Aucun encaissement.</p>
            ) : (
              <ul className="mc-lines">
                {m.recentPayments.map((p) => (
                  <li key={p.id} className="mc-line">
                    <div className="mc-line__main">
                      <strong>{formatAmount(p.amount, p.currency)}</strong>
                      <span className="muted">{p.method === 'QR' ? 'QR code' : 'Téléphone'} · {p.reference}</span>
                    </div>
                    <div className="mc-line__side">
                      <Pill tone={PAYMENT_TONE[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Pill>
                      <span className="muted">{formatDateTime(p.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="section-card">
            <header className="section-card__head">
              <span className="section-card__icon"><Icon name="withdraw" size={20} /></span>
              <div className="section-card__title"><h2>Derniers retraits</h2></div>
            </header>
            {m.recentPayouts.length === 0 ? (
              <p className="muted">Aucun retrait.</p>
            ) : (
              <ul className="mc-lines">
                {m.recentPayouts.map((p) => (
                  <li key={p.id} className="mc-line">
                    <div className="mc-line__main">
                      <strong>{formatAmount(p.amount, p.currency)}</strong>
                      <span className="muted">{PAYOUT_METHOD_LABEL[p.method]} · {p.reference}</span>
                    </div>
                    <div className="mc-line__side">
                      <Pill tone={PAYOUT_TONE[p.status]}>{PAYOUT_STATUS_LABEL[p.status]}</Pill>
                      <span className="muted">{formatDateTime(p.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {dialog === 'suspend' && m ? <SuspendDialog userId={userId} name={m.businessName} onClose={() => setDialog(null)} onDone={done} /> : null}
    </>
  );
}
