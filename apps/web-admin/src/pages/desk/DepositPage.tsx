// src/pages/desk/DepositPage.tsx
// Dépôt d'espèces (agent) : le client remet de l'argent au guichet, l'agent le crédite sur son portefeuille.
// La caisse de l'agence est débitée du même montant (elle devient du « e-float » côté client).

import { useMemo, useState, type FormEvent } from 'react';
import type { DeskClient, Transaction } from '@direct-transfair/shared';
import { ConfirmDialog } from '../../components/form';
import { Icon } from '../../components/Icon';
import { Button, Card, Field, PageHeader, Pill, Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { defaultDial, mainWallet, parsePhone, personName } from '../../lib/deskRules';
import { describeError } from '../../lib/errors';
import { parseAmount } from '../../lib/treasuryRules';
import { CashBox } from './CashBox';
import { PhoneField } from './PhoneField';
import { Receipt } from './Receipt';
import { useDesk } from './useDesk';

type Lookup =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'found'; phone: string; client: DeskClient }
  | { state: 'none'; phone: string }
  | { state: 'error'; message: string };

interface Done {
  tx: Transaction;
  client: DeskClient;
  currency: string;
  agencyName: string | null;
}

export default function DepositPage() {
  const desk = useDesk();
  const wallet = mainWallet(desk.data);
  const currency = wallet?.currency ?? '';

  const [dialPick, setDialPick] = useState<string | null>(null);
  const dial = dialPick ?? defaultDial(desk.data?.agency?.country);
  const [phoneRaw, setPhoneRaw] = useState('');
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
  const [amountRaw, setAmountRaw] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const phone = useMemo(() => parsePhone(dial, phoneRaw), [dial, phoneRaw]);
  const client = lookup.state === 'found' && lookup.phone === phone.value ? lookup.client : null;
  const amount = useMemo(() => parseAmount(amountRaw, currency || 'XOF'), [amountRaw, currency]);
  const tooMuch = !!wallet && amount.value !== null && amount.value > wallet.availableBalance;
  const amountError = amount.error ?? (tooMuch ? 'Ce montant dépasse ce qui reste en caisse.' : null);
  const blockedBox = !wallet || wallet.isFrozen || desk.data?.agency?.isActive === false;
  const canSubmit = !!client && client.canReceive && amount.value !== null && !amountError && !blockedBox;

  async function search(e: FormEvent) {
    e.preventDefault();
    if (!phone.value) return;
    const asked = phone.value;
    setLookup({ state: 'loading' });
    setError(null);
    try {
      const res = await api.agentDesk.lookupClient(asked);
      setLookup(res.client ? { state: 'found', phone: asked, client: res.client } : { state: 'none', phone: asked });
    } catch (err) {
      setLookup({ state: 'error', message: describeError(err).message });
    }
  }

  async function confirm() {
    if (!client || amount.value === null || !phone.value) return;
    setBusy(true);
    setError(null);
    try {
      const tx = await api.agentDesk.deposit({ amount: amount.value, userPhone: phone.value });
      setDone({ tx, client, currency: String(tx.currency ?? currency), agencyName: desk.data?.agency?.name ?? null });
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
    setPhoneRaw('');
    setAmountRaw('');
    setLookup({ state: 'idle' });
    setError(null);
  }

  if (done) {
    return (
      <div className="desk-page">
        <PageHeader title="Dépôt" description="Le client a été crédité." />
        <CashBox desk={desk} />
        <Receipt
          title="Dépôt effectué"
          lead={`${formatAmount(done.tx.amount, done.currency)} crédités sur le portefeuille de ${personName(done.client)}.`}
          at={done.tx.createdAt}
          reference={done.tx.reference}
          agencyName={done.agencyName}
          lines={[
            { label: 'Client', value: personName(done.client) || done.client.phone },
            { label: 'Téléphone', value: done.client.phone ?? '—' },
            { label: 'Montant déposé', value: formatAmount(done.tx.amount, done.currency), strong: true },
            { label: 'Frais', value: formatAmount(0, done.currency) },
          ]}
        >
          <Button icon="deposit" onClick={again}>
            Nouveau dépôt
          </Button>
        </Receipt>
      </div>
    );
  }

  return (
    <div className="desk-page">
      <PageHeader
        title="Dépôt"
        description="Le client remet des espèces : créditez son portefeuille. Votre caisse est débitée du même montant."
      />
      <CashBox desk={desk} forecast={canSubmit && amount.value !== null ? { delta: -amount.value, currency } : null} />

      {error ? <Notice tone="error" title="Dépôt non effectué">{error}</Notice> : null}

      <Card className="desk-step">
        <h2 className="card-title">1. Retrouver le client</h2>
        <form className="desk-form" onSubmit={search} noValidate>
          <PhoneField
            id="deposit-phone"
            label="Téléphone du client"
            dial={dial}
            value={phoneRaw}
            onDial={setDialPick}
            onValue={setPhoneRaw}
            error={phone.error}
            hint="Le numéro avec lequel le client s’est inscrit sur l’application."
            autoFocus
          />
          <Button type="submit" variant="secondary" icon="search" busy={lookup.state === 'loading'} disabled={!phone.value}>
            Rechercher le client
          </Button>
        </form>

        {lookup.state === 'error' ? <Notice tone="error">{lookup.message}</Notice> : null}
        {lookup.state === 'none' && lookup.phone === phone.value ? (
          <Notice tone="info" title="Aucun client avec ce numéro">
            Vérifiez le numéro. Le client doit avoir un compte wallet dans votre société.
          </Notice>
        ) : null}
        {client ? (
          <div className={`desk-client${client.canReceive ? '' : ' desk-client--blocked'}`}>
            <span className="desk-client__avatar" aria-hidden="true">
              <Icon name="user" size={22} />
            </span>
            <div>
              <strong>{personName(client) || 'Client sans nom'}</strong>
              <span>{client.phone}</span>
            </div>
            {client.canReceive ? (
              <Pill tone="ok" icon="check">
                Peut recevoir
              </Pill>
            ) : (
              <Pill tone="danger" icon="alert">
                Compte suspendu ou désactivé
              </Pill>
            )}
          </div>
        ) : null}
      </Card>

      <Card className={`desk-step${client?.canReceive ? '' : ' desk-step--off'}`}>
        <h2 className="card-title">2. Montant remis</h2>
        <div className="desk-form">
          <Field
            id="deposit-amount"
            label={`Montant en ${currency || 'devise de la caisse'}`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={amountRaw}
            onChange={(e) => setAmountRaw(e.target.value)}
            disabled={!client?.canReceive}
            error={amountError}
            hint={wallet ? `Disponible en caisse : ${formatAmount(wallet.availableBalance, wallet.currency)}` : undefined}
            trailing={currency}
          />
          <Button icon="deposit" disabled={!canSubmit} onClick={() => setConfirming(true)}>
            Vérifier et déposer
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirming}
        title="Confirmer le dépôt"
        confirmLabel="Déposer"
        busy={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(false)}
      >
        <dl className="kv kv--compact">
          <div className="kv__row">
            <dt>Client</dt>
            <dd>{client ? personName(client) || client.phone : ''}</dd>
          </div>
          <div className="kv__row">
            <dt>Montant</dt>
            <dd>
              <strong>{amount.value !== null ? formatAmount(amount.value, currency) : ''}</strong>
            </dd>
          </div>
        </dl>
        <p>Vous avez bien reçu cette somme en espèces ? Le dépôt ne peut pas être annulé depuis cet écran.</p>
      </ConfirmDialog>
    </div>
  );
}
