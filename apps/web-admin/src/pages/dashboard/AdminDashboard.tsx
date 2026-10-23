// apps/web-admin/src/pages/dashboard/AdminDashboard.tsx
// Tableau de bord de l'administrateur de société : trésorerie, activité du jour, opérations à traiter,
// réseau d'agences, commissions du mois. Chaque bloc se charge seul : une panne sur un bloc n'efface pas les autres.

import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Pill } from '../../components/ui';
import { api } from '../../lib/api';
import { agentName, managerOf } from '../../lib/agencyRules';
import { formatAmount } from '../../lib/companyRules';
import { amountsLabel, needsAttention, newestFirst, todaySummary } from '../../lib/dashboardRules';
import { useCurrentUser } from '../../providers/AuthProvider';
import { useTenant } from '../../providers/TenantProvider';
import { useResource } from '../../lib/useResource';
import { DashHero } from './DashHero';
import { KpiCard, KpiGrid, NotificationsPeek, Panel, PanelState, TxRows } from './parts';

export function AdminDashboard() {
  const user = useCurrentUser();
  const { branding } = useTenant();
  const company = user.client?.name ?? branding.name;

  const txs = useResource(() => api.transactions.listAdmin(), []);
  const agencies = useResource(() => api.agencies.list(), []);
  const agents = useResource(() => api.agents.list(), []);
  const clients = useResource(async () => (await api.users.list()).filter((u) => u.role === 'USER').length, []);
  const overview = useResource(() => api.treasury.overview(), []);
  const commissions = useResource(() => api.commissions.company('month', { limit: 1 }), []);

  const all = txs.data ?? [];
  const today = todaySummary(all);
  const attention = newestFirst(all.filter(needsAttention));
  const recent = newestFirst(all).slice(0, 6);

  const activeAgencies = (agencies.data ?? []).filter((a) => a.isActive);
  const withoutManager = activeAgencies.filter((a) => !a.managerId).length;

  // Trésorerie : les devises qui ont des fonds, la plus fournie en tête.
  const funds = [...(overview.data ?? [])].filter((o) => o.balance !== 0).sort((a, b) => b.balance - a.balance);
  const mainFund = funds[0];

  return (
    <div className="dash">
      <DashHero
        context={`Vous gérez ${company} : agences, agents, clients wallet et trésorerie.`}
        actions={
          <>
            <Link to="/agencies/new" className="btn btn--primary">
              <Icon name="plus" size={18} />
              <span>Nouvelle agence</span>
            </Link>
            <Link to="/agents/new" className="btn btn--secondary">
              <Icon name="plus" size={18} />
              <span>Nouvel agent</span>
            </Link>
          </>
        }
      />

      <KpiGrid label="Indicateurs">
        <KpiCard
          icon="vault"
          label="Trésorerie"
          to="/treasury"
          loading={overview.loading && !overview.data}
          value={mainFund ? formatAmount(mainFund.availableBalance, mainFund.currency) : '—'}
          note={
            overview.error
              ? 'Indisponible'
              : funds.length > 1
                ? `+ ${funds
                    .slice(1, 3)
                    .map((f) => formatAmount(f.availableBalance, f.currency))
                    .join(' · ')}`
                : mainFund
                  ? 'Disponible'
                  : 'Aucun fonds'
          }
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
          icon="building"
          label="Réseau"
          to="/agencies"
          tone={withoutManager > 0 ? 'warn' : 'default'}
          loading={(agencies.loading && !agencies.data) || (agents.loading && !agents.data)}
          value={agencies.error ? '—' : `${activeAgencies.length} agence${activeAgencies.length > 1 ? 's' : ''}`}
          note={
            agencies.error
              ? 'Indisponible'
              : [
                  agents.data ? `${agents.data.length} agent${agents.data.length > 1 ? 's' : ''}` : null,
                  clients.data != null ? `${clients.data} client${clients.data > 1 ? 's' : ''}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || ' '
          }
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
          <Panel title="Agences" to="/agencies">
            <PanelState
              res={agencies}
              what="les agences"
              empty={{
                when: (d) => d.length === 0,
                text: (
                  <>
                    Aucune agence pour l'instant.{' '}
                    <Link to="/agencies/new" className="link-btn">
                      Créer la première
                    </Link>
                  </>
                ),
              }}
            >
              {(list) => (
                <ul className="dash-agencies">
                  {list
                    .filter((a) => a.isActive)
                    .slice(0, 5)
                    .map((a) => {
                      const manager = managerOf(a);
                      return (
                        <li key={a.id}>
                          <Link to={`/agencies/${encodeURIComponent(a.id)}`} className="dash-agencies__row">
                            <span className="dash-agencies__icon" aria-hidden="true">
                              <Icon name="building" size={18} />
                            </span>
                            <span className="dash-agencies__main">
                              <strong>{a.name}</strong>
                              <span>{manager ? agentName(manager) : 'Aucun responsable'}</span>
                            </span>
                            <span className="dash-agencies__cash">
                              {a.wallets && a.wallets.length > 0 ? (
                                a.wallets.slice(0, 2).map((w) => <strong key={w.id}>{formatAmount(w.balance, w.currency)}</strong>)
                              ) : (
                                <small>Pas de caisse</small>
                              )}
                              {!a.managerId ? <Pill tone="warn">Sans responsable</Pill> : null}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              )}
            </PanelState>
          </Panel>

          <Panel title="Commissions du mois" to="/commissions">
            <PanelState res={commissions} what="les commissions">
              {(c) => {
                const lines = amountsLabel(c.platform.totalsByCurrency);
                return lines.length === 0 ? (
                  <p className="muted dash-empty">Aucune commission ce mois-ci.</p>
                ) : (
                  <div className="dash-big">
                    {lines.map((l) => (
                      <strong key={l}>{l}</strong>
                    ))}
                    <small>
                      {c.platform.count} opération{c.platform.count > 1 ? 's' : ''} commissionnée{c.platform.count > 1 ? 's' : ''}
                    </small>
                  </div>
                );
              }}
            </PanelState>
          </Panel>

          <NotificationsPeek />
        </div>
      </div>
    </div>
  );
}
