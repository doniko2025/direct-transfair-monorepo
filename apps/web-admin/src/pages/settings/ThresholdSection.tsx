// src/pages/settings/ThresholdSection.tsx
// Réglages › Seuil de validation d'un envoi cash : une carte par devise + dernières modifications.
// Admin de société : modifie ou rétablit la valeur par défaut. Super admin : consulte (lecture seule).

import { useState } from 'react';
import type { ThresholdChange, ValidationThreshold, ValidationThresholds } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/form';
import { Button, Card, Notice, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { fullDate, when } from '../../lib/supervisionRules';
import { changeTitle, currencyLabel, sortThresholds, stateLine } from '../../lib/thresholdRules';
import type { Resource } from '../../lib/useResource';
import ThresholdDialog from './ThresholdDialog';

function ThresholdCard({
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
  return (
    <li className="split-card" data-threshold={threshold.currency}>
      <div className="split-card__head">
        <h3>{currencyLabel(threshold.currency)}</h3>
        {threshold.configured ? <Pill tone="ok">Configuré</Pill> : <Pill tone="warn">Par défaut</Pill>}
      </div>
      <dl className="split-card__shares">
        <div>
          <dt>Validation requise au-delà de</dt>
          <dd data-part="threshold">{formatAmount(threshold.amount, threshold.currency)}</dd>
        </div>
      </dl>
      {!threshold.configured ? <p className="split-card__hint">Rien n’est enregistré : le seuil par défaut s’applique.</p> : null}
      {editable ? (
        <div className="split-card__actions">
          <Button variant="secondary" icon="edit" onClick={onEdit}>
            Modifier
          </Button>{' '}
          {threshold.configured ? (
            <Button variant="secondary" onClick={onReset}>
              Rétablir le défaut
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Entry({ c }: { c: ThresholdChange }) {
  return (
    <li className="fee-log">
      <div className="fee-log__main">
        <div className="fee-log__head">
          <Pill tone="brand">Seuil modifié</Pill>
          <strong>{changeTitle(c)}</strong>
        </div>
        <p className="fee-log__change">
          {c.from ? (
            <>
              <span className="muted">{stateLine(c.from, c.currency)}</span>
              <Icon name="chevronRight" size={16} />
            </>
          ) : null}
          <strong>{stateLine(c.to, c.currency)}</strong>
        </p>
        <span className="muted fee-log__by">
          Par {c.user ?? 'un administrateur'} ·{' '}
          <time dateTime={c.createdAt} title={fullDate(c.createdAt)}>
            {when(c.createdAt)}
          </time>
        </span>
      </div>
    </li>
  );
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
  const entries = log.data?.data ?? [];

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
    <>
      <section aria-labelledby="threshold-title" className="tr-section">
        <div className="tr-section__head">
          <h2 id="threshold-title">Seuil de validation</h2>
          <p>
            Un envoi cash jusqu’au seuil est validé d’office. Au-delà, il attend la validation d’un administrateur avant de pouvoir être retiré. Le seuil se règle devise
            par devise.
          </p>
        </div>
        {thresholds.loading && !data ? (
          <div className="center-block">
            <Spinner label="Chargement des seuils" />
          </div>
        ) : thresholds.error && !data ? (
          <Card>
            <Notice
              tone="error"
              title="Impossible de charger les seuils"
              action={
                <button type="button" className="link-btn" onClick={thresholds.reload}>
                  Réessayer
                </button>
              }
            >
              {describeError(thresholds.error).message}
            </Notice>
          </Card>
        ) : (
          <ul className="split-grid">
            {list.map((t) => (
              <ThresholdCard
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
        )}
      </section>

      <section aria-labelledby="threshold-log-title" className="tr-section">
        <div className="tr-section__head">
          <h2 id="threshold-log-title">Dernières modifications du seuil</h2>
          <p>Qui a changé un seuil, et quand.</p>
        </div>
        {log.loading && !log.data ? (
          <div className="center-block">
            <Spinner label="Chargement du journal" />
          </div>
        ) : log.error && !log.data ? (
          <Card>
            <Notice
              tone="error"
              title="Impossible de charger le journal"
              action={
                <button type="button" className="link-btn" onClick={log.reload}>
                  Réessayer
                </button>
              }
            >
              {describeError(log.error).message}
            </Notice>
          </Card>
        ) : entries.length === 0 ? (
          <Card className="empty empty--compact">
            <span className="empty__icon">
              <Icon name="list" size={26} />
            </span>
            <h3>Aucune modification enregistrée</h3>
            <p>Les changements de seuil apparaîtront ici.</p>
          </Card>
        ) : (
          <ul className="fee-log-list">
            {entries.map((c) => (
              <Entry key={c.id} c={c} />
            ))}
          </ul>
        )}
      </section>

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
    </>
  );
}
