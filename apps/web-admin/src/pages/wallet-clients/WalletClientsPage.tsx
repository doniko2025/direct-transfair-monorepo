// apps/web-admin/src/pages/wallet-clients/WalletClientsPage.tsx
// Les clients wallet de la société (comptes de rôle USER) : une carte par client avec ses soldes,
// sa vérification d'identité et son statut. Le serveur renvoie toute la liste d'un coup :
// le web filtre en mémoire et n'affiche les cartes que par tranches.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { UserSummary } from '@direct-transfair/shared';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { SelectField } from '../../components/form';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { formatAmount, formatDate } from '../../lib/companyRules';
import { countryName } from '../../lib/countries';
import { describeError } from '../../lib/errors';
import { MOBILE_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { useResource } from '../../lib/useResource';
import { ACCOUNT_LABEL, ACCOUNT_TONE, COMPLIANCE_LABEL, COMPLIANCE_TONE, KYC_LABEL, accountState, fullName, initialsOf } from '../../lib/userRules';
import { CLIENT_TABS, clientMatches, inTab, needsReview, type ClientTab } from '../../lib/walletClientRules';

const PAGE_SIZE = 48;

function kycShort(level: UserSummary['kycLevel']): string {
  return level ? (KYC_LABEL[level] ?? level).split(' · ')[0] ?? level : 'Niveau inconnu';
}

function ClientCard({ client }: { client: UserSummary }) {
  const state = accountState(client);
  const place = [client.city, countryName(client.country)].filter(Boolean).join(', ');
  const since = formatDate(client.createdAt);
  const wallets = client.wallets ?? [];

  return (
    <li>
      <Link to={`/wallet-clients/${encodeURIComponent(client.id)}`} className="wc-card">
        <div className="wc-card__head">
          <span className="avatar wc-card__avatar" aria-hidden="true">
            {initialsOf(client)}
          </span>
          <div className="wc-card__text">
            <strong>{fullName(client)}</strong>
            <span>{client.phone ?? client.email}</span>
            {place ? <span className="wc-card__place">{place}</span> : null}
          </div>
        </div>

        {wallets.length > 0 ? (
          <ul className="wc-card__funds">
            {wallets.map((w) => (
              <li key={String(w.id)} className={w.isFrozen ? 'is-frozen' : undefined}>
                {formatAmount(w.balance, w.currency)}
                {w.isFrozen ? <small>gelé</small> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Aucun portefeuille actif.</p>
        )}

        <div className="wc-card__foot">
          <Pill tone={ACCOUNT_TONE[state]}>{ACCOUNT_LABEL[state]}</Pill>
          <Pill tone={client.kycLevel === 'LEVEL_0' || !client.kycLevel ? 'warn' : 'neutral'} icon="shield">
            {kycShort(client.kycLevel)}
          </Pill>
          {needsReview(client) && client.complianceStatus ? (
            <Pill tone={COMPLIANCE_TONE[client.complianceStatus]}>{COMPLIANCE_LABEL[client.complianceStatus]}</Pill>
          ) : null}
          {since ? <span className="wc-card__since">Inscrit le {since}</span> : null}
        </div>
      </Link>
    </li>
  );
}

export default function WalletClientsPage() {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const { data, error, loading, reload } = useResource(async () => (await api.users.list()).filter((u) => u.role === 'USER'), []);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<ClientTab>('all');
  const [country, setCountry] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const clients = data ?? [];

  const countries = useMemo(() => {
    const codes = new Set<string>();
    for (const c of clients) if (c.country) codes.add(c.country);
    return [...codes]
      .map((value) => ({ value, label: countryName(value) ?? value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [clients]);

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => clientMatches(c, q)).filter((c) => !country || c.country === country);
  }, [clients, query, country]);

  const visible = useMemo(() => scoped.filter((c) => inTab(c, tab)), [scoped, tab]);
  const counts = useMemo(
    () => Object.fromEntries(CLIENT_TABS.map((t) => [t.id, scoped.filter((c) => inTab(c, t.id)).length])) as Record<ClientTab, number>,
    [scoped],
  );

  const filtered = query.trim() !== '' || country !== '' || tab !== 'all';

  function reset() {
    setQuery('');
    setCountry('');
    setTab('all');
    setLimit(PAGE_SIZE);
  }

  return (
    <>
      <PageHeader
        title="Clients wallet"
        description="Les clients de votre société qui utilisent l'application : soldes, vérification d'identité et statut du compte."
      />

      {data && clients.length > 0 ? (
        <ul className="ag-stats" aria-label="Résumé des clients">
          <li>
            <span>Clients</span>
            <strong>{clients.length}</strong>
          </li>
          <li>
            <span>Actifs</span>
            <strong>{clients.filter((c) => accountState(c) === 'active').length}</strong>
          </li>
          <li className={clients.some(needsReview) ? 'ag-stats__warn' : undefined}>
            <span>À vérifier</span>
            <strong>{clients.filter(needsReview).length}</strong>
          </li>
        </ul>
      ) : null}

      <div className="toolbar toolbar--inline">
        <div className="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder={mobile ? 'Rechercher' : 'Nom, téléphone, email ou ville'}
            aria-label="Rechercher un client"
          />
        </div>
        <div className="toolbar__filters">
          {countries.length > 1 ? (
            <SelectField
              id="wc-country"
              label="Pays"
              className="toolbar__select"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setLimit(PAGE_SIZE);
              }}
              options={countries}
              placeholder="Tous les pays"
              compactPlaceholder="Pays"
            />
          ) : null}
          <FilterTabs
            id="wc-status"
            label="Filtrer les clients"
            value={tab}
            onChange={(next) => {
              setTab(next);
              setLimit(PAGE_SIZE);
            }}
            options={CLIENT_TABS.map((t) => ({ id: t.id, label: t.label, count: counts[t.id] }))}
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="center-block">
          <Spinner label="Chargement des clients" />
        </div>
      ) : error ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les clients"
            action={
              <button type="button" className="link-btn" onClick={reload}>
                Réessayer
              </button>
            }
          >
            {describeError(error).message}
          </Notice>
        </Card>
      ) : clients.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="wallet" size={26} />
          </span>
          <h2>Aucun client pour l'instant</h2>
          <p>Les clients apparaissent ici dès qu'ils s'inscrivent sur l'application de votre société.</p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Aucun résultat</h2>
          <p>Aucun client ne correspond à ces filtres.</p>
          {filtered ? (
            <Button variant="secondary" onClick={reset}>
              Effacer les filtres
            </Button>
          ) : null}
        </Card>
      ) : (
        <>
          <ul className="wc-grid">
            {visible.slice(0, limit).map((c) => (
              <ClientCard key={c.id} client={c} />
            ))}
          </ul>
          {visible.length > limit ? (
            <div className="more">
              <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Afficher {Math.min(PAGE_SIZE, visible.length - limit)} de plus ({visible.length - limit} restants)
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
