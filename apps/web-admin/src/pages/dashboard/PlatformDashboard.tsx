// apps/web-admin/src/pages/dashboard/PlatformDashboard.tsx
// Tableau de bord du super administrateur : sociétés, activité de toute la plateforme,
// opérations à traiter, paiements B2B en attente.

import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Pill } from '../../components/ui';
import { api } from '../../lib/api';
import { isActiveStatus } from '../../lib/companyRules';
import { newestFirst } from '../../lib/dashboardRules';
import { useCurrentUser } from '../../providers/AuthProvider';
import { useResource } from '../../lib/useResource';
import { CompaniesOverview } from './CompaniesOverview';
import { DashHero } from './DashHero';
import { KpiCard, KpiGrid, NotificationsPeek, Panel, PanelState, TxRows } from './parts';

// v2 : tableau de bord SIMPLE — les sociétés et les virements qu'elles lui versent. Plus d'activité ni de transactions des sociétés.
export function PlatformDashboard() {
  const user = useCurrentUser();
  // Pour le super admin, le serveur ne renvoie que les virements des sociétés (paiements B2B).
  const txs = useResource(() => api.transactions.listAdmin(), []);
  const companies = useResource(() => api.companies.list(), []);

  const transfers = newestFirst(txs.data ?? []);
  const pending = transfers.filter((t) => t.status === 'PENDING');

  const list = companies.data ?? [];
  const active = list.filter((c) => isActiveStatus(c.subscriptionStatus)).length;

  return (
    <div className="dash">
      <DashHero
        context="Vous pilotez la plateforme : vos sociétés de transfert, leurs administrateurs et les virements qu'elles vous versent."
        extraPill="Portail plateforme"
        actions={
          <Link to="/companies/new" className="btn btn--primary">
            <Icon name="plus" size={18} />
            <span>Nouvelle société</span>
          </Link>
        }
      />

      <KpiGrid label="Indicateurs">
        <KpiCard
          icon="building"
          label="Sociétés"
          to="/companies"
          loading={companies.loading && !companies.data}
          value={companies.error ? '—' : String(list.length)}
          note={companies.error ? 'Indisponible' : `${active} active${active > 1 ? 's' : ''}`}
        />
        <KpiCard
          icon="vault"
          label="Virements à valider"
          to="/treasury"
          tone={pending.length > 0 ? 'warn' : 'default'}
          loading={txs.loading && !txs.data}
          value={txs.error ? '—' : String(pending.length)}
          note={txs.error ? 'Indisponible' : pending.length > 0 ? 'En attente de votre décision' : 'Aucun en attente'}
        />
      </KpiGrid>

      <div className="dash-cols">
        <div className="dash-stack">
          {pending.length > 0 ? (
            <Panel title="Virements à valider" to="/treasury" badge={<Pill tone="warn">{pending.length}</Pill>}>
              <TxRows txs={pending.slice(0, 5)} viewer={user} />
            </Panel>
          ) : null}

          <Panel title="Derniers virements" to="/treasury">
            <PanelState res={txs} what="les virements" empty={{ when: (d) => d.length === 0, text: "Aucun virement pour l'instant." }}>
              {() => <TxRows txs={transfers.slice(0, 6)} viewer={user} />}
            </PanelState>
          </Panel>
        </div>

        <div className="dash-stack">
          <CompaniesOverview />
          <NotificationsPeek />
        </div>
      </div>
    </div>
  );
}
