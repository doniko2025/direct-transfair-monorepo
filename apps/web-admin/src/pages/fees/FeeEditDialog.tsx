// src/pages/fees/FeeEditDialog.tsx
// Modifier le tarif d'un mode de retrait (admin de société).

import { useState, type FormEvent } from 'react';
import type { FeeMethod } from '@direct-transfair/shared';
import { ConfirmDialog } from '../../components/form';
import { Field, Notice } from '../../components/ui';
import { api } from '../../lib/api';
import {
  computeFee,
  feeSummary,
  formatNumber,
  MAX_FEE_RATE,
  parseFeeRate,
  parseFixedFee,
  toInput,
} from '../../lib/feeRules';
import { useDialogAction } from '../treasury/useDialogAction';

interface Props {
  method: FeeMethod;
  onClose: () => void;
  onDone: (message: string) => void;
}

const EXAMPLE = 1000;

export default function FeeEditDialog({ method, onClose, onDone }: Props) {
  const [rate, setRate] = useState(toInput(method.feeRate));
  const [fixed, setFixed] = useState(toInput(method.fixedFee));
  const { busy, error, run, clearError } = useDialogAction(onDone);

  const r = parseFeeRate(rate);
  const f = parseFixedFee(fixed);
  const unchanged = method.configured && r.value === method.feeRate && f.value === method.fixedFee;
  const valid = r.value !== null && f.value !== null && !unchanged;

  function submit() {
    if (!valid || r.value === null || f.value === null) return;
    const values = { feeRate: r.value, fixedFee: f.value };
    void run(async () => {
      await api.fees.set(method.payoutMethod, values);
      return `Frais « ${method.label} » enregistrés : ${feeSummary(values)}.`;
    });
  }

  const preview = r.value !== null && f.value !== null ? { feeRate: r.value, fixedFee: f.value } : null;

  return (
    <ConfirmDialog
      open
      title={method.label}
      confirmLabel="Enregistrer les frais"
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
        <p className="fee-now">
          Frais actuels : <strong>{feeSummary(method)}</strong>
          {method.configured ? null : <span className="muted"> (taux par défaut)</span>}
        </p>
        <Field
          id="fee-rate"
          label="Taux en pourcentage"
          inputMode="decimal"
          autoComplete="off"
          value={rate}
          onChange={(e) => {
            setRate(e.target.value);
            clearError();
          }}
          error={rate.trim() === '' ? 'Saisissez un taux (0 pour aucun).' : r.error}
          hint={`Prélevé sur le montant envoyé. Jusqu’à ${MAX_FEE_RATE} %, deux décimales au maximum.`}
          autoFocus
        />
        <Field
          id="fee-fixed"
          label="Frais fixe"
          inputMode="decimal"
          autoComplete="off"
          value={fixed}
          onChange={(e) => {
            setFixed(e.target.value);
            clearError();
          }}
          error={fixed.trim() === '' ? 'Saisissez un montant (0 pour aucun).' : f.error}
          hint="Ajouté à chaque envoi, tel quel, dans la devise de l’envoi."
        />
        {f.value !== null && f.value > 0 ? (
          <Notice tone="info">
            Un frais fixe de {formatNumber(f.value)} vaut {formatNumber(f.value)} euros pour un envoi en euros comme{' '}
            {formatNumber(f.value)} francs pour un envoi en francs. Laissez 0 si vos clients envoient en plusieurs devises.
          </Notice>
        ) : null}

        {preview ? (
          <div className="fee-preview" aria-live="polite">
            <p>
              <span className="muted">Sur un envoi de {formatNumber(EXAMPLE)}</span>
              <strong>{formatNumber(computeFee(EXAMPLE, preview))} de frais</strong>
            </p>
            <p>
              <span className="muted">Le client paie</span>
              <strong>{formatNumber(EXAMPLE + computeFee(EXAMPLE, preview))}</strong>
            </p>
          </div>
        ) : null}

        {unchanged ? <Notice tone="info">Ce sont déjà les frais appliqués.</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </form>
    </ConfirmDialog>
  );
}
