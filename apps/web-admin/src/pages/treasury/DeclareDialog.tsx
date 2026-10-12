// src/pages/treasury/DeclareDialog.tsx
// Déclarer à la plateforme un virement bancaire (paiement B2B). Le montant est débité tout de suite
// du portefeuille de la société ; le super admin le valide ou le refuse (remboursement).

import { useState, type FormEvent } from 'react';
import { type TreasuryCurrency, type TreasuryWallet } from '@direct-transfair/shared';
import { ConfirmDialog, SelectField } from '../../components/form';
import { Field, Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { CURRENCY_OPTIONS, parseAmount, walletOf } from '../../lib/treasuryRules';
import { useDialogAction } from './useDialogAction';

interface Props {
  wallets: readonly TreasuryWallet[];
  onClose: () => void;
  onDone: (message: string) => void;
}

export default function DeclareDialog({ wallets, onClose, onDone }: Props) {
  const [currency, setCurrency] = useState<TreasuryCurrency>(wallets.find((w) => w.availableBalance > 0)?.currency ?? wallets[0]?.currency ?? 'XOF');
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState('');
  const { busy, error, run } = useDialogAction(onDone);

  const parsed = parseAmount(amount, currency);
  const available = walletOf(wallets, currency)?.availableBalance ?? 0;
  const tooMuch = parsed.value !== null && parsed.value > available;
  const fieldError = parsed.error ?? (tooMuch ? `Solde insuffisant : ${formatAmount(available, currency)} disponibles.` : null);
  const reference = ref.trim();
  const valid = parsed.value !== null && !tooMuch && reference.length >= 3;

  function submit() {
    if (!valid || parsed.value === null) return;
    const value = parsed.value;
    void run(async () => {
      await api.treasury.declareB2B({ amount: value, ref: reference, currency });
      return `Virement de ${formatAmount(value, currency)} déclaré. Il est en attente de validation par la plateforme.`;
    });
  }

  return (
    <ConfirmDialog
      open
      title="Déclarer un virement à la plateforme"
      confirmLabel="Déclarer le virement"
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
        <Notice tone="info">
          Le montant est débité de votre portefeuille dès la déclaration. Si la plateforme refuse le virement, il vous est
          rendu.
        </Notice>
        <SelectField
          id="b2b-currency"
          label="Devise"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as TreasuryCurrency)}
          options={CURRENCY_OPTIONS}
        />
        <Field
          id="b2b-amount"
          label="Montant viré"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={amount.trim() !== '' ? fieldError : null}
          hint={`Disponible : ${formatAmount(available, currency)}`}
          autoFocus
        />
        <Field
          id="b2b-ref"
          label="Référence du virement bancaire"
          hint="Celle qui figure sur votre relevé : la plateforme s’en sert pour retrouver le virement."
          maxLength={60}
          autoComplete="off"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </form>
    </ConfirmDialog>
  );
}
