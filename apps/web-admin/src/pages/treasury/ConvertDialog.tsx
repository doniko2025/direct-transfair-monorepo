// src/pages/treasury/ConvertDialog.tsx
// Super admin : convertir des fonds d'un de ses portefeuilles vers un autre (taux du jour appliqué par le serveur).

import { useState, type FormEvent } from 'react';
import { type TreasuryWallet } from '@direct-transfair/shared';
import { ConfirmDialog, SelectField } from '../../components/form';
import { Field, Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { parseAmount } from '../../lib/treasuryRules';
import { useDialogAction } from './useDialogAction';

interface Props {
  wallets: readonly TreasuryWallet[];
  onClose: () => void;
  onDone: (message: string) => void;
}

export default function ConvertDialog({ wallets, onClose, onDone }: Props) {
  const [fromId, setFromId] = useState(wallets.find((w) => w.availableBalance > 0)?.id ?? wallets[0]?.id ?? '');
  const others = wallets.filter((w) => w.id !== fromId);
  const [toChoice, setToChoice] = useState('');
  const toId = others.some((w) => w.id === toChoice) ? toChoice : (others[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const { busy, error, run } = useDialogAction(onDone);

  const from = wallets.find((w) => w.id === fromId);
  const to = wallets.find((w) => w.id === toId);
  const parsed = parseAmount(amount, from?.currency ?? 'EUR');
  const tooMuch = parsed.value !== null && from !== undefined && parsed.value > from.availableBalance;
  const fieldError =
    parsed.error ?? (tooMuch && from ? `Solde insuffisant : ${formatAmount(from.availableBalance, from.currency)} disponibles.` : null);
  const valid = Boolean(from && to) && parsed.value !== null && !tooMuch;

  function submit() {
    if (!valid || parsed.value === null || !from || !to) return;
    const value = parsed.value;
    void run(async () => {
      const result = await api.treasury.convert({
        fromWalletId: from.id,
        toWalletId: to.id,
        amount: value,
        description: `Conversion ${from.currency} → ${to.currency}`,
      });
      const rate = Number.isFinite(result.rate) ? result.rate : null;
      const received = rate !== null ? ` Taux appliqué : 1 ${from.currency} = ${rate.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} ${to.currency}.` : '';
      return `${formatAmount(value, from.currency)} convertis en ${to.currency}.${received}`;
    });
  }

  const label = (w: TreasuryWallet) => `${w.currency} — ${formatAmount(w.availableBalance, w.currency)} disponibles`;

  return (
    <ConfirmDialog
      open
      title="Convertir entre mes portefeuilles"
      confirmLabel="Convertir"
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
        <p className="muted">Le serveur applique le taux de change du moment : vous le voyez dans la confirmation.</p>
        <SelectField
          id="cv-from"
          label="Depuis"
          value={fromId}
          onChange={(e) => setFromId(e.target.value)}
          options={wallets.map((w) => ({ value: w.id, label: label(w) }))}
        />
        <SelectField
          id="cv-to"
          label="Vers"
          value={toId}
          onChange={(e) => setToChoice(e.target.value)}
          options={others.map((w) => ({ value: w.id, label: w.currency }))}
        />
        <Field
          id="cv-amount"
          label={`Montant à convertir en ${from?.currency ?? ''}`}
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={amount.trim() !== '' ? fieldError : null}
          autoFocus
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </form>
    </ConfirmDialog>
  );
}
