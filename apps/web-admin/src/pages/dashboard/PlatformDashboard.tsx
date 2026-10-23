// apps/web-admin/src/pages/dashboard/PlatformDashboard.tsx
// Tableau de bord du super administrateur : sociétés, activité de toute la plateforme,
// opérations à traiter, paiements B2B en attente.

import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Pill } from '../../components/ui';
import { api } from '../../lib/api';
import { isActiveStatus } from '../../lib/companyRules';
import { needsAttention, newestFirst, todaySummary } from '../../lib/dashboardRules';
import { useCurrentUser } from '../../providers/AuthProvider';
import { useResource } from '../../lib/useResource';
import { CompaniesOverview } from './CompaniesOverview';
import { DashHero } from './DashHero';
import { KpiCard, KpiGrid, NotificationsPeek, Panel, PanelState, TxRows } from './parts';

export function PlatformDashboard() {
  const user = useCurrentUser();
  const txs = useResource(() => api.transactions.listAdmin(), []);
  const companies = useResource(() => api.companies.list(), []);

  const all = txs.data ?? [];
  const today = todaySummary(all);
  const attention = newestFirst(all.filter(needsAttention));
  const b2b = all.filter((t) => t.type === 'SERVICE_PAYMENT' && t.status === 'PENDING').length;
  const recent = newestFirst(all).slice(0, 6);

  const list = companies.data ?? [];
  const active = list.filter((c) => isActiveStatus(c.subscriptionStatus)).length;

  return (
    <div className="dash">
      <DashHero
        context="Vous pilotez la plateforme : sociétés de transfert, taux de change, frais et supervision."
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
          icon="swap"
          label="Aujourd'hui"
          to="/transactions"
          loading={txs.loading && !txs.data}
          value={txs.error ? '—' : String(today.count)}
          note={txs.error ? 'Indisponible' : today.volume.length > 0 ? today.volume.slice(0, 2).join(' · ') : 'Aucun envoi'}
        />
        <KpiCard
          icon="alert"
          label="À traiter"
          to="/transactions"
          tone={attention.length > 0 ? 'warn' : 'ok'}
          loading={txs.loading && !txs.data}
          value={txs.error ? '—' : String(attention.length)}
          note={txs.error ? 'Indisponible' : attention.length > 0 ? 'En attente ou bloquées' : 'Rien en attente'}
        />
        <KpiCard
          icon="vault"
          label="Paiements B2B"
          to="/treasury"
          tone={b2b > 0 ? 'warn' : 'default'}
          loading={txs.loading && !txs.data}
          value={txs.error ? '—' : String(b2b)}
          note={txs.error ? 'Indisponible' : b2b > 0 ? 'À valider' : 'Aucun en attente'}
        />
      </KpiGrid>

      <div className="dash-cols">
        <div className="dash-stack">
          {attention.length > 0 ? (
            <Panel title="À traiter" to="/transactions" badge={<Pill tone="warn">{attention.length}</Pill>}>
              <TxRows txs={attention.slice(0, 5)} viewer={user} />
            </Panel>
          ) : null}

          <Panel title="Activité récente" to="/transactions">
            <PanelState res={txs} what="les transactions" empty={{ when: (d) => d.length === 0, text: "Aucune transaction pour l'instant." }}>
              {() => <TxRows txs={recent} viewer={user} />}
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
