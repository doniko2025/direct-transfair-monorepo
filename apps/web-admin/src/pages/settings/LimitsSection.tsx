// src/pages/settings/LimitsSection.tsx
// Réglages › Plafonds : une carte compacte par niveau KYC pour la devise choisie + historique compact.
// Admin de société : modifie ou rétablit les valeurs par défaut. Super admin : consulte (lecture seule).

import { useState } from 'react';
import type { LimitChange, TransferLimit, TransferLimits } from '@direct-transfair/shared';
import { ConfirmDialog, SelectField } from '../../components/form';
import { Notice, Pill } from '../../components/ui';
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
} from '../../lib/limitRules';
import { sortThresholds } from '../../lib/thresholdRules';
import type { Resource } from '../../lib/useResource';
import { ChangeLog, IconBtn, SectionState, type LogItem } from './SettingsKit';
import LimitsDialog from './LimitsDialog';

function LevelTile({ limit, editable, onEdit, onReset }: { limit: TransferLimit; editable: boolean; onEdit: () => void; onReset: () => void }) {
  const title = LEVEL_TITLE[limit.kycLevel];
  return (
    <li className="set-tile" data-limit={`${limit.kycLevel}-${limit.currency}`}>
      <div className="set-tile__head">
        <div className="set-tile__title">
          <strong>{title}</strong>
          <small>{LEVEL_HINT[limit.kycLevel]}</small>
        </div>
        <div className="set-tile__tools">
          {limit.configured ? <Pill tone="ok">Configuré</Pill> : <Pill tone="warn">Par défaut</Pill>}
          {editable ? <IconBtn icon="edit" label={`Modifier les plafonds du ${title.toLowerCase()}`} onClick={onEdit} /> : null}
          {editable && limit.configured ? <IconBtn icon="refresh" label={`Rétablir les plafonds par défaut du ${title.toLowerCase()}`} onClick={onReset} /> : null}
        </div>
      </div>
      <dl className="set-limits">
        {LIMIT_KEYS.map((k) => (
          <div key={k}>
            <dt>{LIMIT_LABEL[k]}</dt>
            <dd data-part={k}>{limitText(limit[k], limit.currency)}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

/** Seules les périodes modifiées sont listées (« Par envoi : 500 € → Sans plafond »). */
function toItem(c: LimitChange): LogItem {
  const cur = c.currency ?? 'XOF';
  const changed = LIMIT_KEYS.filter((k) => !c.from || !c.to || c.from[k] !== c.to[k]);
  const keys = changed.length > 0 ? changed : LIMIT_KEYS;
  return {
    id: c.id,
    title: changeTitle(c),
    createdAt: c.createdAt,
    user: c.user,
    lines: c.to ? keys.map((k) => ({ label: LIMIT_LABEL[k], from: c.from ? limitText(c.from[k], cur) : null, to: limitText(c.to![k], cur) })) : [],
  };
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
    <div className="set-panel">
      <p className="set-intro">
        Ce qu’un client peut envoyer selon son niveau de vérification (KYC), devise par devise : par envoi, par jour, par mois et par an. Un envoi qui dépasse un
        plafond est refusé. Les mêmes plafonds encadrent les dépôts en espèces en agence. Le niveau d’un client se change depuis sa fiche.
      </p>
      <SectionState resource={limits} loadingLabel="Chargement des plafonds" errorTitle="Impossible de charger les plafonds" />
      {data ? (
        <>
          <div className="toolbar toolbar--inline">
            <SelectField
              id="limits-currency"
              label="Devise"
              className="toolbar__select"
              value={current}
              onChange={(e) => setCurrency(e.target.value)}
              options={currencies.map((c) => ({ value: c, label: currencyLabel(c) }))}
            />
          </div>
          <ul className="set-tiles">
            {cards.map((l) => (
              <LevelTile
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
          <p className="set-note">
            Les envois faits par un agent pour un client de passage ne sont pas concernés : ce client n’a pas de compte, donc pas de niveau de vérification.
          </p>
        </>
      ) : null}

      <ChangeLog resource={log} toItem={toItem} emptyText="Les changements de plafonds apparaîtront ici." />

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
    </div>
  );
}
