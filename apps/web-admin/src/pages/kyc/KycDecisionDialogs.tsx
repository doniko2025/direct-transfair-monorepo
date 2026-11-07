// src/pages/kyc/KycDecisionDialogs.tsx
// Valider (note facultative) ou refuser / révoquer (motif obligatoire, envoyé au client).

import { useState } from 'react';
import type { KycDocumentView } from '@direct-transfair/shared';
import { ConfirmDialog, TextAreaField } from '../../components/form';
import { Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { useDialogAction } from '../treasury/useDialogAction';

export const REJECT_REASONS = [
  'Photo floue ou illisible',
  'Pièce coupée : les quatre coins doivent être visibles',
  'Le nom ne correspond pas à celui du compte',
  "La date d'expiration ne correspond pas à celle saisie",
  'Selfie : le visage doit être bien visible, sans lunettes ni masque',
  'Pièce expirée',
  'Document non accepté : envoyez une pièce officielle avec photo',
] as const;

interface Props {
  doc: KycDocumentView;
  onClose: () => void;
  onDone: (message: string) => void;
}

export function ApproveDialog({ doc, onClose, onDone }: Props) {
  const [note, setNote] = useState('');
  const { busy, error, run } = useDialogAction(onDone);
  return (
    <ConfirmDialog
      open
      title={`Valider : ${doc.label}`}
      confirmLabel="Valider la pièce"
      busy={busy}
      onConfirm={() =>
        void run(async () => {
          await api.kyc.approve(doc.id, note);
          return `${doc.label} validée. Le client est prévenu.`;
        })
      }
      onCancel={onClose}
    >
      <div className="dialog-form">
        <p className="muted">
          Vérifiez que la photo est lisible, que le nom et la date de naissance correspondent au compte et que la pièce est en cours de validité. Le client est prévenu par notification, push et e-mail.
        </p>
        <TextAreaField id="kyc-note" label="Note interne (facultative)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} hint="Conservée dans le journal d'audit, jamais montrée au client." />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}

export function RejectDialog({ doc, onClose, onDone }: Props) {
  const revoke = doc.status === 'APPROVED';
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const { busy, error, run } = useDialogAction(onDone);
  const clean = reason.trim();
  const invalid = clean.length < 5;

  return (
    <ConfirmDialog
      open
      tone="danger"
      title={`${revoke ? 'Révoquer' : 'Refuser'} : ${doc.label}`}
      confirmLabel={revoke ? 'Révoquer la pièce' : 'Refuser la pièce'}
      busy={busy}
      confirmDisabled={invalid}
      onConfirm={() => {
        setTouched(true);
        if (invalid) return;
        void run(async () => {
          await api.kyc.reject(doc.id, clean);
          return revoke ? `${doc.label} révoquée : le niveau du client a été recalculé.` : `${doc.label} refusée. Le client a reçu le motif.`;
        });
      }}
      onCancel={onClose}
    >
      <div className="dialog-form">
        {revoke ? (
          <Notice tone="info" title="Révocation">
            La pièce était validée. Si elle prouvait l'identité du client, il ne pourra plus envoyer ni retirer tant qu'il n'aura pas renvoyé une pièce valide.
          </Notice>
        ) : null}
        <div className="kyc-reasons" role="group" aria-label="Motifs fréquents">
          {REJECT_REASONS.map((r) => (
            <button key={r} type="button" className="kyc-reason" aria-pressed={reason === r} onClick={() => setReason(r)}>
              {r}
            </button>
          ))}
        </div>
        <TextAreaField
          id="kyc-reason"
          label="Motif envoyé au client"
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          error={touched && invalid ? 'Indiquez un motif clair (5 caractères minimum).' : null}
          hint="Le client le lit tel quel : expliquez ce qu'il doit corriger."
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}
