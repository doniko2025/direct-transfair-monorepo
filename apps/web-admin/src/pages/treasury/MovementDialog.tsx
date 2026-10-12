// src/pages/treasury/MovementDialog.tsx
// Alimenter ou retirer de l'argent du portefeuille de la société (admin de société).

import { useState, type FormEvent } from 'react';
import { type TreasuryCurrency, type TreasuryWallet } from '@direct-transfair/shared';
import { ConfirmDialog, SelectField } from '../../components/form';
import { Field, Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { CURRENCY_OPTIONS, maxDecimals, parseAmount, walletOf } from '../../lib/treasuryRules';
import { useDialogAction } from './useDialogAction';

export type MovementMode = 'inject' | 'withdraw';

interface Props {
  mode: MovementMode;
  wallets: readonly TreasuryWallet[];
  /** Devise proposée au départ (celle de la carte d'où l'on vient). */
  currency?: TreasuryCurrency;
  onClose: () => void;
  onDone: (message: string) => void;
}

export default function MovementDialog({ mode, wallets, currency: initial, onClose, onDone }: Props) {
  const inject = mode === 'inject';
  const [currency, setCurrency] = useState<TreasuryCurrency>(initial ?? wallets[0]?.currency ?? 'XOF');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const { busy, error, run } = useDialogAction(onDone);

  const parsed = parseAmount(amount, currency);
  const available = walletOf(wallets, currency)?.availableBalance ?? 0;
  const tooMuch = !inject && parsed.value !== null && parsed.value > available;
  const fieldError = parsed.error ?? (tooMuch ? `Solde insuffisant : ${formatAmount(available, currency)} disponibles.` : null);
  const valid = parsed.value !== null && !tooMuch;

  function submit() {
    if (!valid || parsed.value === null) return;
    const value = parsed.value;
    void run(async () => {
      const text = note.trim() || undefined;
      if (inject) {
        await api.treasury.inject({ currency, amount: value, ...(text ? { description: text } : {}) });
        return `${formatAmount(value, currency)} ajoutés à votre portefeuille.`;
      }
      await api.treasury.withdraw({ currency, amount: value, ...(text ? { reason: text } : {}) });
      return `${formatAmount(value, currency)} retirés de votre portefeuille.`;
    });
  }

  return (
    <ConfirmDialog
      open
      title={inject ? 'Alimenter mon portefeuille' : 'Retirer de mon portefeuille'}
      confirmLabel={inject ? 'Ajouter au solde' : 'Retirer du solde'}
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
        {inject ? (
          <Notice tone="info">
            Le montant est ajouté à votre solde sans virement bancaire associé : n’alimentez que des fonds réellement
            disponibles.
          </Notice>
        ) : null}
        <SelectField
          id="mv-currency"
          label="Devise"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as TreasuryCurrency)}
          options={CURRENCY_OPTIONS}
        />
        <Field
          id="mv-amount"
          label="Montant"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={amount.trim() !== '' ? fieldError : null}
          hint={
            inject
              ? maxDecimals(currency) === 0
                ? 'Montant entier.'
                : 'Deux décimales au maximum.'
              : `Disponible : ${formatAmount(available, currency)}`
          }
          autoFocus
        />
        <Field
          id="mv-note"
          label={inject ? 'Libellé (facultatif)' : 'Motif (facultatif)'}
          maxLength={120}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </form>
    </ConfirmDialog>
  );
}
