// src/pages/transactions/TransactionsPage.tsx
// Historique des transactions : une carte par opération.
//   - super admin : toute la plateforme ; admin de société : sa société (filtré par le serveur) ;
//   - agent : ses propres opérations (envois, dépôts, retraits payés, recharges de caisse).
// Le serveur renvoie toute la liste d'un coup : le web filtre en mémoire et n'affiche les cartes par tranches.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Transaction } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { SelectField } from '../../components/form';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import {
  PERIODS,
  STATUS_TABS,
  TYPE_LABEL,
  inPeriod,
  searchHaystack,
  statusLabel,
  statusTone,
  viewFor,
  volumeByCurrency,
  type Period,
  type StatusTab,
} from '../../lib/transactionRules';
import { useResource } from '../../lib/useResource';
import { useCurrentUser } from '../../providers/AuthProvider';

const PAGE_SIZE = 48;

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function TxCard({ tx, viewer, showCompany }: { tx: Transaction; viewer: { id: string | number; role: string }; showCompany: boolean }) {
  const view = viewFor(tx, viewer);
  const company = showCompany ? tx.client?.name : null;

  return (
    <li>
      <Link
        to={`/transactions/${encodeURIComponent(tx.id)}`}
        className="tx-card"
        aria-label={`${view.title}, ${view.amount}, ${statusLabel(tx.status)}`}
      >
        <span className={`tx-card__icon tx-card__icon--${view.flow}`} aria-hidden="true">
          <Icon name={view.icon} size={20} />
        </span>
        <div className="tx-card__text">
          <strong>{view.title}</strong>
          <span className="tx-card__sub">{view.subtitle}</span>
          {company ? <span className="tx-card__company">{company}</span> : null}
        </div>
        <div className="tx-card__amount">
          <strong className={`tx-amount tx-amount--${view.flow}`}>
            {view.flow === 'in' ? '+ ' : view.flow === 'out' ? '− ' : ''}
            {view.amount}
          </strong>
          {view.amountNote ? <span>{view.amountNote}</span> : null}
        </div>
        <div className="tx-card__foot">
          <Pill tone={statusTone(tx.status)}>{statusLabel(tx.status)}</Pill>
          {tx.isFlagged ? (
            <Pill tone="danger" icon="alert">
              Signalée
            </Pill>
          ) : null}
          <span className="tx-card__meta">
            <time dateTime={tx.createdAt}>{shortDate(tx.createdAt)}</time>
            <span className="tx-card__ref">{tx.reference}</span>
          </span>
        </div>
      </Link>
    </li>
  );
}

export default function TransactionsPage() {
  const me = useCurrentUser();
  const isSuper = me.role === 'SUPER_ADMIN';
  const isAgent = me.role === 'AGENT';

  const { data, error, loading, reload } = useResource(
    () => (isAgent ? api.transactions.listMine() : api.transactions.listAdmin()),
    [isAgent],
  );

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<StatusTab>('all');
  const [type, setType] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [company, setCompany] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const all = data ?? [];

  const types = useMemo(() => {
    const seen = new Set(all.map((t) => t.type));
    return [...seen]
      .map((value) => ({ value, label: TYPE_LABEL[value] ?? value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [all]);

  const companies = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of all) if (t.client?.code) seen.set(t.client.code, t.client.name);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr')).map(([value, label]) => ({ value, label }));
  }, [all]);

  // Les compteurs d'onglets tiennent compte de tous les filtres sauf l'onglet lui-même.
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = new Date();
    return all
      .filter((t) => !q || searchHaystack(t).includes(q))
      .filter((t) => !type || t.type === type)
      .filter((t) => !company || t.client?.code === company)
      .filter((t) => !flaggedOnly || t.isFlagged)
      .filter((t) => inPeriod(t.createdAt, period, now));
  }, [all, query, type, company, flaggedOnly, period]);

  const tabCounts = useMemo(
    () =>
      Object.fromEntries(
        STATUS_TABS.map((t) => [t.id, t.statuses ? scoped.filter((x) => t.statuses!.includes(x.status)).length : scoped.length]),
      ) as Record<StatusTab, number>,
    [scoped],
  );

  const visible = useMemo(() => {
    const def = STATUS_TABS.find((t) => t.id === tab);
    return def?.statuses ? scoped.filter((x) => def.statuses!.includes(x.status)) : scoped;
  }, [scoped, tab]);

  const volume = useMemo(() => volumeByCurrency(visible.filter((t) => t.status !== 'CANCELLED' && t.status !== 'FAILED')), [visible]);

  const filtered = query.trim() !== '' || type !== '' || company !== '' || period !== 'all' || flaggedOnly || tab !== 'all';

  function resetPaging() {
    setLimit(PAGE_SIZE);
  }

  function clearFilters() {
    setQuery('');
    setType('');
    setCompany('');
    setPeriod('all');
    setFlaggedOnly(false);
    setTab('all');
    resetPaging();
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        description={
          isSuper
            ? 'Toutes les opérations de la plateforme, de la plus récente à la plus ancienne.'
            : isAgent
              ? 'Vos envois, dépôts, retraits payés et recharges de caisse.'
              : 'Toutes les opérations de votre société, de la plus récente à la plus ancienne.'
        }
        actions={
          <Button variant="secondary" onClick={reload} busy={loading && data !== null}>
            Actualiser
          </Button>
        }
      />

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPaging();
            }}
            placeholder="Référence, expéditeur, bénéficiaire ou téléphone"
            aria-label="Rechercher une transaction"
          />
        </div>
        <SelectField
          id="tx-period"
          label="Période"
          className="toolbar__select"
          value={period === 'all' ? '' : period}
          onChange={(e) => {
            setPeriod((e.target.value || 'all') as Period);
            resetPaging();
          }}
          options={PERIODS}
          placeholder="Toute la période"
        />
        {types.length > 1 ? (
          <SelectField
            id="tx-type"
            label="Type d’opération"
            className="toolbar__select"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              resetPaging();
            }}
            options={types}
            placeholder="Tous les types"
          />
        ) : null}
        {isSuper && companies.length > 1 ? (
          <SelectField
            id="tx-company"
            label="Société"
            className="toolbar__select"
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
              resetPaging();
            }}
            options={companies}
            placeholder="Toutes les sociétés"
          />
        ) : null}
        {!isAgent ? (
          <button
            type="button"
            className="tab tab--toggle"
            aria-pressed={flaggedOnly}
            onClick={() => {
              setFlaggedOnly((v) => !v);
              resetPaging();
            }}
          >
            Signalées
          </button>
        ) : null}
      </div>

      <div className="tabs tabs--row" role="group" aria-label="Filtrer par statut">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="tab"
            aria-pressed={tab === t.id}
            onClick={() => {
              setTab(t.id);
              resetPaging();
            }}
          >
            {t.label}
            <span>{tabCounts[t.id]}</span>
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="center-block">
          <Spinner label="Chargement des transactions" />
        </div>
      ) : error && !data ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les transactions"
            action={
              <button type="button" className="link-btn" onClick={reload}>
                Réessayer
              </button>
            }
          >
            {describeError(error).message}
          </Notice>
        </Card>
      ) : all.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="list" size={26} />
          </span>
          <h2>Aucune transaction pour l'instant</h2>
          <p>Les opérations apparaissent ici dès qu'un transfert, un dépôt ou un retrait est effectué.</p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Aucun résultat</h2>
          <p>Aucune transaction ne correspond à ces filtres.</p>
          {filtered ? (
            <Button variant="secondary" onClick={clearFilters}>
              Effacer les filtres
            </Button>
          ) : null}
        </Card>
      ) : (
        <>
          {error ? (
            <div className="stack stack--tight">
              <Notice tone="error" title="L'actualisation a échoué">
                {describeError(error).message} Les données affichées peuvent être anciennes.
              </Notice>
            </div>
          ) : null}
          <p className="tx-summary" aria-live="polite">
            <strong>
              {visible.length} transaction{visible.length > 1 ? 's' : ''}
            </strong>
            {!isAgent && volume.length > 0 ? <span className="muted"> · Cumul hors annulées et échouées : {volume.join(' · ')}</span> : null}
          </p>
          <ul className="tx-grid">
            {visible.slice(0, limit).map((t) => (
              <TxCard key={t.id} tx={t} viewer={me} showCompany={isSuper} />
            ))}
          </ul>
          {visible.length > limit ? (
            <div className="more">
              <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Afficher {Math.min(PAGE_SIZE, visible.length - limit)} de plus ({visible.length - limit} restantes)
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
