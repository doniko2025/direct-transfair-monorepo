// src/pages/rates/RateEditDialog.tsx
// Fixer le taux d'un couple de devises (super admin). Le sens inverse se déduit automatiquement.

import { useState, type FormEvent } from 'react';
import { ApiError, type RatePair } from '@direct-transfair/shared';
import { ConfirmDialog } from '../../components/form';
import { Field, Notice } from '../../components/ui';
import { api } from '../../lib/api';
import {
  appliedRate,
  changeBetween,
  formatChange,
  formatRate,
  inverseOf,
  isLargeChange,
  LARGE_CHANGE_PERCENT,
  parseRate,
  rateLine,
} from '../../lib/ratesRules';
import { useDialogAction } from '../treasury/useDialogAction';

interface Props {
  pair: RatePair;
  onClose: () => void;
  onDone: (message: string) => void;
}

export default function RateEditDialog({ pair, onClose, onDone }: Props) {
  const current = appliedRate(pair);
  const [raw, setRaw] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  // Le serveur peut juger la variation trop grande alors que l'écran n'a pas pu la calculer.
  const [serverAsksConfirm, setServerAsksConfirm] = useState(false);
  const { busy, error, run, clearError } = useDialogAction(onDone);

  const parsed = parseRate(raw);
  const change = parsed.value !== null ? changeBetween(parsed.value, current) : null;
  const large = isLargeChange(change) || serverAsksConfirm;
  const unchanged = parsed.value !== null && parsed.value === current && pair.rate !== null && !pair.inverseMismatch;
  const valid = parsed.value !== null && !unchanged && (!large || confirmed);

  function submit() {
    if (!valid || parsed.value === null) return;
    const value = parsed.value;
    void run(async () => {
      try {
        await api.rates.set(pair.pair, value, large && confirmed);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'LARGE_CHANGE') {
          setServerAsksConfirm(true);
          setConfirmed(false);
        }
        throw err;
      }
      return `${rateLine(pair.base, pair.quote, value)} — le sens inverse est mis à jour.`;
    });
  }

  const inverse = inverseOf(parsed.value);
  const fieldError = raw.trim() !== '' ? parsed.error ?? (unchanged ? 'C’est déjà le taux appliqué.' : null) : null;

  return (
    <ConfirmDialog
      open
      title={`Taux ${pair.base} → ${pair.quote}`}
      confirmLabel="Enregistrer le taux"
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
        <p className="rate-now">
          Taux actuel : <strong>{rateLine(pair.base, pair.quote, current)}</strong>
          {pair.rate === null ? <span className="muted"> (taux de secours)</span> : null}
        </p>
        <Field
          id="rate-value"
          label={`Nouvelle valeur de 1 ${pair.base} en ${pair.quote}`}
          inputMode="decimal"
          autoComplete="off"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setConfirmed(false);
            setServerAsksConfirm(false);
            clearError();
          }}
          error={fieldError}
          hint="Utilisez la virgule ou le point pour les décimales."
          autoFocus
        />

        {parsed.value !== null && !unchanged ? (
          <div className="rate-preview" aria-live="polite">
            <p>
              <span className="muted">Sens inverse calculé</span>
              <strong>{rateLine(pair.quote, pair.base, inverse)}</strong>
            </p>
            <p>
              <span className="muted">Exemple</span>
              <strong>
                {`1 000 ${pair.base} = ${formatRate(parsed.value * 1000)} ${pair.quote}`}
              </strong>
            </p>
            {change !== null ? (
              <p>
                <span className="muted">Variation</span>
                <strong className={large ? 'rate-preview__warn' : undefined}>{formatChange(change)}</strong>
              </p>
            ) : null}
          </div>
        ) : null}

        {pair.inverseMismatch ? (
          <Notice tone="info">
            Les deux sens sont aujourd’hui enregistrés avec des valeurs incohérentes. L’enregistrement les aligne.
          </Notice>
        ) : null}

        {large ? (
          <label className="rate-confirm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>
              {change !== null
                ? `Je confirme cette variation de ${formatChange(change)} (au-delà de ${LARGE_CHANGE_PERCENT} %).`
                : `Je confirme cette forte variation (au-delà de ${LARGE_CHANGE_PERCENT} %).`}
            </span>
          </label>
        ) : null}

        {error ? <Notice tone="error">{error}</Notice> : null}
      </form>
    </ConfirmDialog>
  );
}
