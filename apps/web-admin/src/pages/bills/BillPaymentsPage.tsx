// apps/web-admin/src/pages/bills/BillPaymentsPage.tsx
// Factures à régler (lot 14). Le client a DÉJÀ payé : l'argent est sur le portefeuille de la société. Pour chaque facture :
//   « Je m’en occupe »  → vous prévenez vos collègues que vous la réglez ;
//   « Réglée »          → vous avez payé le facturier ; saisissez le numéro de reçu (et le jeton / code éventuel) : le client reçoit son reçu ;
//   « Refuser »         → le facturier a refusé ou est injoignable : le client est remboursé avec votre motif.
// « En retard » = non réglée au-delà du délai annoncé au client par le facturier.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BILL_CATEGORY_LABEL, BILL_PAYMENT_STATUS_LABEL, type BillPaymentAdmin, type BillsStats } from '@direct-transfair/shared';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, TextAreaField } from '../../components/form';
import { Button, Card, Field, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { BILL_STATUS_TONE, categoryName, toBillPage } from '../../lib/billRules';
import { formatAmount } from '../../lib/companyRules';
import { saveBlob } from '../../lib/contractRules';
import { describeError } from '../../lib/errors';
import { usePagedList } from '../../lib/usePagedList';
import { formatDateTime } from '../../lib/userRules';
import { useDialogAction } from '../treasury/useDialogAction';

type Tab = 'OPEN' | 'LATE' | 'COMPLETED' | 'REFUNDED' | 'ALL';

const queryOf = (tab: Tab, q: string) => ({
  ...(tab === 'OPEN' ? { status: 'OPEN' as const } : tab === 'LATE' ? { late: true } : tab === 'COMPLETED' || tab === 'REFUNDED' ? { status: tab } : {}),
  ...(q.trim() ? { q: q.trim() } : {}),
});

function CompleteDialog({ payment, onClose, onDone }: { payment: BillPaymentAdmin; onClose: () => void; onDone: (m: string) => void }) {
  const [providerRef, setProviderRef] = useState('');
  const [token, setToken] = useState('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const { busy, error, run } = useDialogAction(onDone);
  return (
    <ConfirmDialog
      open
      title="Facture réglée"
      confirmLabel="Confirmer"
      busy={busy}
      onCancel={onClose}
      onConfirm={() => {
        if (!providerRef.trim()) return setProblem('Saisissez le numéro de reçu donné par le facturier.');
        void run(async () => {
          await api.bills.process(payment.id, { action: 'COMPLETE', providerRef: providerRef.trim(), token: token.trim() || undefined, receiptNote: note.trim() || undefined });
          return 'Facture marquée réglée. Le client a reçu son reçu.';
        });
      }}
    >
      <div className="dialog-form">
        <p>
          Confirmez avoir réglé <strong>{formatAmount(payment.amount, payment.currency)}</strong> à <strong>{payment.biller.name}</strong> ({payment.referenceLabel} {payment.accountRef}).
        </p>
        <Field id="bp-ref" label="Numéro de reçu du facturier" value={providerRef} maxLength={80} error={problem} onChange={(e) => { setProviderRef(e.target.value); setProblem(null); }} />
        <Field id="bp-token" label="Jeton / code à saisir par le client (électricité prépayée, recharge…)" value={token} maxLength={120} onChange={(e) => setToken(e.target.value)} />
        <TextAreaField id="bp-note" label="Message au client (facultatif)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}

function FailDialog({ payment, onClose, onDone }: { payment: BillPaymentAdmin; onClose: () => void; onDone: (m: string) => void }) {
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const { busy, error, run } = useDialogAction(onDone);
  return (
    <ConfirmDialog
      open
      title="Refuser la facture"
      confirmLabel="Refuser et rembourser"
      tone="danger"
      busy={busy}
      onCancel={onClose}
      onConfirm={() => {
        if (reason.trim().length < 5) return setProblem('Indiquez le motif (montré au client).');
        void run(async () => {
          await api.bills.process(payment.id, { action: 'FAIL', reason: reason.trim() });
          return 'Facture refusée. Le client a été remboursé.';
        });
      }}
    >
      <div className="dialog-form">
        <p>
          <strong>{payment.payer.name}</strong> sera remboursé depuis le portefeuille de votre société (celui-ci doit contenir le montant).
        </p>
        <TextAreaField id="bp-reason" label="Motif du refus" value={reason} error={problem} maxLength={300} onChange={(e) => { setReason(e.target.value); setProblem(null); }} />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}

export default function BillPaymentsPage() {
  const [tab, setTab] = useState<Tab>('OPEN');
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [stats, setStats] = useState<BillsStats | null>(null);
  const [dialog, setDialog] = useState<{ payment: BillPaymentAdmin; kind: 'complete' | 'fail' } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const list = usePagedList<BillPaymentAdmin>(async (page) => toBillPage(await api.bills.payments({ ...queryOf(tab, applied), page, limit: 20 })), [tab, applied]);

  const loadStats = () => { api.bills.stats().then(setStats).catch(() => setStats(null)); };
  useEffect(loadStats, []);

  const done = (text: string) => {
    setDialog(null);
    setMessage(text);
    list.reload();
    loadStats();
  };

  const take = async (p: BillPaymentAdmin) => {
    setBusyId(p.id);
    try {
      await api.bills.process(p.id, { action: 'PROCESSING' });
      setMessage('Facture prise en charge.');
      list.reload();
      loadStats();
    } catch (err) {
      setMessage(describeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await api.bills.exportCsv(queryOf(tab, applied));
      saveBlob(blob, `factures-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      setMessage(describeError(err).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Factures à régler"
        description="Vos clients ont déjà payé : l’argent est sur le portefeuille de la société. Réglez le facturier, puis confirmez avec le numéro de reçu ; ou refusez pour rembourser le client."
        actions={
          <>
            <Link to="/bills" className="btn btn--secondary">
              <Icon name="arrowLeft" size={18} />
              <span>Facturiers</span>
            </Link>
            <Link to="/bills/reconcile" className="btn btn--secondary">
              <Icon name="swap" size={18} />
              <span>Rapprochement</span>
            </Link>
            <Button variant="secondary" icon="download" busy={exporting} onClick={() => void exportCsv()}>Exporter</Button>
          </>
        }
      />
      {message ? (
        <div className="stack stack--tight">
          <Notice tone="ok" title={message} action={<button type="button" className="link-btn" onClick={() => setMessage(null)}>Fermer</button>} />
        </div>
      ) : null}

      {stats ? (
        <div className="bl-stats">
          <div className="bl-stat"><strong>{stats.toSettle}</strong><span>à régler</span></div>
          <div className={`bl-stat${stats.late > 0 ? ' bl-stat--alert' : ''}`}><strong>{stats.late}</strong><span>en retard</span></div>
          <div className="bl-stat"><strong>{stats.completed30}</strong><span>réglées (30 j)</span></div>
          <div className="bl-stat"><strong>{stats.refunded30}</strong><span>remboursées (30 j)</span></div>
        </div>
      ) : null}
      {stats && stats.byBiller.length > 0 ? (
        <Card tone="flat" className="bl-owed">
          <strong>À verser aux facturiers</strong>
          <ul>
            {stats.byBiller.map((b) => (
              <li key={`${b.billerId}-${b.currency}`}>
                <span>{b.name}{b.late > 0 ? ` · ${b.late} en retard` : ''}</span>
                <strong>{formatAmount(b.amount, b.currency)}</strong>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="toolbar toolbar--inline">
        <FilterTabs<Tab>
          id="bl-tab"
          label="Filtrer les factures"
          value={tab}
          onChange={setTab}
          options={[
            { id: 'OPEN', label: 'À régler', count: stats?.toSettle },
            { id: 'LATE', label: 'En retard', count: stats?.late },
            { id: 'COMPLETED', label: 'Réglées' },
            { id: 'REFUNDED', label: 'Remboursées' },
            { id: 'ALL', label: 'Toutes' },
          ]}
        />
      </div>
      <form className="bl-search" onSubmit={(e) => { e.preventDefault(); setApplied(search); }}>
        <Field id="bl-q" label="Rechercher (référence, n° de facture, reçu)" value={search} maxLength={64} onChange={(e) => setSearch(e.target.value)} />
        <Button type="submit" variant="secondary" icon="search">Chercher</Button>
      </form>

      {list.loading && list.items.length === 0 ? (
        <div className="center-block"><Spinner label="Chargement des factures" /></div>
      ) : list.error ? (
        <Card>
          <Notice tone="error" title="Impossible de charger les factures" action={<button type="button" className="link-btn" onClick={list.reload}>Réessayer</button>}>
            {describeError(list.error).message}
          </Notice>
        </Card>
      ) : list.items.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon"><Icon name="check" size={26} /></span>
          <h2>Aucune facture</h2>
          <p>Rien dans cette liste pour le moment.</p>
        </Card>
      ) : (
        <>
          <ul className="mc-grid">
            {list.items.map((p) => (
              <li key={p.id} className={`bl-card${p.late ? ' bl-card--late' : ''}`}>
                <div className="bl-card__head">
                  <div className="bl-card__who">
                    <strong>{p.biller.name}</strong>
                    <span className="muted">{categoryName(p.biller.category, BILL_CATEGORY_LABEL)}</span>
                  </div>
                  <div className="bl-card__pills">
                    {p.late ? <Pill tone="danger">En retard</Pill> : null}
                    {p.simulated ? <Pill tone="neutral">Simulation</Pill> : null}
                    <Pill tone={BILL_STATUS_TONE[p.status]}>{BILL_PAYMENT_STATUS_LABEL[p.status]}</Pill>
                  </div>
                </div>
                <p className="mc-payout__amount">{formatAmount(p.amount, p.currency)}</p>
                <dl className="kv kv--compact">
                  <div className="kv__row"><dt>{p.referenceLabel}</dt><dd className="mc-break">{p.accountRef}</dd></div>
                  {p.customerName ? <div className="kv__row"><dt>Titulaire</dt><dd>{p.customerName}</dd></div> : null}
                  {Object.entries(p.fields ?? {}).map(([k, v]) => <div key={k} className="kv__row"><dt>{k}</dt><dd className="mc-break">{v}</dd></div>)}
                  <div className="kv__row"><dt>Client</dt><dd>{p.payer.name}{p.payer.phone ? ` · ${p.payer.phone}` : ''}</dd></div>
                  <div className="kv__row"><dt>Débité</dt><dd>{formatAmount(p.totalCharged, p.walletCurrency)}{p.feeCharged > 0 ? ` (frais ${formatAmount(p.feeCharged, p.walletCurrency)})` : ''}</dd></div>
                  <div className="kv__row"><dt>Payée le</dt><dd>{formatDateTime(p.createdAt)}</dd></div>
                  <div className="kv__row"><dt>Référence</dt><dd>{p.reference}</dd></div>
                  {p.biller.settlementInfo && (p.status === 'SUBMITTED' || p.status === 'PROCESSING') ? <div className="kv__row"><dt>Règlement</dt><dd className="mc-break">{p.biller.settlementInfo}</dd></div> : null}
                  {p.providerRef ? <div className="kv__row"><dt>Reçu du facturier</dt><dd className="mc-break">{p.providerRef}</dd></div> : null}
                  {p.token ? <div className="kv__row"><dt>Jeton</dt><dd className="mc-break">{p.token}</dd></div> : null}
                  {p.failureReason ? <div className="kv__row"><dt>Motif</dt><dd>{p.failureReason}</dd></div> : null}
                </dl>
                {p.status === 'SUBMITTED' || p.status === 'PROCESSING' ? (
                  <div className="mc-actions">
                    {p.status === 'SUBMITTED' ? <Button variant="secondary" busy={busyId === p.id} onClick={() => void take(p)}>Je m’en occupe</Button> : null}
                    <Button onClick={() => setDialog({ payment: p, kind: 'complete' })}>Réglée</Button>
                    <Button variant="danger" onClick={() => setDialog({ payment: p, kind: 'fail' })}>Refuser</Button>
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

      {dialog?.kind === 'complete' ? <CompleteDialog payment={dialog.payment} onClose={() => setDialog(null)} onDone={done} /> : null}
      {dialog?.kind === 'fail' ? <FailDialog payment={dialog.payment} onClose={() => setDialog(null)} onDone={done} /> : null}
    </>
  );
}
