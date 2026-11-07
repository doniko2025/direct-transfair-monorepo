// apps/web-admin/src/pages/support/RefundRequestDialog.tsx
// Demande de remboursement d'un envoi non encore payé. Rien n'est remboursé ici : un autre membre de l'équipe (ou l'administrateur)
// doit valider la demande dans « Remboursements » (règle des quatre yeux).

import { useState } from 'react';
import type { SupportTransaction } from '@direct-transfair/shared';
import { ConfirmDialog, TextAreaField } from '../../components/form';
import { Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { useDialogAction } from '../treasury/useDialogAction';

export function RefundRequestDialog({
  tx,
  ticketId,
  onClose,
  onDone,
}: {
  tx: SupportTransaction;
  ticketId?: string | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const { busy, error, run } = useDialogAction(onDone);

  function submit() {
    if (reason.trim().length < 5) {
      setProblem('Indiquez le motif (5 caractères minimum).');
      return;
    }
    void run(async () => {
      await api.support.requestRefund({ transactionId: tx.id, reason: reason.trim(), ...(ticketId ? { ticketId } : {}) });
      return 'Demande de remboursement envoyée : un collègue doit la valider.';
    });
  }

  return (
    <ConfirmDialog open title="Demander un remboursement" confirmLabel="Envoyer la demande" busy={busy} onConfirm={submit} onCancel={onClose}>
      <div className="dialog-form">
        <p>
          Envoi <strong>{tx.reference}</strong> : l'expéditeur serait recrédité de <strong>{formatAmount(tx.total, tx.currency)}</strong> (montant + frais) et l'envoi serait annulé.
        </p>
        <TextAreaField
          id="rr-reason"
          label="Motif"
          value={reason}
          error={problem}
          maxLength={500}
          onChange={(e) => {
            setReason(e.target.value);
            setProblem(null);
          }}
          hint="Visible dans le journal d'audit."
        />
        <Notice tone="info">Cette demande doit être validée par une autre personne avant tout mouvement d'argent.</Notice>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}
