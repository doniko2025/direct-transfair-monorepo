// src/pages/rates/FxMarginCard.tsx
// Marge de change de la société : pourcentage retenu sur chaque conversion côté client (envoi, dépôt, simulateur).
// C'est ce qui rapporte à la société quand ses frais d'envoi sont à 0. Réglage COMPANY_ADMIN ; le super admin consulte seulement.

import { useEffect, useState, type FormEvent } from 'react';
import type { RatePair } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Button, Field, Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import {
  customerRate,
  examplePair,
  formatMargin,
  formatRate,
  FX_MARGIN_PRESETS,
  MAX_FX_MARGIN_PCT,
  parseMargin,
} from '../../lib/ratesRules';

interface Props {
  current: number;
  max?: number;
  canEdit: boolean;
  pairs: readonly RatePair[];
  onSaved: (message: string) => void;
}

const asInput = (n: number) => String(n).replace('.', ',');

export default function FxMarginCard({ current, max = MAX_FX_MARGIN_PCT, canEdit, pairs, onSaved }: Props) {
  const [raw, setRaw] = useState(asInput(current));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La valeur serveur fait foi : on resynchronise la saisie après un rechargement.
  useEffect(() => setRaw(asInput(current)), [current]);

  const parsed = parseMargin(raw, max);
  const value = parsed.value ?? current;
  const dirty = parsed.value !== null && parsed.value !== current;
  const ex = examplePair(pairs);
  const exMarket = ex?.rate ?? null;
  const exClient = exMarket !== null ? customerRate(exMarket, value) : null;

  async function save() {
    if (!dirty || parsed.value === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.rates.setMargin(parsed.value);
      onSaved(res.fxMarginPct > 0 ? `Marge de change fixée à ${formatMargin(res.fxMarginPct)}.` : 'Marge de change désactivée.');
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="fxm" aria-labelledby="fxm-title" data-active={current > 0 ? 'true' : 'false'}>
      <div className="fxm__head">
        <span className="fxm__icon" aria-hidden="true"><Icon name="percent" size={20} /></span>
        <div className="fxm__titles">
          <h2 id="fxm-title" className="fxm__title">Marge de change</h2>
          <p className="fxm__sub">Retenue sur chaque conversion côté client : c’est votre gain sur le change, même avec des frais d’envoi à 0.</p>
        </div>
        <span className="fxm__badge" data-on={current > 0 ? 'true' : 'false'}>{current > 0 ? formatMargin(current) : 'Désactivée'}</span>
      </div>

      {canEdit ? (
        <form
          className="fxm__form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="fxm__chips" role="group" aria-label="Valeurs rapides">
            {FX_MARGIN_PRESETS.filter((p) => p <= max).map((p) => (
              <button key={p} type="button" className="fxm__chip" aria-pressed={parsed.value === p} onClick={() => { setRaw(asInput(p)); setError(null); }}>
                {p === 0 ? '0 %' : formatMargin(p)}
              </button>
            ))}
          </div>
          <div className="fxm__row">
            <Field
              id="fxm-value"
              label="Marge en %"
              inputMode="decimal"
              autoComplete="off"
              value={raw}
              onChange={(e) => { setRaw(e.target.value); setError(null); }}
              error={raw.trim() !== '' ? parsed.error : null}
              hint={`De 0 à ${max} %, 2 décimales au plus.`}
            />
            <Button type="submit" icon="check" busy={busy} disabled={!dirty}>Enregistrer</Button>
          </div>
        </form>
      ) : null}

      {ex && exMarket !== null && exClient !== null ? (
        <div className="fxm__preview" aria-live="polite">
          <p><span>Taux publié {ex.base} → {ex.quote}</span><strong>{formatRate(exMarket)}</strong></p>
          <p><span>Taux obtenu par le client</span><strong>{formatRate(exClient)}</strong></p>
          <p><span>Sur 1 000 {ex.base} envoyés, vous gagnez</span><strong>{formatRate(Math.round(1000 * value) / 100)} {ex.base}</strong></p>
        </div>
      ) : (
        <p className="fxm__sub">Fixez d’abord au moins un taux pour voir un exemple chiffré.</p>
      )}

      {error ? <Notice tone="error">{error}</Notice> : null}
      <p className="fxm__note">S’applique aux envois, dépôts et simulateurs des clients. Les transferts entre portefeuilles et les paiements de factures ne sont pas concernés. Le gain apparaît dans « Rentabilité ».</p>
    </section>
  );
}
