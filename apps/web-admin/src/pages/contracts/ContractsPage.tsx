// apps/web-admin/src/pages/contracts/ContractsPage.tsx
// Espace du Grand Chef (SUPER_ADMIN) : les contrats de toutes les sociétés — signés, en attente, expirés. Une carte par contrat,
// recherche et filtre par statut. ?clientId= restreint la liste à une société.

import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ContractStatus, ContractSummary } from '@direct-transfair/shared';
import { FilterTabs } from '../../components/FilterTabs';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, PageHeader, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { MOBILE_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { useResource } from '../../lib/useResource';
import { ContractCard } from './ContractCard';

type Filter = 'all' | 'SIGNED' | 'PENDING' | 'other';

const isOther = (s: ContractStatus) => s === 'EXPIRED' || s === 'CANCELLED';

function matches(c: ContractSummary, q: string): boolean {
  if (!q) return true;
  return [c.client.name, c.client.code, c.reference, c.recipientEmail, c.signerName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q);
}

export default function ContractsPage() {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [params, setParams] = useSearchParams();
  const clientId = Number(params.get('clientId')) || undefined;

  const { data, error, loading, reload } = useResource(() => api.contracts.list({ clientId }), [clientId]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const contracts = data ?? [];
  const counts = useMemo(
    () => ({
      all: contracts.length,
      SIGNED: contracts.filter((c) => c.status === 'SIGNED').length,
      PENDING: contracts.filter((c) => c.status === 'PENDING').length,
      other: contracts.filter((c) => isOther(c.status)).length,
    }),
    [contracts],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contracts
      .filter((c) => matches(c, q))
      .filter((c) => (filter === 'all' ? true : filter === 'other' ? isOther(c.status) : c.status === filter));
  }, [contracts, query, filter]);

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'Tous', count: counts.all },
    { id: 'SIGNED', label: 'Signés', count: counts.SIGNED },
    { id: 'PENDING', label: 'En attente', count: counts.PENDING },
    { id: 'other', label: 'Expirés ou annulés', count: counts.other },
  ];

  return (
    <>
      <PageHeader
        title="Contrats"
        description="Les contrats de location et d'achat de chaque société, avec leur signature électronique. Ouvrez un contrat pour le télécharger en PDF."
        actions={
          <Link to="/companies" className="btn btn--secondary">
            <Icon name="building" size={18} />
            <span>Sociétés</span>
          </Link>
        }
      />

      {clientId ? (
        <div className="stack stack--tight">
          <Notice
            tone="info"
            action={
              <button type="button" className="link-btn" onClick={() => setParams({})}>
                Voir les contrats de toutes les sociétés
              </button>
            }
          >
            Contrats d'une seule société.
          </Notice>
        </div>
      ) : null}

      <div className="toolbar toolbar--inline">
        <div className="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mobile ? 'Rechercher' : 'Rechercher par société, référence ou signataire'}
            aria-label="Rechercher un contrat"
          />
        </div>
        <div className="toolbar__filters">
          <FilterTabs id="contracts-status" label="Filtrer par statut" value={filter} onChange={setFilter} options={tabs} />
        </div>
      </div>

      {loading && !data ? (
        <div className="center-block">
          <Spinner label="Chargement des contrats" />
        </div>
      ) : error ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les contrats"
            action={
              <button type="button" className="link-btn" onClick={reload}>
                Réessayer
              </button>
            }
          >
            {describeError(error).message}
          </Notice>
        </Card>
      ) : contracts.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="file" size={26} />
          </span>
          <h2>Aucun contrat pour l'instant</h2>
          <p>
            Un contrat est émis automatiquement à la création d'une société. Pour une société existante, ouvrez sa fiche puis
            choisissez « Émettre un contrat ».
          </p>
          <Link to="/companies" className="btn btn--primary">
            <Icon name="building" size={18} />
            <span>Voir les sociétés</span>
          </Link>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Aucun résultat</h2>
          <p>Aucun contrat ne correspond à cette recherche.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
          >
            Effacer les filtres
          </Button>
        </Card>
      ) : (
        <ul className="contract-grid">
          {visible.map((c) => (
            <ContractCard key={c.id} contract={c} />
          ))}
        </ul>
      )}
    </>
  );
}
