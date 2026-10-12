// src/pages/desk/WithdrawPage.tsx
// Retrait (agent) : le bénéficiaire donne son code, l'agent le vérifie puis remet les espèces.
// Payer un code CRÉDITE la caisse de l'agence (espèces remboursées + commission de paiement).

import { useState, type FormEvent } from 'react';
import type { WithdrawalCheck, WithdrawalPayResult } from '@direct-transfair/shared';
import { ConfirmDialog } from '../../components/form';
import { Button, Card, Field, Notice, PageHeader, Pill } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { cleanCode, mainWallet, verdictOf, walletIn } from '../../lib/deskRules';
import { describeError } from '../../lib/errors';
import { statusLabel } from '../../lib/transactionRules';
import { CashBox } from './CashBox';
import { Receipt } from './Receipt';
import { useDesk } from './useDesk';

interface Paid {
  check: WithdrawalCheck;
  result: WithdrawalPayResult;
  at: string;
  agencyName: string | null;
}

/** Ce que le bénéficiaire reçoit : le montant converti s'il y en a un, sinon le montant envoyé. */
function payoutOf(c: WithdrawalCheck): { amount: number; currency: string } {
  const converted = Number(c.receivedAmount ?? 0);
  return converted > 0
    ? { amount: converted, currency: c.targetCurrency ?? c.currency }
    : { amount: Number(c.amount), currency: c.currency };
}

export default function WithdrawPage() {
  const desk = useDesk();
  const [codeRaw, setCodeRaw] = useState('');
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<WithdrawalCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState<Paid | null>(null);

  const code = cleanCode(codeRaw);
  const verdict = check ? verdictOf(check.status) : null;
  const payout = check ? payoutOf(check) : null;
  const box = payout ? walletIn(desk.data, payout.currency) : null;
  // Sans caisse dans la devise à remettre, le serveur créditerait une autre devise : on ne propose pas de payer.
  const noBox = !!payout && !!desk.data && !box && !!mainWallet(desk.data);
  const frozen = !!box && box.isFrozen;

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!code) return;
    setChecking(true);
    setError(null);
    setCheck(null);
    try {
      setCheck(await api.agentDesk.checkWithdrawal(code));
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setChecking(false);
    }
  }

  async function pay() {
    if (!check) return;
    setPaying(true);
    setError(null);
    try {
      const result = await api.agentDesk.payWithdrawal(check.reference || code);
      setPaid({ check, result, at: new Date().toISOString(), agencyName: desk.data?.agency?.name ?? null });
      setConfirming(false);
      desk.reload();
    } catch (err) {
      setError(describeError(err).message);
      setConfirming(false);
    } finally {
      setPaying(false);
    }
  }

  function again() {
    setPaid(null);
    setCheck(null);
    setCodeRaw('');
    setError(null);
  }

  if (paid) {
    const p = payoutOf(paid.check);
    const mine = paid.result.commissions?.payerAgency?.amount ?? 0;
    return (
      <div className="desk-page">
        <PageHeader title="Retrait" description="Le code a été payé." />
        <CashBox desk={desk} />
        <Receipt
          title="Retrait payé"
          lead={`Remettez ${formatAmount(paid.result.amountPaid ?? p.amount, paid.result.currency ?? p.currency)} en espèces au bénéficiaire.`}
          at={paid.at}
          reference={paid.check.reference}
          agencyName={paid.agencyName}
          lines={[
            { label: 'Bénéficiaire', value: paid.check.beneficiary?.fullName ?? '—' },
            { label: 'Envoyé par', value: paid.check.senderName || '—' },
            { label: 'Espèces remises', value: formatAmount(paid.result.amountPaid ?? p.amount, paid.result.currency ?? p.currency), strong: true },
            ...(mine > 0 ? [{ label: 'Votre commission de paiement', value: formatAmount(mine, paid.result.currency) }] : []),
          ]}
        >
          <Button icon="withdraw" onClick={again}>
            Payer un autre code
          </Button>
        </Receipt>
      </div>
    );
  }

  return (
    <div className="desk-page">
      <PageHeader
        title="Retrait"
        description="Le bénéficiaire donne son code : vérifiez-le, puis remettez les espèces. Votre caisse est remboursée."
      />
      <CashBox desk={desk} forecast={verdict === 'payable' && payout && box ? { delta: payout.amount, currency: payout.currency } : null} />

      <Card className="desk-step">
        <h2 className="card-title">Code de retrait</h2>
        <form className="desk-form" onSubmit={verify} noValidate>
          <Field
            id="withdraw-code"
            label="Code donné par le bénéficiaire"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="Ex. DT-8F3K2Q"
            value={codeRaw}
            onChange={(e) => {
              setCodeRaw(e.target.value);
              setCheck(null);
              setError(null);
            }}
            hint="Demandez aussi une pièce d’identité au nom du bénéficiaire."
            autoFocus
          />
          <Button type="submit" variant="secondary" icon="search" busy={checking} disabled={!code}>
            Vérifier le code
          </Button>
        </form>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </Card>

      {check && payout ? (
        <Card className="desk-step desk-verdict" aria-live="polite">
          <div className="desk-verdict__head">
            <div>
              <span className="desk-verdict__label">À remettre en espèces</span>
              <strong className="desk-verdict__amount">{formatAmount(payout.amount, payout.currency)}</strong>
            </div>
            <Pill tone={verdict === 'payable' ? 'ok' : verdict === 'waiting' ? 'warn' : 'neutral'}>{statusLabel(check.status)}</Pill>
          </div>
          <dl className="kv kv--compact">
            <div className="kv__row">
              <dt>Bénéficiaire</dt>
              <dd>{check.beneficiary?.fullName ?? '—'}</dd>
            </div>
            {check.beneficiary?.city || check.beneficiary?.country ? (
              <div className="kv__row">
                <dt>Ville</dt>
                <dd>{[check.beneficiary?.city, check.beneficiary?.country].filter(Boolean).join(', ')}</dd>
              </div>
            ) : null}
            <div className="kv__row">
              <dt>Envoyé par</dt>
              <dd>{check.senderName || '—'}</dd>
            </div>
            {check.currency !== payout.currency ? (
              <div className="kv__row">
                <dt>Montant d’origine</dt>
                <dd>{formatAmount(check.amount, check.currency)}</dd>
              </div>
            ) : null}
            <div className="kv__row">
              <dt>Référence</dt>
              <dd>
                <code>{check.reference}</code>
              </dd>
            </div>
          </dl>

          {verdict === 'waiting' ? (
            <Notice tone="info" title="En attente de validation">
              Cet envoi dépasse le seuil de validation. Un administrateur doit le valider avant que vous puissiez payer.
            </Notice>
          ) : null}
          {verdict === 'paid' ? (
            <Notice tone="error" title="Code déjà payé">
              Ce retrait a déjà été remis. Ne payez pas une seconde fois.
            </Notice>
          ) : null}
          {verdict === 'cancelled' ? (
            <Notice tone="error" title="Envoi annulé">
              Cet envoi n’est plus payable ({statusLabel(check.status).toLowerCase()}).
            </Notice>
          ) : null}
          {verdict === 'other' ? (
            <Notice tone="error" title="Paiement impossible">
              Statut actuel : {statusLabel(check.status).toLowerCase()}.
            </Notice>
          ) : null}
          {verdict === 'payable' && noBox ? (
            <Notice tone="error" title={`Pas de caisse en ${payout.currency}`}>
              La caisse de votre agence n’a pas de compte en {payout.currency}. Demandez à votre administrateur d’en ouvrir un avant de payer ce code.
            </Notice>
          ) : null}
          {verdict === 'payable' && frozen ? (
            <Notice tone="error" title="Caisse gelée">
              Votre caisse en {payout.currency} est gelée : contactez votre administrateur.
            </Notice>
          ) : null}

          {verdict === 'payable' && !noBox && !frozen ? (
            <Button icon="withdraw" disabled={!desk.data} onClick={() => setConfirming(true)}>
              Payer {formatAmount(payout.amount, payout.currency)}
            </Button>
          ) : null}
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title="Valider le paiement ?"
        confirmLabel="Valider le paiement"
        busy={paying}
        onConfirm={() => void pay()}
        onCancel={() => setConfirming(false)}
      >
        {check && payout ? (
          <>
            <p>
              Contrôlez la pièce d’identité de {check.beneficiary?.fullName ?? 'le bénéficiaire'}, puis validez : remettez alors{' '}
              <strong>{formatAmount(payout.amount, payout.currency)}</strong> en espèces.
            </p>
            <p>Une fois validé, le code est clos : il ne pourra plus être payé.</p>
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
