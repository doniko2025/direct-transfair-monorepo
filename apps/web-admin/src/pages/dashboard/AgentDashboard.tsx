// apps/web-admin/src/pages/dashboard/AgentDashboard.tsx
// Tableau de bord de l'agent : caisse de l'agence (dans le bandeau d'accueil), opérations du guichet,
// dernières opérations et commissions du mois. Les statistiques du jour et la remise sont dans le menu (/stats, /remit).

import { Icon, type IconName } from '../../components/Icon';
import { Link } from 'react-router-dom';
import { Pill } from '../../components/ui';
import { api } from '../../lib/api';
import { amountsLabel, newestFirst } from '../../lib/dashboardRules';
import { useCurrentUser } from '../../providers/AuthProvider';
import { useResource } from '../../lib/useResource';
import { CashBox } from '../desk/CashBox';
import { useDesk } from '../desk/useDesk';
import { DashHero } from './DashHero';
import { Panel, PanelState, TxRows } from './parts';

type Kind = 'in' | 'out' | 'send';

const ACTIONS: readonly { to: string; label: string; hint: string; icon: IconName; kind: Kind }[] = [
  { to: '/deposit', label: 'Dépôt', hint: "Créditer le compte d'un client", icon: 'deposit', kind: 'in' },
  { to: '/withdraw', label: 'Retrait', hint: 'Payer un code de retrait', icon: 'withdraw', kind: 'out' },
  { to: '/send-cash', label: 'Envoi cash', hint: 'Envoyer de l’argent depuis le guichet', icon: 'send', kind: 'send' },
];

export function AgentDashboard() {
  const user = useCurrentUser();
  const desk = useDesk();
  const mine = useResource(() => api.transactions.listMine(), []);
  const commissions = useResource(() => api.commissions.mine('month', { limit: 1 }), []);

  return (
    <div className="dash">
      <DashHero compact>
        <CashBox desk={desk} />
      </DashHero>

      <section className="dash-section" aria-labelledby="dash-ops-title">
        <header className="dash-section__head">
          <h2 id="dash-ops-title" className="dash-section__title">
            Opérations
          </h2>
          <span className="dash-section__hint">Guichet</span>
        </header>
        <nav className="dash-actions" aria-label="Opérations du guichet">
          {ACTIONS.map((a) => (
            <Link key={a.to} to={a.to} className={`dash-action dash-action--${a.kind}`}>
              <span className="dash-action__icon" aria-hidden="true">
                <Icon name={a.icon} size={22} />
              </span>
              <strong>{a.label}</strong>
              <small>{a.hint}</small>
            </Link>
          ))}
        </nav>
      </section>

      <div className="dash-cols">
        <div className="dash-stack">
          <Panel title="Dernières opérations" to="/transactions">
            <PanelState res={mine} what="vos opérations" empty={{ when: (d) => d.length === 0, text: "Aucune opération pour l'instant." }}>
              {(list) => <TxRows txs={newestFirst(list).slice(0, 6)} viewer={user} />}
            </PanelState>
          </Panel>
        </div>

        <div className="dash-stack">
          <Panel title="Commissions du mois" to="/commissions" badge={<Pill tone="ok">Mois en cours</Pill>}>
            <PanelState res={commissions} what="vos commissions">
              {(c) => {
                const lines = amountsLabel(c.totalsByCurrency);
                return lines.length === 0 ? (
                  <p className="muted dash-empty">Aucune commission ce mois-ci.</p>
                ) : (
                  <div className="dash-big">
                    {lines.map((l) => (
                      <strong key={l}>{l}</strong>
                    ))}
                    <small>
                      {c.count} commission{c.count > 1 ? 's' : ''} perçue{c.count > 1 ? 's' : ''}
                    </small>
                  </div>
                );
              }}
            </PanelState>
          </Panel>

        </div>
      </div>
    </div>
  );
}
