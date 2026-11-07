// src/pages/wallet-clients/KycLevelDialog.tsx
// Changer le niveau de vérification (KYC) d'un client : c'est lui qui décide des plafonds d'envoi (Réglages › Plafonds d'envoi).
// Réservé à l'admin de la société.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { KycLevel } from '@direct-transfair/shared';
import { ConfirmDialog, SelectField } from '../../components/form';
import { Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { KYC_LABEL } from '../../lib/userRules';
import { useDialogAction } from '../treasury/useDialogAction';

const LEVELS: readonly KycLevel[] = ['LEVEL_0', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3'];

interface Props {
  userId: string;
  current: KycLevel | null;
  onClose: () => void;
  onDone: (message: string) => void;
}

export default function KycLevelDialog({ userId, current, onClose, onDone }: Props) {
  const [level, setLevel] = useState<KycLevel>(current ?? 'LEVEL_0');
  const { busy, error, run, clearError } = useDialogAction(onDone);
  const unchanged = level === current;

  function submit() {
    if (unchanged) return;
    void run(async () => {
      await api.transferLimits.setKycLevel(userId, level);
      return `Niveau de vérification enregistré : ${KYC_LABEL[level]}.`;
    });
  }

  return (
    <ConfirmDialog
      open
      title="Niveau de vérification"
      confirmLabel="Enregistrer le niveau"
      busy={busy}
      confirmDisabled={unchanged}
      onConfirm={submit}
      onCancel={onClose}
    >
      <div className="dialog-form">
        <SelectField
          id="kyc-level"
          label="Niveau"
          value={level}
          onChange={(e) => {
            setLevel(e.target.value as KycLevel);
            clearError();
          }}
          options={LEVELS.map((l) => ({ value: l, label: KYC_LABEL[l] }))}
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <p className="muted">
          Le niveau monte normalement tout seul quand vous validez les pièces du client (Vérifications KYC). Le fixer à la main n’est possible que si ses pièces sont déjà validées : niveau 1 = pièce d’identité + selfie, niveau 2 et 3 = en plus un justificatif de domicile. Baisser le niveau est toujours possible. Ses plafonds d’envoi suivent immédiatement le niveau choisi (Réglages › Plafonds d’envoi).
        </p>
        <p className="muted">
          <Link to={`/kyc/${encodeURIComponent(userId)}`} className="link-btn">
            Ouvrir son dossier d’identité
          </Link>
        </p>
      </div>
    </ConfirmDialog>
  );
}
