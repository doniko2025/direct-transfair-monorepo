// src/pages/desk/RemitPage.tsx
// Remise à l'administrateur (agent) : l'agent remonte les espèces accumulées dans sa caisse vers la société.
// La caisse de l'agence est débitée, le portefeuille de la société crédité ; la remise est immédiate.

import { useMemo, useState } from 'react';
import type { Transaction } from '@direct-transfair/shared';
import { ConfirmDialog } from '../../components/form';
import { Button, Card, Field, Notice, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { mainWallet } from '../../lib/deskRules';
import { describeError } from '../../lib/errors';
import { maxDecimals, parseAmount } from '../../lib/treasuryRules';
import { CashBox } from './CashBox';
import { Receipt } from './Receipt';
import { useDesk } from './useDesk';

interface Done {
  tx: Transaction;
  currency: string;
  agencyName: string | null;
}

export default function RemitPage() {
  const desk = useDesk();
  const wallet = mainWallet(desk.data);
  const currency = wallet?.currency ?? '';

  const [amountRaw, setAmountRaw] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const amount = useMemo(() => parseAmount(amountRaw, currency || 'XOF'), [amountRaw, currency]);
  const tooMuch = !!wallet && amount.value !== null && amount.value > wallet.availableBalance;
  const amountError = amount.error ?? (tooMuch ? 'Ce montant dépasse ce qui reste en caisse.' : null);
  const blocked = !wallet || wallet.isFrozen || desk.data?.agency?.isActive === false;
  const canSubmit = amount.value !== null && !amountError && !blocked;

  function fillAll() {
    if (!wallet) return;
    const d = maxDecimals(wallet.currency);
    const floor = Math.floor(wallet.availableBalance * 10 ** d) / 10 ** d;
    setAmountRaw(floor > 0 ? String(floor).replace('.', ',') : '');
  }

  async function submit() {
    if (amount.value === null) return;
    setBusy(true);
    setError(null);
    try {
      const tx = await api.agentDesk.remit({ amount: amount.value, ...(note.trim() ? { note: note.trim() } : {}) });
      setDone({ tx, currency: String(tx.currency ?? currency), agencyName: desk.data?.agency?.name ?? null });
      setConfirming(false);
      desk.reload();
    } catch (err) {
      setError(describeError(err).message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  function again() {
    setDone(null);
    setAmountRaw('');
    setNote('');
    setError(null);
  }

  if (done) {
    return (
      <div className="desk-page">
        <PageHeader title="Remise à l’administrateur" description="La remise est enregistrée." />
        <CashBox desk={desk} />
        <Receipt
          title="Remise enregistrée"
          lead={`${formatAmount(done.tx.amount, done.currency)} ont quitté votre caisse pour la société.`}
          at={done.tx.createdAt}
          reference={done.tx.reference}
          agencyName={done.agencyName}
          lines={[
            { label: 'Montant remis', value: formatAmount(done.tx.amount, done.currency), strong: true },
            ...(done.tx.note ? [{ label: 'Libellé', value: done.tx.note }] : []),
          ]}
          note="Remettez les espèces correspondantes à votre administrateur et faites-lui signer ce reçu."
        >
          <Button icon="vault" onClick={again}>
            Nouvelle remise
          </Button>
        </Receipt>
      </div>
    );
  }

  return (
    <div className="desk-page">
      <PageHeader
        title="Remise à l’administrateur"
        description="Remontez à la société les espèces accumulées dans votre caisse. Votre caisse est débitée tout de suite."
      />
      <CashBox desk={desk} forecast={canSubmit && amount.value !== null ? { delta: -amount.value, currency } : null} />

      {error ? (
        <Notice tone="error" title="Remise non effectuée">
          {error}
        </Notice>
      ) : null}

      <Card className="desk-step">
        <h2 className="card-title">Montant à remettre</h2>
        <div className="desk-form">
          <Field
            id="remit-amount"
            label={`Montant en ${currency || 'devise de la caisse'}`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={amountRaw}
            onChange={(e) => setAmountRaw(e.target.value)}
            error={amountError}
            trailing={currency}
            autoFocus
            hint={wallet ? `Disponible en caisse : ${formatAmount(wallet.availableBalance, wallet.currency)}` : undefined}
          />
          {wallet && wallet.availableBalance > 0 ? (
            <button type="button" className="desk-link" onClick={fillAll}>
              Remettre toute la caisse
            </button>
          ) : null}
          <Field
            id="remit-note"
            label="Libellé (facultatif)"
            autoComplete="off"
            maxLength={120}
            placeholder="Ex. Remise de fin de semaine"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button icon="vault" disabled={!canSubmit} onClick={() => setConfirming(true)}>
            Vérifier et remettre
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirming}
        title="Confirmer la remise"
        confirmLabel="Remettre"
        busy={busy}
        onConfirm={() => void submit()}
        onCancel={() => setConfirming(false)}
      >
        <p>
          Vous remettez <strong>{amount.value !== null ? formatAmount(amount.value, currency) : ''}</strong> à la société. Les espèces doivent être
          remises à votre administrateur.
        </p>
      </ConfirmDialog>
    </div>
  );
}
