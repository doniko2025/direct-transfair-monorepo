// apps/web-admin/src/pages/rates/RatesPage.tsx
// v2.0 : TAUX PAR SOCIÉTÉ. Chaque société fixe ses propres taux, indépendamment des autres.
//   - Admin de société : fixe SES taux (le sens inverse se déduit) et consulte leur historique.
//   - Super admin : LECTURE SEULE — il choisit une société et consulte ses taux, sans jamais en modifier.
// v1.1 : filtre par devise en liste déroulante sur mobile (FilterTabs), rangé sur la même ligne que « Actualiser » ; cartes plus compactes
//        (date et actions sur une seule ligne).
// Taux de change : une carte par couple de devises.

import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RATE_CURRENCIES, type RateCurrency, type RatePair } from '@direct-transfair/shared';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { SelectField } from '../../components/form';
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

function RateCard({ pair, canEdit, onEdit, historyTo }: { pair: RatePair; canEdit: boolean; onEdit: (p: RatePair) => void; historyTo: string }) {
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

      <strong className="rate-card__rate">{current === null ? 'Non configuré' : rateLine(pair.base, pair.quote, current)}</strong>
      {current !== null ? <p className="rate-card__inverse">{rateLine(pair.quote, pair.base, inverseOf(current))}</p> : null}

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
        <Link className="link" to={historyTo}>
          Historique
        </Link>
      </div>
      </div>
    </li>
  );
}

export default function RatesPage() {
  const me = useCurrentUser();
  const isSuper = me.role === 'SUPER_ADMIN';
  const canEdit = !isSuper; // le super admin consulte seulement : chaque société fixe ses taux

  // Super admin : société consultée (portée par l'adresse pour garder le choix en revenant de l'historique)
  const [search, setSearch] = useSearchParams();
  const companies = useResource(async () => (isSuper ? (await api.fees.companies()).companies : []), [isSuper]);
  const pickedId = Number(search.get('clientId')) || undefined;
  const clientId = isSuper ? (pickedId ?? companies.data?.[0]?.id ?? undefined) : undefined;
  const skip = isSuper && !clientId;
  const companyName = (companies.data ?? []).find((c) => c.id === clientId)?.name;

  const rates = useResource(async () => (skip ? { pairs: [] as RatePair[] } : api.rates.list(clientId)), [clientId, skip]);
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
            ? 'Les taux appliqués aux clients de votre société, indépendamment des autres sociétés. Vous fixez un sens, l’autre se calcule.'
            : `Taux fixés par ${companyName ?? 'la société choisie'} pour ses clients (lecture seule).`
        }
        actions={
          <div className="hide-mobile">
            <Button variant="secondary" onClick={rates.reload} busy={rates.loading && rates.data !== null}>
              Actualiser
            </Button>
          </div>
        }
      />

      {isSuper ? (
        <div className="toolbar toolbar--inline">
          <SelectField
            id="rates-company"
            label="Société"
            className="toolbar__select"
            value={clientId ? String(clientId) : ''}
            onChange={(e) => setSearch(e.target.value ? { clientId: e.target.value } : {}, { replace: true })}
            options={(companies.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
          />
          <Notice tone="info">Chaque société fixe librement ses taux : vous les consultez ici sans pouvoir les modifier.</Notice>
        </div>
      ) : null}

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
          <Notice tone="error" title={`${unset} ${plural(unset, 'couple sans taux', 'couples sans taux')} : conversions refusées`}>
            Aucun taux n’est intégré au serveur : tant qu’un couple n’est pas fixé par votre société, tout envoi ou dépôt qui en
            dépend est refusé. Fixez ces taux avant la mise en service.
          </Notice>
        ) : null}
        {canEdit && mismatches > 0 ? (
          <Notice tone="error" title={`${mismatches} ${plural(mismatches, 'couple incohérent', 'couples incohérents')}`}>
            Les deux sens enregistrés ne sont pas inverses l’un de l’autre : convertir dans un sens puis dans l’autre peut
            rapporter de l’argent. Réenregistrez ces taux pour les aligner.
          </Notice>
        ) : null}
      </div>

      {(rates.loading && !rates.data) || (isSuper && companies.loading && !companies.data) ? (
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
              <p>{skip ? 'Aucune société n’est encore créée.' : 'Le serveur n’a renvoyé aucun taux. Actualisez la page.'}</p>
            </Card>
          ) : (
            <ul className="rate-grid">
              {shown.map((p) => (
                <RateCard
                  key={p.pair}
                  pair={p}
                  canEdit={canEdit}
                  onEdit={setEditing}
                  historyTo={`/rates/${encodeURIComponent(p.pair)}/history${clientId ? `?clientId=${clientId}` : ''}`}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {editing ? <RateEditDialog pair={editing} onClose={() => setEditing(null)} onDone={done} /> : null}
    </>
  );
}
