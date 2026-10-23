// apps/web-admin/src/pages/rates/RatesPage.tsx
// v1.1 : filtre par devise en liste déroulante sur mobile (FilterTabs), rangé sur la même ligne que « Actualiser » ; cartes plus compactes
//        (date et actions sur une seule ligne).
// Taux de change : une carte par couple de devises.
//   - Super admin : fixe les taux (le sens inverse se déduit) et consulte l'historique.
//   - Admin de société : lecture seule, pour connaître les taux appliqués à ses clients.

import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RATE_CURRENCIES, type RateCurrency, type RatePair } from '@direct-transfair/shared';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { RefreshButton } from '../../components/RefreshButton';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import {
  appliedRate,
  changeTone,
  formatChange,
  formatRate,
  inverseOf,
  lowerName,
  rateLine,
  RATE_CURRENCY_NAME,
  STATUS_VIEW,
  statusOf,
} from '../../lib/ratesRules';
import { plural, when } from '../../lib/supervisionRules';
import { useResource } from '../../lib/useResource';
import { useCurrentUser } from '../../providers/AuthProvider';
import RateEditDialog from './RateEditDialog';

type Filter = 'ALL' | RateCurrency;

function RateCard({ pair, canEdit, onEdit }: { pair: RatePair; canEdit: boolean; onEdit: (p: RatePair) => void }) {
  const status = statusOf(pair);
  const view = STATUS_VIEW[status];
  const current = appliedRate(pair);
  const change = status === 'set' ? pair.changePercent : null;

  return (
    <li className="rate-card" data-pair={pair.pair}>
      <div className="rate-card__head">
        <h2 className="rate-card__title">
          {pair.base} <span aria-hidden="true">→</span>
          <span className="sr-only"> vers </span> {pair.quote}
        </h2>
        <Pill tone={view.tone}>{view.label}</Pill>
      </div>
      <p className="rate-card__names">
        {RATE_CURRENCY_NAME[pair.base]} vers {lowerName(pair.quote)}
      </p>

      <strong className="rate-card__rate">{rateLine(pair.base, pair.quote, current)}</strong>
      <p className="rate-card__inverse">{rateLine(pair.quote, pair.base, inverseOf(current))}</p>

      {status === 'none' ? <p className="rate-card__hint">{view.hint}</p> : null}
      {status === 'derived' ? <p className="rate-card__hint">{view.hint}</p> : null}

      {pair.inverseMismatch ? (
        <p className="rate-card__alert" role="note">
          <Icon name="alert" size={16} />
          <span>
            Les deux sens sont enregistrés avec des valeurs incohérentes.
            {canEdit ? ' Enregistrez à nouveau ce taux pour les aligner.' : ''}
          </span>
        </p>
      ) : null}

      <div className="rate-card__foot">
      <div className="rate-card__meta">
        {change !== null && change !== 0 ? (
          <Pill tone={changeTone(change)}>
            {formatChange(change)}
            {pair.previousRate !== null ? ` (avant : ${formatRate(pair.previousRate)})` : ''}
          </Pill>
        ) : null}
        {pair.updatedAt ? (
          <span className="muted">
            Mis à jour {when(pair.updatedAt)}
            {pair.updatedBy ? ` par ${pair.updatedBy}` : ''}
          </span>
        ) : (
          <span className="muted">Jamais modifié</span>
        )}
      </div>

      <div className="rate-card__actions">
        {canEdit ? (
          <Button variant="secondary" icon="edit" onClick={() => onEdit(pair)}>
            {pair.rate === null || pair.derived ? 'Fixer le taux' : 'Modifier'}
          </Button>
        ) : null}
        <Link className="link" to={`/rates/${encodeURIComponent(pair.pair)}/history`}>
          Historique
        </Link>
      </div>
      </div>
    </li>
  );
}

export default function RatesPage() {
  const me = useCurrentUser();
  const canEdit = me.role === 'SUPER_ADMIN';

  const rates = useResource(() => api.rates.list(), []);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [editing, setEditing] = useState<RatePair | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const done = useCallback(
    (message: string) => {
      setEditing(null);
      setFlash(message);
      rates.reload();
    },
    [rates],
  );

  const all = useMemo(() => rates.data?.pairs ?? [], [rates.data]);
  const shown = filter === 'ALL' ? all : all.filter((p) => p.base === filter || p.quote === filter);
  const countOf = (c: Filter) => (c === 'ALL' ? all.length : all.filter((p) => p.base === c || p.quote === c).length);
  const mismatches = all.filter((p) => p.inverseMismatch).length;
  const unset = all.filter((p) => p.rate === null).length;

  return (
    <>
      <PageHeader
        title="Taux de change"
        description={
          canEdit
            ? 'Les taux appliqués à tous les clients de la plateforme. Vous fixez un sens, l’autre se calcule.'
            : 'Les taux appliqués à vos clients. Ils sont fixés par la plateforme.'
        }
        actions={
          <div className="hide-mobile">
            <Button variant="secondary" onClick={rates.reload} busy={rates.loading && rates.data !== null}>
              Actualiser
            </Button>
          </div>
        }
      />

      <div className="stack stack--tight">
        {flash ? (
          <Notice
            tone="ok"
            title={flash}
            action={
              <button type="button" className="link-btn" onClick={() => setFlash(null)}>
                Fermer
              </button>
            }
          />
        ) : null}
        {canEdit && unset > 0 ? (
          <Notice tone="info" title={`${unset} ${plural(unset, 'couple fonctionne', 'couples fonctionnent')} avec le taux de secours`}>
            Un taux de secours intégré au serveur s’applique tant qu’aucun taux n’est fixé. Fixez-les pour maîtriser vos marges.
          </Notice>
        ) : null}
        {canEdit && mismatches > 0 ? (
          <Notice tone="error" title={`${mismatches} ${plural(mismatches, 'couple incohérent', 'couples incohérents')}`}>
            Les deux sens enregistrés ne sont pas inverses l’un de l’autre : convertir dans un sens puis dans l’autre peut
            rapporter de l’argent. Réenregistrez ces taux pour les aligner.
          </Notice>
        ) : null}
      </div>

      {rates.loading && !rates.data ? (
        <div className="center-block">
          <Spinner label="Chargement des taux" />
        </div>
      ) : rates.error && !rates.data ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les taux"
            action={
              <button type="button" className="link-btn" onClick={rates.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(rates.error).message}
          </Notice>
        </Card>
      ) : (
        <>
          <div className="toolbar">
            <div className="toolbar__filters toolbar__filters--inline">
              <FilterTabs
                id="rates-currency"
                label="Filtrer par devise"
                rowOnDesktop
                value={filter}
                onChange={setFilter}
                options={(['ALL', ...RATE_CURRENCIES] as Filter[]).map((c) => ({
                  id: c,
                  label: c === 'ALL' ? 'Toutes les devises' : c,
                  count: countOf(c),
                }))}
              />
            </div>
            <RefreshButton onClick={rates.reload} busy={rates.loading && rates.data !== null} />
          </div>

          {shown.length === 0 ? (
            <Card className="empty">
              <span className="empty__icon">
                <Icon name="swap" size={26} />
              </span>
              <h2>Aucun couple de devises</h2>
              <p>Le serveur n’a renvoyé aucun taux. Actualisez la page.</p>
            </Card>
          ) : (
            <ul className="rate-grid">
              {shown.map((p) => (
                <RateCard key={p.pair} pair={p} canEdit={canEdit} onEdit={setEditing} />
              ))}
            </ul>
          )}
        </>
      )}

      {editing ? <RateEditDialog pair={editing} onClose={() => setEditing(null)} onDone={done} /> : null}
    </>
  );
}
