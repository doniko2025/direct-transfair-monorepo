// src/pages/settings/SplitDialog.tsx
// Modifier la répartition des frais d'une combinaison expéditeur → agence payeuse (admin de société).

import { useState, type FormEvent } from 'react';
import type { SplitRule } from '@direct-transfair/shared';
import { ConfirmDialog } from '../../components/form';
import { Field, Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { DEST_LABEL, parsePercent, pct, platformOf, SOURCE_LABEL, toInput } from '../../lib/splitRules';
import { useDialogAction } from '../treasury/useDialogAction';

interface Props {
  rule: SplitRule;
  onClose: () => void;
  onDone: (message: string) => void;
}

export default function SplitDialog({ rule, onClose, onDone }: Props) {
  const fromWallet = rule.sourceType === 'WALLET';
  const [sender, setSender] = useState(toInput(fromWallet ? 0 : rule.senderShare));
  const [payer, setPayer] = useState(toInput(rule.payerShare));
  const { busy, error, run, clearError } = useDialogAction(onDone);

  const senderP = parsePercent(sender);
  const payerP = parsePercent(payer);
  const senderValue = fromWallet ? 0 : senderP.value;
  const platform = senderValue !== null && payerP.value !== null ? platformOf(senderValue, payerP.value) : null;
  const overflow = platform !== null && platform < 0;
  const unchanged =
    rule.configured && senderValue === rule.senderShare && payerP.value === rule.payerShare;
  const valid = senderValue !== null && payerP.value !== null && !overflow && !unchanged && !senderP.error && !payerP.error;

  function submit() {
    if (!valid || senderValue === null || payerP.value === null) return;
    const shares = { senderShare: senderValue, payerShare: payerP.value };
    void run(async () => {
      await api.commissionRules.set(rule.sourceType, rule.destType, shares);
      return `Répartition enregistrée : agence payeuse ${pct(shares.payerShare)}, société ${pct(platformOf(shares.senderShare, shares.payerShare))}.`;
    });
  }

  const touch = (set: (v: string) => void) => (v: string) => {
    set(v);
    clearError();
  };

  return (
    <ConfirmDialog
      open
      title="Modifier la répartition"
      confirmLabel="Enregistrer la répartition"
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
          {SOURCE_LABEL[rule.sourceType]}. {DEST_LABEL[rule.destType]}.
        </p>
        {fromWallet ? (
          <Notice tone="info">
            Un client n’a pas d’agence d’envoi : la part de l’agence d’envoi est toujours de 0 % et revient à la société.
          </Notice>
        ) : (
          <Field
            id="split-sender"
            label="Part de l’agence d’envoi (%)"
            inputMode="decimal"
            autoComplete="off"
            value={sender}
            onChange={(e) => touch(setSender)(e.target.value)}
            error={sender.trim() === '' ? 'Saisissez un pourcentage (0 pour aucune part).' : senderP.error}
            autoFocus
          />
        )}
        <Field
          id="split-payer"
          label="Part de l’agence qui paie le cash (%)"
          inputMode="decimal"
          autoComplete="off"
          value={payer}
          onChange={(e) => touch(setPayer)(e.target.value)}
          error={payer.trim() === '' ? 'Saisissez un pourcentage (0 pour aucune part).' : payerP.error}
          autoFocus={fromWallet}
        />
        <div className="fee-preview" aria-live="polite">
          <p>
            <span className="muted">Part de la société (le reste)</span>
            <strong data-testid="split-platform">{platform === null ? '—' : pct(platform)}</strong>
          </p>
        </div>
        {overflow ? <Notice tone="error">La somme des parts dépasse 100 %. Réduisez la part de l’agence payeuse ou celle de l’agence d’envoi.</Notice> : null}
        {unchanged ? <Notice tone="info">Aucune modification à enregistrer.</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <p className="muted">S’applique aux prochains retraits payés. Les commissions déjà créditées ne changent pas.</p>
      </form>
    </ConfirmDialog>
  );
}
