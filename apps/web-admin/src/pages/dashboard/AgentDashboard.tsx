// apps/web-admin/src/pages/dashboard/AgentDashboard.tsx
// Tableau de bord de l'agent : caisse de l'agence, opérations du guichet, bilan du jour,
// dernières opérations et commissions du mois.

import { Icon, type IconName } from '../../components/Icon';
import { Link } from 'react-router-dom';
import { Pill } from '../../components/ui';
import { api } from '../../lib/api';
import { amountsLabel, newestFirst } from '../../lib/dashboardRules';
import { totalsLabel } from '../../lib/deskRules';
import { countryName } from '../../lib/countries';
import { useCurrentUser } from '../../providers/AuthProvider';
import { useResource } from '../../lib/useResource';
import { CashBox } from '../desk/CashBox';
import { useDesk } from '../desk/useDesk';
import { DashHero } from './DashHero';
import { KpiCard, KpiGrid, NotificationsPeek, Panel, PanelState, TxRows } from './parts';

const ACTIONS: readonly { to: string; label: string; hint: string; icon: IconName }[] = [
  { to: '/deposit', label: 'Dépôt', hint: "Créditer le compte d'un client", icon: 'deposit' },
  { to: '/withdraw', label: 'Retrait', hint: 'Payer un code de retrait', icon: 'withdraw' },
  { to: '/send-cash', label: 'Envoi cash', hint: 'Envoyer de l’argent depuis le guichet', icon: 'send' },
  { to: '/remit', label: 'Remise', hint: "Remonter des fonds à l'administrateur", icon: 'vault' },
];

export function AgentDashboard() {
  const user = useCurrentUser();
  const desk = useDesk();
  const mine = useResource(() => api.transactions.listMine(), []);
  const commissions = useResource(() => api.commissions.mine('month', { limit: 1 }), []);

  const agency = desk.data?.agency ?? null;
  const today = desk.data?.today ?? null;
  const place = agency ? [agency.city, countryName(agency.country)].filter(Boolean).join(', ') : '';
  const loadingDesk = desk.loading && !desk.data;

  const stats: { label: string; icon: IconName; summary: { count: number; totals: { currency: string; total: number }[] } | undefined }[] = [
    { label: 'Dépôts', icon: 'deposit', summary: today?.deposits },
    { label: 'Retraits payés', icon: 'withdraw', summary: today?.payouts },
    { label: 'Envois', icon: 'send', summary: today?.sends },
    { label: 'Remises', icon: 'vault', summary: today?.remittances },
  ];

  return (
    <div className="dash">
      <DashHero
        context={
          agency
            ? `Vous opérez au guichet de ${agency.name}${place ? ` (${place})` : ''} : dépôts, retraits et envois cash.`
            : 'Vous opérez au guichet : dépôts, retraits et envois cash.'
        }
        extraPill={agency ? agency.name : null}
      />

      <KpiGrid label="Bilan du jour">
        {stats.map((s) => (
          <KpiCard
            key={s.label}
            icon={s.icon}
            label={s.label}
            loading={loadingDesk}
            value={desk.error ? '—' : String(s.summary?.count ?? 0)}
            note={desk.error ? 'Indisponible' : s.summary && s.summary.count > 0 ? totalsLabel(s.summary.totals) : 'Aucune aujourd’hui'}
          />
        ))}
      </KpiGrid>

      <div className="dash-cols">
        <div className="dash-stack">
          <Panel title="Ma caisse">
            <CashBox desk={desk} />
          </Panel>

          <nav className="dash-actions" aria-label="Opérations du guichet">
            {ACTIONS.map((a) => (
              <Link key={a.to} to={a.to} className="dash-action">
                <span className="dash-action__icon" aria-hidden="true">
                  <Icon name={a.icon} size={22} />
                </span>
                <strong>{a.label}</strong>
                <small>{a.hint}</small>
              </Link>
            ))}
          </nav>

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

          <NotificationsPeek />
        </div>
      </div>
    </div>
  );
}
