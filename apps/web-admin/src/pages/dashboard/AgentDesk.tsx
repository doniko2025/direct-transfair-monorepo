// src/pages/dashboard/AgentDesk.tsx
// « Mon guichet » : la caisse de l'agence, les raccourcis vers les 4 opérations et le bilan du jour.

import { Link } from 'react-router-dom';
import type { DeskSummary } from '@direct-transfair/shared';
import { Icon, type IconName } from '../../components/Icon';
import { Card } from '../../components/ui';
import { totalsLabel } from '../../lib/deskRules';
import { CashBox } from '../desk/CashBox';
import { useDesk } from '../desk/useDesk';

const ACTIONS: readonly { to: string; label: string; icon: IconName }[] = [
  { to: '/deposit', label: 'Dépôt', icon: 'deposit' },
  { to: '/withdraw', label: 'Retrait', icon: 'withdraw' },
  { to: '/send-cash', label: 'Envoi cash', icon: 'send' },
  { to: '/remit', label: 'Remise', icon: 'vault' },
];

function Stat({ label, summary }: { label: string; summary: DeskSummary | undefined }) {
  const count = summary?.count ?? 0;
  return (
    <li className="desk-stat">
      <span>{label}</span>
      <strong>{count}</strong>
      <small>{count > 0 && summary ? totalsLabel(summary.totals) : 'Aucune'}</small>
    </li>
  );
}

export function AgentDesk() {
  const desk = useDesk();
  const today = desk.data?.today ?? null;

  return (
    <Card className="agent-desk">
      <h2 className="card-title">Mon guichet</h2>
      <CashBox desk={desk} />
      <nav className="agent-desk__actions" aria-label="Opérations du guichet">
        {ACTIONS.map((a) => (
          <Link key={a.to} to={a.to} className="agent-desk__action">
            <Icon name={a.icon} size={20} />
            <span>{a.label}</span>
          </Link>
        ))}
      </nav>
      {today ? (
        <>
          <h3 className="agent-desk__sub">Aujourd’hui</h3>
          <ul className="desk-stats">
            <Stat label="Dépôts" summary={today.deposits} />
            <Stat label="Retraits payés" summary={today.payouts} />
            <Stat label="Envois" summary={today.sends} />
            <Stat label="Remises" summary={today.remittances} />
          </ul>
        </>
      ) : null}
    </Card>
  );
}
