// apps/web-admin/src/pages/transactions/TransactionDetailPage.tsx
// Fiche d'une transaction : montants, parties, règlement, historique et — pour un administrateur —
// les changements de statut que le serveur accepte (transferts) et la décision sur un paiement B2B.

import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, type Transaction } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, CopyButton } from '../../components/form';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import {
  PAYMENT_LABEL,
  PAYOUT_LABEL,
  WITHDRAWAL_LABEL,
  WITHDRAWAL_TONE,
  adminActions,
  beneficiaryName,
  convertedAmount,
  isPendingB2B,
  senderName,
  statusLabel,
  statusTone,
  timeline,
  typeIcon,
  typeLabel,
  viewFor,
  type AdminAction,
} from '../../lib/transactionRules';
import { formatDateTime } from '../../lib/userRules';
import { useResource } from '../../lib/useResource';
import { useCurrentUser } from '../../providers/AuthProvider';

/** `half` : la ligne se range à côté de sa voisine (deux champs par ligne). */
function Row({ label, children, half = false }: { label: string; children: ReactNode; half?: boolean }) {
  return (
    <div className={half ? 'kv__row kv__row--half' : 'kv__row'}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function SectionCard({ id, icon, title, subtitle, children }: { id: string; icon: 'user' | 'wallet' | 'list' | 'send'; title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card as="section" aria-labelledby={id} className="section-card">
      <header className="section-card__head">
        <span className="section-card__icon">
          <Icon name={icon} size={20} />
        </span>
        <div className="section-card__title">
          <h2 id={id}>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </header>
      {children}
    </Card>
  );
}

function money(value: string | number | null | undefined, currency: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return formatAmount(value, currency);
}

type Decision =
  | { kind: 'status'; action: AdminAction }
  | { kind: 'b2b-validate' }
  | { kind: 'b2b-reject' };

export default function TransactionDetailPage() {
  const { id = '' } = useParams();
  const me = useCurrentUser();
  const isSuper = me.role === 'SUPER_ADMIN';
  const isAdmin = isSuper || me.role === 'COMPANY_ADMIN';

  const { data, error, loading, reload } = useResource(() => api.transactions.get(id), [id]);
  // La fiche du serveur ne renvoie pas la société : le super admin la retrouve dans la liste des sociétés.
  // Un échec ici n'empêche jamais d'afficher la transaction.
  const companies = useResource(() => (isSuper ? api.companies.list().catch(() => []) : Promise.resolve([])), [isSuper]);

  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const backLink = (
    <Link to="/transactions" className="btn btn--secondary">
      <Icon name="arrowLeft" size={18} />
      <span>Toutes les transactions</span>
    </Link>
  );

  const notFound =
    !id ||
    (!loading && !error && !data) ||
    (error instanceof ApiError && (error.status === 404 || error.status === 403));

  if (notFound) {
    return (
      <>
        <PageHeader title="Transaction introuvable" actions={backLink} />
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Cette transaction n'est pas accessible</h2>
          <p>Elle n'existe pas, ou elle n'appartient pas à votre périmètre.</p>
        </Card>
      </>
    );
  }

  if (loading && !data) {
    return (
      <div className="center-block">
        <Spinner label="Chargement de la transaction" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Transaction" actions={backLink} />
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger la transaction"
            action={
              <button type="button" className="link-btn" onClick={reload}>
                Réessayer
              </button>
            }
          >
            {describeError(error).message}
          </Notice>
        </Card>
      </>
    );
  }

  const tx: Transaction = data;
  const view = viewFor(tx, me);
  const converted = convertedAmount(tx);
  const actions = isAdmin ? adminActions(tx) : [];
  const b2b = isSuper && isPendingB2B(tx);
  const open = tx.status === 'PENDING' || tx.status === 'VALIDATED' || tx.status === 'PROCESSING';
  const noManualAction = isAdmin && open && actions.length === 0 && !b2b;
  const steps = timeline(tx);
  const who = beneficiaryName(tx);
  const sender = tx.sender;
  const fees = money(tx.fees, tx.currency);
  const company = isSuper
    ? (companies.data?.find((c) => c.id === tx.clientId) ?? (tx.client ? { id: tx.clientId, name: tx.client.name } : null))
    : null;

  const commissions = isAdmin
    ? ([
        ['Commission de l’expéditeur', tx.senderCommission],
        ['Commission du payeur', tx.payerCommission],
        ['Commission de la plateforme', tx.platformCommission],
      ] as const).filter(([, v]) => v !== null && v !== undefined && Number(v) !== 0)
    : [];

  async function confirm() {
    if (!decision) return;
    setBusy(true);
    setActionError(null);
    try {
      let message: string;
      if (decision.kind === 'status') {
        await api.transactions.setStatus(tx.id, decision.action.status);
        message = {
          VALIDATED: 'Le transfert est validé.',
          PAID: 'Le transfert est marqué comme payé.',
          CANCELLED: 'Le transfert est annulé et l’expéditeur remboursé.',
          FAILED: 'Le transfert est marqué comme échoué.',
        }[decision.action.status];
      } else if (decision.kind === 'b2b-validate') {
        await api.transactions.validateB2B(tx.id);
        message = 'Le paiement est validé et crédité sur votre compte.';
      } else {
        await api.transactions.rejectB2B(tx.id);
        message = 'Le paiement est refusé et l’expéditeur remboursé.';
      }
      setDecision(null);
      setDone(message);
      reload();
    } catch (err) {
      setActionError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  const dialog =
    decision?.kind === 'status'
      ? {
          title: decision.action.title,
          text: decision.action.consequence,
          label: decision.action.confirmLabel,
          danger: decision.action.variant === 'danger',
        }
      : decision?.kind === 'b2b-validate'
        ? {
            title: 'Valider ce paiement ?',
            text: `Le montant de ${formatAmount(tx.amount, tx.currency)} est crédité sur votre portefeuille et l’expéditeur est prévenu.`,
            label: 'Valider le paiement',
            danger: false,
          }
        : decision?.kind === 'b2b-reject'
          ? {
              title: 'Refuser ce paiement ?',
              text: `Le montant de ${formatAmount(tx.amount, tx.currency)} est rendu à l’expéditeur et l’opération est annulée. Cette décision est définitive.`,
              label: 'Refuser et rembourser',
              danger: true,
            }
          : null;

  return (
    <>
      <PageHeader title={view.title} actions={backLink} />

      <div className="stack">
        {done && !loading ? (
          <Notice
            tone="ok"
            title={done}
            action={
              <button type="button" className="link-btn" onClick={() => setDone(null)}>
                Fermer
              </button>
            }
          />
        ) : null}

        <Card className="tx-hero">
          <span className={`tx-hero__icon tx-card__icon--${view.flow}`} aria-hidden="true">
            <Icon name={typeIcon(tx.type)} size={26} />
          </span>
          <div className="tx-hero__main">
            <div className="company-hero__line">
              <Pill tone={statusTone(tx.status)}>{statusLabel(tx.status)}</Pill>
              <Pill tone="neutral">{typeLabel(tx.type)}</Pill>
              {tx.isFlagged ? (
                <Pill tone="danger" icon="alert">
                  Signalée
                </Pill>
              ) : null}
            </div>
            <p className={`tx-hero__amount tx-amount--${view.flow}`}>
              {view.flow === 'in' ? '+ ' : view.flow === 'out' ? '− ' : ''}
              {view.amount}
            </p>
            <p className="company-hero__meta">{view.amountNote ?? view.subtitle}</p>
            <p className="tx-hero__ref">
              <span className="muted">Référence</span>
              <code>{tx.reference}</code>
              <CopyButton value={tx.reference} label="Copier la référence" />
            </p>
          </div>
          {actions.length > 0 || b2b ? (
            <div className="tx-hero__actions">
              {b2b ? (
                <>
                  <Button onClick={() => setDecision({ kind: 'b2b-validate' })}>Valider le paiement</Button>
                  <Button variant="secondary" className="btn--danger-outline" onClick={() => setDecision({ kind: 'b2b-reject' })}>
                    Refuser et rembourser
                  </Button>
                </>
              ) : (
                actions.map((a) => (
                  <Button
                    key={a.status}
                    variant={a.variant === 'primary' ? 'primary' : 'secondary'}
                    className={a.variant === 'danger' ? 'btn--danger-outline' : undefined}
                    onClick={() => {
                      setActionError(null);
                      setDecision({ kind: 'status', action: a });
                    }}
                  >
                    {a.label}
                  </Button>
                ))
              )}
            </div>
          ) : null}
        </Card>

        {noManualAction ? (
          <Notice tone="info" title="Aucune action manuelle sur ce type d’opération">
            Elle suit son propre flux (trésorerie, dépôt ou retrait) : le statut change de lui-même au fil de ce flux.
          </Notice>
        ) : null}

        {tx.status === 'EXPIRED' || (open && tx.expiresAt && new Date(tx.expiresAt) < new Date()) ? (
          <Notice tone="info" title="Délai dépassé">
            {tx.expiresAt ? `Cette opération devait aboutir avant le ${formatDateTime(tx.expiresAt)}.` : 'Le délai de cette opération est dépassé.'}
          </Notice>
        ) : null}

        <div className="detail-grid">
          <SectionCard id="tx-parties" icon="user" title="Parties" subtitle="Qui envoie et qui reçoit.">
            <dl className="kv kv--grid">
              <Row label="Expéditeur" half={Boolean(sender?.phone)}>
                {isAdmin && sender?.id ? (
                  <Link className="link" to={`/users/${encodeURIComponent(sender.id)}`}>
                    {senderName(tx)}
                  </Link>
                ) : (
                  senderName(tx)
                )}
              </Row>
              {sender?.phone ? (
                <Row label="Téléphone" half>
                  {sender.phone}
                </Row>
              ) : null}
              <Row label="Bénéficiaire" half={Boolean(tx.beneficiary?.phone)}>
                {who ?? <span className="muted">Aucun (opération interne)</span>}
              </Row>
              {tx.beneficiary?.phone ? (
                <Row label="Téléphone" half>
                  {tx.beneficiary.phone}
                </Row>
              ) : null}
              {tx.beneficiary?.country ? (
                <Row label="Destination">{[tx.beneficiary.city, tx.beneficiary.country].filter(Boolean).join(', ')}</Row>
              ) : null}
              {company?.name ? (
                <Row label="Société">
                  {company.id !== undefined && company.id !== 0 ? (
                    <Link className="link" to={`/companies/${company.id}`}>
                      {company.name}
                    </Link>
                  ) : (
                    company.name
                  )}
                </Row>
              ) : null}
            </dl>
          </SectionCard>

          <SectionCard id="tx-amounts" icon="wallet" title="Montants" subtitle="Ce qui est débité et ce qui est reçu.">
            <dl className="kv kv--grid">
              <Row label="Montant envoyé" half={Boolean(fees)}>
                {formatAmount(tx.amount, tx.currency)}
              </Row>
              {fees ? (
                <Row label="Frais" half>
                  {fees}
                </Row>
              ) : null}
              <Row label="Total débité" half={Boolean(converted)}>
                <strong>{formatAmount(tx.total, tx.currency)}</strong>
              </Row>
              {converted ? (
                <Row label="Montant reçu" half>
                  {converted}
                </Row>
              ) : null}
              {tx.exchangeRate && tx.targetCurrency ? (
                <Row label="Taux appliqué">
                  1 {tx.currency} = {Number(tx.exchangeRate).toLocaleString('fr-FR', { maximumFractionDigits: 6 })} {tx.targetCurrency}
                </Row>
              ) : null}
              {commissions.map(([label, value]) => (
                <Row key={label} label={label}>
                  {formatAmount(value as string | number, tx.currency)}
                </Row>
              ))}
            </dl>
          </SectionCard>
        </div>

        <div className="detail-grid">
          <SectionCard id="tx-payout" icon="send" title="Règlement" subtitle="Comment l’argent entre et sort.">
            <dl className="kv kv--grid">
              {tx.agency?.name ? (
                <Row label="Caisse d’agence">
                  {me.role === 'COMPANY_ADMIN' ? (
                    <Link className="link" to={`/agencies/${encodeURIComponent(tx.agency.id)}`}>
                      {tx.agency.name}
                    </Link>
                  ) : (
                    tx.agency.name
                  )}
                </Row>
              ) : null}
              {tx.paymentMethod ? (
                <Row label="Paiement" half={Boolean(tx.payoutMethod)}>
                  {PAYMENT_LABEL[tx.paymentMethod] ?? tx.paymentMethod}
                </Row>
              ) : null}
              {tx.payoutMethod ? (
                <Row label="Versement" half={Boolean(tx.paymentMethod)}>
                  {PAYOUT_LABEL[tx.payoutMethod] ?? tx.payoutMethod}
                </Row>
              ) : null}
              {tx.withdrawal ? (
                <>
                  <Row label="Retrait" half={Boolean(tx.withdrawal.processedAt)}>
                    <Pill tone={WITHDRAWAL_TONE[tx.withdrawal.status]}>{WITHDRAWAL_LABEL[tx.withdrawal.status] ?? tx.withdrawal.status}</Pill>
                  </Row>
                  {tx.withdrawal.processedAt ? (
                    <Row label="Retiré le" half>
                      {formatDateTime(tx.withdrawal.processedAt)}
                    </Row>
                  ) : null}
                  {tx.withdrawal.rejectionReason ? <Row label="Motif du refus">{tx.withdrawal.rejectionReason}</Row> : null}
                </>
              ) : null}
              {tx.type === 'SERVICE_PAYMENT' && tx.providerRef ? (
                <Row label="Référence du virement">
                  <code>{tx.providerRef}</code>
                </Row>
              ) : null}
              {tx.note ? <Row label="Note">{tx.note}</Row> : null}
              {isAdmin && Number(tx.riskScore) > 0 ? <Row label="Score de risque">{tx.riskScore} / 100</Row> : null}
            </dl>
          </SectionCard>

          <SectionCard id="tx-history" icon="list" title="Historique" subtitle="Les étapes déjà franchies.">
            <ol className="timeline">
              {steps.map((s) => (
                <li key={s.key} className={`timeline__step timeline__step--${s.tone}`}>
                  <strong>{s.label}</strong>
                  <time dateTime={s.at}>{formatDateTime(s.at)}</time>
                </li>
              ))}
              {open && tx.expiresAt ? (
                <li className="timeline__step timeline__step--pending">
                  <strong>Échéance</strong>
                  <time dateTime={tx.expiresAt}>{formatDateTime(tx.expiresAt)}</time>
                </li>
              ) : null}
            </ol>
          </SectionCard>
        </div>
      </div>

      <ConfirmDialog
        open={decision !== null}
        title={dialog?.title ?? ''}
        confirmLabel={dialog?.label ?? 'Confirmer'}
        tone={dialog?.danger ? 'danger' : 'default'}
        busy={busy}
        onConfirm={() => void confirm()}
        onCancel={() => {
          setDecision(null);
          setActionError(null);
        }}
      >
        <p>{dialog?.text}</p>
        <p className="muted">
          Référence {tx.reference} · {formatAmount(tx.total, tx.currency)}
        </p>
        {actionError ? <Notice tone="error">{actionError}</Notice> : null}
      </ConfirmDialog>
    </>
  );
}
