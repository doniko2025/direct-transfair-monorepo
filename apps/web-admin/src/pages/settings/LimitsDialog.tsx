// src/pages/settings/LimitsDialog.tsx
// Fixer les plafonds d'un niveau KYC dans une devise (admin de société).

import { useState, type FormEvent } from 'react';
import type { TransferLimit } from '@direct-transfair/shared';
import { ConfirmDialog } from '../../components/form';
import { Field, Notice } from '../../components/ui';
import { api } from '../../lib/api';
import {
  currencyLabel,
  formOf,
  LEVEL_HINT,
  LEVEL_TITLE,
  LIMIT_KEYS,
  LIMIT_LABEL,
  limitText,
  parseForm,
  sameValues,
  type LimitForm,
} from '../../lib/limitRules';
import { useDialogAction } from '../treasury/useDialogAction';

interface Props {
  limit: TransferLimit;
  onClose: () => void;
  onDone: (message: string) => void;
}

export default function LimitsDialog({ limit, onClose, onDone }: Props) {
  const [form, setForm] = useState<LimitForm>(() => formOf(limit));
  const { busy, error, run, clearError } = useDialogAction(onDone);

  const parsed = parseForm(form);
  const unchanged = parsed.values !== null && limit.configured && sameValues(parsed.values, limit);
  const valid = parsed.values !== null && parsed.order === null && !unchanged;

  function patch(key: (typeof LIMIT_KEYS)[number], change: Partial<LimitForm[typeof key]>) {
    setForm((f) => ({ ...f, [key]: { ...f[key], ...change } }));
    clearError();
  }

  function submit() {
    if (!valid || parsed.values === null) return;
    const values = parsed.values;
    void run(async () => {
      await api.transferLimits.set(limit.kycLevel, limit.currency, values);
      return `Plafonds enregistrés pour le ${LEVEL_TITLE[limit.kycLevel].toLowerCase()} en ${limit.currency}.`;
    });
  }

  return (
    <ConfirmDialog
      open
      title="Modifier les plafonds"
      confirmLabel="Enregistrer les plafonds"
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
        <p className="split-dialog__case">
          {LEVEL_TITLE[limit.kycLevel]} · {LEVEL_HINT[limit.kycLevel]}. {currencyLabel(limit.currency)}.
        </p>
        {LIMIT_KEYS.map((k, i) => (
          <div key={k} className="limit-field">
            <Field
              id={`limit-${k}`}
              label={`${LIMIT_LABEL[k]} (${limit.currency})`}
              inputMode="decimal"
              autoComplete="off"
              value={form[k].unlimited ? '' : form[k].text}
              disabled={form[k].unlimited}
              placeholder={form[k].unlimited ? 'Sans plafond' : undefined}
              onChange={(e) => patch(k, { text: e.target.value })}
              error={form[k].unlimited ? null : (parsed.errors[k] ?? (form[k].text.trim() === '' ? 'Saisissez un montant, ou cochez « Sans plafond ».' : null))}
              hint={`Par défaut : ${limitText(limit.defaults[k], limit.currency)}`}
              autoFocus={i === 0}
            />
            <label className="check-row check-row--inline">
              <input type="checkbox" checked={form[k].unlimited} onChange={(e) => patch(k, { unlimited: e.target.checked })} />
              <span>Sans plafond</span>
            </label>
          </div>
        ))}
        {parsed.order ? <Notice tone="error">{parsed.order}</Notice> : null}
        {unchanged ? <Notice tone="info">Aucune modification à enregistrer.</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <p className="muted">
          S’applique aux prochains envois des clients de ce niveau. Un envoi qui dépasse un plafond est refusé, avec le montant restant disponible. Les envois déjà faits
          comptent dans les plafonds jour, mois et an.
        </p>
      </form>
    </ConfirmDialog>
  );
}
