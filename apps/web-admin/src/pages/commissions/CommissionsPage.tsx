// src/pages/commissions/CommissionsPage.tsx
// Commissions gagnées, d'après les écritures réellement créditées.
// Admin de société : la part de la société et celle de chaque agence. Agent : ses propres commissions.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CommissionEntry, CommissionPeriod, CompanyCommissionEntry, CurrencyTotal } from '@direct-transfair/shared';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { RefreshButton } from '../../components/RefreshButton';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { countLabel, entryTitle, PERIODS, periodPhrase, sortTotals } from '../../lib/commissionRules';
import { describeError } from '../../lib/errors';
import { money } from '../../lib/feeScheduleRules';
import { fullDate, when } from '../../lib/supervisionRules';
import { useKeyedResource } from '../../lib/useResource';
import { useCurrentUser } from '../../providers/AuthProvider';

const FIRST = 12;
const STEP = 12;

function Totals({ totals, empty }: { totals: readonly CurrencyTotal[]; empty: string }) {
  if (totals.length === 0) return <p className="com-total__none">{empty}</p>;
  return (
    <ul className="com-total__list">
      {sortTotals(totals).map((t) => (
        <li key={t.currency}>
          <strong data-testid={`total-${t.currency}`}>{money(t.total, t.currency)}</strong>
        </li>
      ))}
    </ul>
  );
}

function Entry({ e, scope }: { e: CommissionEntry | CompanyCommissionEntry; scope?: 'platform' | 'agency' }) {
  return (
    <li className="com-entry" data-entry={e.id}>
      <div className="com-entry__amount">
        <strong>+ {money(e.amount, e.currency)}</strong>
        {scope ? <Pill tone={scope === 'platform' ? 'brand' : 'neutral'}>{scope === 'platform' ? 'Société' : 'Agence'}</Pill> : null}
      </div>
      <div className="com-entry__main">
        <p className="com-entry__title">{entryTitle(e.description)}</p>
        <p className="com-entry__meta">
          <span>{e.origin}</span>
          {e.grossFees !== null ? <span>Frais de l’envoi : {money(e.grossFees, e.currency)}</span> : null}
          {e.grossAmount !== null ? <span>Montant : {money(e.grossAmount, e.currency)}</span> : null}
        </p>
      </div>
      <div className="com-entry__side">
        <time dateTime={e.createdAt} title={fullDate(e.createdAt)}>
          {when(e.createdAt)}
        </time>
        {e.transactionId ? (
          <Link to={`/transactions/${encodeURIComponent(e.transactionId)}`} className="com-entry__link">
            {e.transactionRef ?? 'Voir l’opération'}
            <Icon name="chevronRight" size={14} />
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export default function CommissionsPage() {
  const me = useCurrentUser();
  const isAgent = me.role === 'AGENT';
  const [period, setPeriod] = useState<CommissionPeriod>('month');
  const [limit, setLimit] = useState(FIRST);

  const company = useKeyedResource(`company:${period}`, async () => (isAgent ? null : api.commissions.company(period)), [isAgent]);
  const mine = useKeyedResource(`mine:${period}`, async () => (isAgent ? api.commissions.mine(period) : null), [isAgent]);
  const res = isAgent ? mine : company;

  const entries: (CommissionEntry | CompanyCommissionEntry)[] = useMemo(
    () => (isAgent ? (mine.data?.entries ?? []) : (company.data?.entries ?? [])),
    [isAgent, mine.data, company.data],
  );
  const shown = entries.slice(0, limit);
  const data = isAgent ? mine.data : company.data;

  function pick(p: CommissionPeriod) {
    setPeriod(p);
    setLimit(FIRST);
  }

  return (
    <>
      <PageHeader
        title="Commissions"
        description={
          isAgent
            ? 'Ce que votre agence a gagné sur les envois et les retraits, d’après les écritures de votre caisse.'
            : 'Ce qui a été crédité à la société et à chaque agence sur les envois et les retraits payés.'
        }
        actions={
          <Button variant="secondary" className="hide-mobile" onClick={res.reload} busy={res.loading && data !== null}>
            Actualiser
          </Button>
        }
      />

      <div className="toolbar">
        <div className="toolbar__filters toolbar__filters--inline">
          <FilterTabs
            id="com-period"
            label="Période"
            value={period}
            onChange={pick}
            options={PERIODS.map((p) => ({ id: p.id, label: p.label }))}
          />
        </div>
        <RefreshButton onClick={res.reload} busy={res.loading && data !== null} />
      </div>

      {res.loading && !data ? (
        <div className="center-block">
          <Spinner label="Chargement des commissions" />
        </div>
      ) : res.error && !data ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les commissions"
            action={
              <button type="button" className="link-btn" onClick={res.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(res.error).message}
          </Notice>
        </Card>
      ) : (
        <div className="tr-stack">
          <section aria-labelledby="com-totals" className="tr-section">
            <div className="tr-section__head">
              <h2 id="com-totals">Gagné {periodPhrase(period)}</h2>
              <p>Le total par devise, sans conversion : chaque devise est comptée séparément.</p>
            </div>
            {isAgent && mine.data ? (
              <div className="com-total-grid">
                <article className="com-total" data-scope="mine">
                  <h3>Mes commissions</h3>
                  <Totals totals={mine.data.totalsByCurrency} empty="Aucune commission sur cette période." />
                  <p className="com-total__count">{countLabel(mine.data.count)}</p>
                </article>
              </div>
            ) : company.data ? (
              <ul className="com-total-grid">
                <li className="com-total com-total--company" data-scope="platform">
                  <h3>Part de la société</h3>
                  <Totals totals={company.data.platform.totalsByCurrency} empty="Aucune commission sur cette période." />
                  <p className="com-total__count">{countLabel(company.data.platform.count)}</p>
                </li>
                {company.data.agencies.map((a) => (
                  <li key={a.agencyId} className="com-total" data-agency={a.agencyId}>
                    <h3>{a.name}</h3>
                    <Totals totals={a.totalsByCurrency} empty="Aucune commission sur cette période." />
                    <p className="com-total__count">{countLabel(a.count)}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section aria-labelledby="com-entries" className="tr-section">
            <div className="tr-section__head">
              <h2 id="com-entries">Détail</h2>
              <p>Chaque commission est liée à l’opération qui l’a générée.</p>
            </div>
            {entries.length === 0 ? (
              <Card className="empty empty--compact">
                <span className="empty__icon">
                  <Icon name="percent" size={26} />
                </span>
                <h3>Aucune commission {periodPhrase(period)}</h3>
                <p>
                  {isAgent
                    ? 'Vos commissions apparaîtront ici dès qu’un retrait ou un envoi en rapporte une.'
                    : 'Les commissions apparaîtront ici dès qu’un retrait payé en agence en génère.'}
                </p>
              </Card>
            ) : (
              <>
                <ul className="com-list">
                  {shown.map((e) => (
                    <Entry key={e.id} e={e} scope={'scope' in e ? e.scope : undefined} />
                  ))}
                </ul>
                {entries.length > shown.length ? (
                  <div className="more">
                    <Button variant="secondary" onClick={() => setLimit((n) => n + STEP)}>
                      Voir plus ({entries.length - shown.length} restantes)
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
