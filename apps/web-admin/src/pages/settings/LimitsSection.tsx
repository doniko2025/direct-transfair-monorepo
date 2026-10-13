// src/pages/settings/LimitsSection.tsx
// Réglages › Plafonds d'envoi : une carte par niveau KYC pour la devise choisie + dernières modifications.
// Admin de société : modifie ou rétablit les valeurs par défaut. Super admin : consulte (lecture seule).

import { useState } from 'react';
import type { LimitChange, TransferLimit, TransferLimits } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, SelectField } from '../../components/form';
import { Button, Card, Notice, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import {
  changeTitle,
  currencyLabel,
  KYC_LEVELS,
  LEVEL_HINT,
  LEVEL_TITLE,
  LIMIT_KEYS,
  LIMIT_LABEL,
  limitText,
  summary,
} from '../../lib/limitRules';
import { fullDate, when } from '../../lib/supervisionRules';
import { sortThresholds } from '../../lib/thresholdRules';
import type { Resource } from '../../lib/useResource';
import LimitsDialog from './LimitsDialog';

function LevelCard({ limit, editable, onEdit, onReset }: { limit: TransferLimit; editable: boolean; onEdit: () => void; onReset: () => void }) {
  return (
    <li className="split-card" data-limit={`${limit.kycLevel}-${limit.currency}`}>
      <div className="split-card__head">
        <h3>{LEVEL_TITLE[limit.kycLevel]}</h3>
        {limit.configured ? <Pill tone="ok">Configuré</Pill> : <Pill tone="warn">Par défaut</Pill>}
      </div>
      <p className="split-card__dest">{LEVEL_HINT[limit.kycLevel]}</p>
      <dl className="limit-card__rows">
        {LIMIT_KEYS.map((k) => (
          <div key={k}>
            <dt>{LIMIT_LABEL[k]}</dt>
            <dd data-part={k}>{limitText(limit[k], limit.currency)}</dd>
          </div>
        ))}
      </dl>
      {!limit.configured ? <p className="split-card__hint">Rien n’est enregistré : les plafonds par défaut s’appliquent.</p> : null}
      {editable ? (
        <div className="split-card__actions">
          <Button variant="secondary" icon="edit" onClick={onEdit}>
            Modifier
          </Button>{' '}
          {limit.configured ? (
            <Button variant="secondary" onClick={onReset}>
              Rétablir le défaut
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Entry({ c }: { c: LimitChange }) {
  return (
    <li className="fee-log">
      <div className="fee-log__main">
        <div className="fee-log__head">
          <Pill tone="brand">Plafonds modifiés</Pill>
          <strong>{changeTitle(c)}</strong>
        </div>
        <p className="fee-log__change">
          {c.from ? (
            <>
              <span className="muted">{summary(c.from, c.currency)}</span>
              <Icon name="chevronRight" size={16} />
            </>
          ) : null}
          <strong>{summary(c.to, c.currency)}</strong>
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
  limits: Resource<TransferLimits | null>;
  log: Resource<{ data: LimitChange[] }>;
  onChanged: (message: string) => void;
}

export default function LimitsSection({ limits, log, onChanged }: Props) {
  const [currency, setCurrency] = useState('');
  const [editing, setEditing] = useState<TransferLimit | null>(null);
  const [resetting, setResetting] = useState<TransferLimit | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const data = limits.data;
  const editable = data?.editable ?? false;
  const currencies = sortThresholds((data?.currencies ?? []).map((c) => ({ currency: c }))).map((c) => c.currency);
  const current = currency && currencies.includes(currency) ? currency : (currencies[0] ?? '');
  const cards = KYC_LEVELS.map((l) => (data?.limits ?? []).find((x) => x.kycLevel === l && x.currency === current)).filter((x): x is TransferLimit => !!x);
  const entries = log.data?.data ?? [];

  async function confirmReset() {
    if (!resetting) return;
    setBusy(true);
    setResetError(null);
    try {
      const r = resetting;
      await api.transferLimits.reset(r.kycLevel, r.currency);
      setResetting(null);
      onChanged(`Plafonds par défaut rétablis pour le ${LEVEL_TITLE[r.kycLevel].toLowerCase()} en ${r.currency}.`);
    } catch (err) {
      setResetError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section aria-labelledby="limits-title" className="tr-section">
        <div className="tr-section__head">
          <h2 id="limits-title">Plafonds d’envoi</h2>
          <p>
            Ce qu’un client peut envoyer selon son niveau de vérification (KYC), devise par devise : par envoi, par jour, par mois et par an. Un envoi qui dépasse un
            plafond est refusé. Le niveau d’un client se change depuis sa fiche.
          </p>
        </div>
        {limits.loading && !data ? (
          <div className="center-block">
            <Spinner label="Chargement des plafonds" />
          </div>
        ) : limits.error && !data ? (
          <Card>
            <Notice
              tone="error"
              title="Impossible de charger les plafonds"
              action={
                <button type="button" className="link-btn" onClick={limits.reload}>
                  Réessayer
                </button>
              }
            >
              {describeError(limits.error).message}
            </Notice>
          </Card>
        ) : (
          <>
            <div className="toolbar">
              <SelectField
                id="limits-currency"
                label="Devise"
                className="toolbar__select"
                value={current}
                onChange={(e) => setCurrency(e.target.value)}
                options={currencies.map((c) => ({ value: c, label: currencyLabel(c) }))}
              />
            </div>
            <ul className="split-grid">
              {cards.map((l) => (
                <LevelCard
                  key={`${l.kycLevel}-${l.currency}`}
                  limit={l}
                  editable={editable}
                  onEdit={() => setEditing(l)}
                  onReset={() => {
                    setResetError(null);
                    setResetting(l);
                  }}
                />
              ))}
            </ul>
            <p className="muted">
              Les envois faits par un agent pour un client de passage ne sont pas concernés : ce client n’a pas de compte, donc pas de niveau de vérification.
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="limits-log-title" className="tr-section">
        <div className="tr-section__head">
          <h2 id="limits-log-title">Dernières modifications des plafonds</h2>
          <p>Qui a changé un plafond, et quand.</p>
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
            <p>Les changements de plafonds apparaîtront ici.</p>
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
        <LimitsDialog
          limit={editing}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            onChanged(message);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={resetting !== null}
        title="Rétablir les plafonds par défaut ?"
        confirmLabel="Rétablir"
        busy={busy}
        onConfirm={() => void confirmReset()}
        onCancel={() => setResetting(null)}
      >
        {resetting ? (
          <>
            <p>
              Le {LEVEL_TITLE[resetting.kycLevel].toLowerCase()} en {resetting.currency} reprend les plafonds par défaut du serveur : par envoi{' '}
              {limitText(resetting.defaults.perTransaction, resetting.currency)}, par jour {limitText(resetting.defaults.daily, resetting.currency)}, par mois{' '}
              {limitText(resetting.defaults.monthly, resetting.currency)}, par an {limitText(resetting.defaults.yearly, resetting.currency)}.
            </p>
            {resetError ? <Notice tone="error">{resetError}</Notice> : null}
          </>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
