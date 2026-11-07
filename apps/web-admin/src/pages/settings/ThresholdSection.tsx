// src/pages/settings/ThresholdSection.tsx
// Réglages › Seuils : une ligne par devise (devise · seuil · modifier / rétablir) + historique compact.
// Admin de société : modifie ou rétablit la valeur par défaut. Super admin : consulte (lecture seule).

import { useState } from 'react';
import type { ThresholdChange, ValidationThreshold, ValidationThresholds } from '@direct-transfair/shared';
import { ConfirmDialog } from '../../components/form';
import { Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { changeTitle, currencyLabel, sortThresholds, stateLine } from '../../lib/thresholdRules';
import type { Resource } from '../../lib/useResource';
import { ChangeLog, IconBtn, SectionState, type LogItem } from './SettingsKit';
import ThresholdDialog from './ThresholdDialog';

function ThresholdRow({
  threshold,
  editable,
  onEdit,
  onReset,
}: {
  threshold: ValidationThreshold;
  editable: boolean;
  onEdit: () => void;
  onReset: () => void;
}) {
  const label = currencyLabel(threshold.currency);
  return (
    <li className="set-line" data-threshold={threshold.currency}>
      <div className="set-line__main">
        <strong>{label}</strong>
        <small className={threshold.configured ? 'set-state set-state--ok' : 'set-state set-state--warn'}>
          {threshold.configured ? 'Configuré' : 'Par défaut'}
        </small>
      </div>
      <span className="set-line__val" data-part="threshold">
        {formatAmount(threshold.amount, threshold.currency)}
      </span>
      {editable ? (
        <div className="set-line__acts">
          <IconBtn icon="edit" label={`Modifier le seuil en ${threshold.currency}`} onClick={onEdit} />
          {threshold.configured ? <IconBtn icon="refresh" label={`Rétablir le seuil par défaut en ${threshold.currency}`} onClick={onReset} /> : null}
        </div>
      ) : null}
    </li>
  );
}

function toItem(c: ThresholdChange): LogItem {
  return {
    id: c.id,
    title: changeTitle(c),
    createdAt: c.createdAt,
    user: c.user,
    lines: [{ from: c.from ? stateLine(c.from, c.currency) : null, to: stateLine(c.to, c.currency) }],
  };
}

interface Props {
  thresholds: Resource<ValidationThresholds | null>;
  log: Resource<{ data: ThresholdChange[] }>;
  /** Appelé après une modification réussie (message à afficher) : la page recharge les données. */
  onChanged: (message: string) => void;
}

export default function ThresholdSection({ thresholds, log, onChanged }: Props) {
  const [editing, setEditing] = useState<ValidationThreshold | null>(null);
  const [resetting, setResetting] = useState<ValidationThreshold | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const data = thresholds.data;
  const editable = data?.editable ?? false;
  const list = sortThresholds(data?.thresholds ?? []);

  async function confirmReset() {
    if (!resetting) return;
    setBusy(true);
    setResetError(null);
    try {
      const r = resetting;
      await api.validationThresholds.reset(r.currency);
      setResetting(null);
      onChanged(`Seuil rétabli : ${formatAmount(r.defaultAmount, r.currency)} s’applique de nouveau en ${r.currency}.`);
    } catch (err) {
      setResetError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="set-panel">
      <p className="set-intro">
        Un envoi cash jusqu’au seuil est validé d’office. Au-delà, il attend la validation d’un administrateur avant de pouvoir être retiré. Le seuil se règle devise
        par devise.
      </p>
      <SectionState resource={thresholds} loadingLabel="Chargement des seuils" errorTitle="Impossible de charger les seuils" />
      {data ? (
        <section className="set-card" aria-label="Seuils de validation par devise">
          <p className="set-card__cap">Validation requise au-delà de</p>
          <ul className="set-lines">
            {list.map((t) => (
              <ThresholdRow
                key={t.currency}
                threshold={t}
                editable={editable}
                onEdit={() => setEditing(t)}
                onReset={() => {
                  setResetError(null);
                  setResetting(t);
                }}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <ChangeLog resource={log} toItem={toItem} emptyText="Les changements de seuil apparaîtront ici." />

      {editing ? (
        <ThresholdDialog
          threshold={editing}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            onChanged(message);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={resetting !== null}
        title="Rétablir le seuil par défaut ?"
        confirmLabel="Rétablir"
        busy={busy}
        onConfirm={() => void confirmReset()}
        onCancel={() => setResetting(null)}
      >
        {resetting ? (
          <>
            <p>
              Le seuil en {resetting.currency} repasse de {formatAmount(resetting.amount, resetting.currency)} à{' '}
              {formatAmount(resetting.defaultAmount, resetting.currency)}, la valeur par défaut. Les envois déjà enregistrés ne changent pas.
            </p>
            {resetError ? <Notice tone="error">{resetError}</Notice> : null}
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
