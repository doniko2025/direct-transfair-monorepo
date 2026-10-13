// src/pages/settings/ThresholdDialog.tsx
// Fixer le seuil de validation d'une devise (admin de société).

import { useState, type FormEvent } from 'react';
import type { ValidationThreshold } from '@direct-transfair/shared';
import { ConfirmDialog } from '../../components/form';
import { Field, Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { currencyLabel, parseThreshold, toAmountInput } from '../../lib/thresholdRules';
import { useDialogAction } from '../treasury/useDialogAction';

interface Props {
  threshold: ValidationThreshold;
  onClose: () => void;
  onDone: (message: string) => void;
}

export default function ThresholdDialog({ threshold, onClose, onDone }: Props) {
  const [amount, setAmount] = useState(toAmountInput(threshold.amount));
  const { busy, error, run, clearError } = useDialogAction(onDone);

  const parsed = parseThreshold(amount);
  const unchanged = threshold.configured && parsed.value === threshold.amount;
  const valid = parsed.value !== null && !parsed.error && !unchanged;

  function submit() {
    if (!valid || parsed.value === null) return;
    const value = parsed.value;
    void run(async () => {
      await api.validationThresholds.set(threshold.currency, value);
      return `Seuil enregistré : au-delà de ${formatAmount(value, threshold.currency)}, un envoi attend la validation d’un administrateur.`;
    });
  }

  return (
    <ConfirmDialog
      open
      title="Modifier le seuil de validation"
      confirmLabel="Enregistrer le seuil"
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
        <p className="split-dialog__case">{currencyLabel(threshold.currency)}</p>
        <Field
          id="threshold-amount"
          label={`Seuil (${threshold.currency})`}
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            clearError();
          }}
          error={amount.trim() === '' ? 'Saisissez un montant (0 pour tout valider à la main).' : parsed.error}
          autoFocus
        />
        <div className="fee-preview" aria-live="polite">
          <p>
            <span className="muted">Un envoi de plus de</span>
            <strong data-testid="threshold-preview">{parsed.value === null ? '—' : formatAmount(parsed.value, threshold.currency)}</strong>
          </p>
        </div>
        {unchanged ? <Notice tone="info">Aucune modification à enregistrer.</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <p className="muted">
          S’applique aux prochains envois cash. Jusqu’au seuil inclus, l’envoi est validé d’office ; au-delà, il attend la validation d’un administrateur. Les envois déjà
          enregistrés ne changent pas.
        </p>
      </form>
    </ConfirmDialog>
  );
}
