// src/pages/treasury/AgencyDialog.tsx
// Recharger une agence depuis le portefeuille de la société, ou récupérer des fonds d'une agence.

import { useState, type FormEvent } from 'react';
import { type TreasuryAgency, type TreasuryCurrency, type TreasuryWallet } from '@direct-transfair/shared';
import { ConfirmDialog, SelectField, TextAreaField } from '../../components/form';
import { Field, Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { CURRENCY_OPTIONS, agencyLabel, agencyWallet, parseAmount, walletOf } from '../../lib/treasuryRules';
import { useDialogAction } from './useDialogAction';

export type AgencyMode = 'refill' | 'collect';

interface Props {
  mode: AgencyMode;
  agencies: readonly TreasuryAgency[];
  wallets: readonly TreasuryWallet[];
  /** Agence présélectionnée (carte d'où l'on vient). */
  agencyId?: string;
  onClose: () => void;
  onDone: (message: string) => void;
}

export default function AgencyDialog({ mode, agencies, wallets, agencyId: initial, onClose, onDone }: Props) {
  const refill = mode === 'refill';
  const usable = agencies.filter((a) => a.isActive);
  const [agencyId, setAgencyId] = useState(initial && usable.some((a) => a.id === initial) ? initial : (usable[0]?.id ?? ''));
  const agency = usable.find((a) => a.id === agencyId);
  const [currencyChoice, setCurrencyChoice] = useState<TreasuryCurrency | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const { busy, error, run } = useDialogAction(onDone);

  // Recharge : la devise se choisit (par défaut celle de l'agence). Récupération : c'est celle du portefeuille de l'agence.
  const wallet = agency ? agencyWallet(agency) : null;
  const currency: TreasuryCurrency = refill
    ? (currencyChoice ?? agency?.primaryCurrency ?? 'XOF')
    : (wallet?.currency ?? agency?.primaryCurrency ?? 'XOF');

  const companyAvailable = walletOf(wallets, currency)?.availableBalance ?? 0;
  const agencyInCurrency = refill
    ? (agency?.wallets?.find((w) => w.currency === currency)?.availableBalance ?? 0)
    : (wallet?.availableBalance ?? 0);
  const limit = refill ? companyAvailable : agencyInCurrency;

  const parsed = parseAmount(amount, currency);
  const tooMuch = parsed.value !== null && parsed.value > limit;
  const fieldError =
    parsed.error ??
    (tooMuch
      ? refill
        ? `Solde de la société insuffisant : ${formatAmount(companyAvailable, currency)} disponibles.`
        : `Solde de l’agence insuffisant : ${formatAmount(agencyInCurrency, currency)} disponibles.`
      : null);
  const noteOk = refill || note.trim() !== '';
  const valid = Boolean(agency) && parsed.value !== null && !tooMuch && noteOk;

  function submit() {
    if (!valid || parsed.value === null || !agency) return;
    const value = parsed.value;
    const target = agency;
    void run(async () => {
      if (refill) {
        await api.treasury.refillAgency({ agencyId: target.id, amount: value, currency });
        return `${target.name} rechargée de ${formatAmount(value, currency)}.`;
      }
      await api.treasury.collectFromAgency({ agencyId: target.id, amount: value, note: note.trim() });
      return `${formatAmount(value, currency)} récupérés de ${target.name}.`;
    });
  }

  return (
    <ConfirmDialog
      open
      title={refill ? 'Recharger une agence' : 'Récupérer des fonds d’une agence'}
      confirmLabel={refill ? 'Recharger' : 'Récupérer les fonds'}
      busy={busy}
      confirmDisabled={!valid}
      onConfirm={submit}
      onCancel={onClose}
    >
      <form
        className="dialog-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="submit" hidden />
        <p className="muted">
          {refill
            ? 'Le montant est prélevé sur le portefeuille de la société et crédité sur celui de l’agence. Ses agents sont prévenus.'
            : 'Le montant quitte le portefeuille de l’agence pour rejoindre celui de la société. L’agence et son équipe en sont informées.'}
        </p>
        <SelectField
          id="ag-agency"
          label="Agence"
          value={agencyId}
          onChange={(e) => {
            setAgencyId(e.target.value);
            setCurrencyChoice(null);
          }}
          options={usable.map((a) => ({ value: a.id, label: agencyLabel(a, false) }))}
        />
        {refill ? (
          <SelectField
            id="ag-currency"
            label="Devise"
            value={currency}
            onChange={(e) => setCurrencyChoice(e.target.value as TreasuryCurrency)}
            options={CURRENCY_OPTIONS}
          />
        ) : null}
        <Field
          id="ag-amount"
          label={`Montant en ${currency}`}
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={amount.trim() !== '' ? fieldError : null}
          hint={
            refill
              ? `Société : ${formatAmount(companyAvailable, currency)} disponibles · Agence : ${formatAmount(agencyInCurrency, currency)}`
              : `Disponible dans l’agence : ${formatAmount(agencyInCurrency, currency)}`
          }
          autoFocus
        />
        {!refill ? (
          <TextAreaField
            id="ag-note"
            label="Motif (obligatoire)"
            hint="Une récupération de fonds doit toujours être justifiée dans l’historique."
            maxLength={255}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        ) : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </form>
    </ConfirmDialog>
  );
}
