// apps/web-admin/src/pages/dashboard/DashHero.tsx
// Bandeau d'accueil commun : salutation, date, contexte (société, agence) et actions rapides.

import type { ReactNode } from 'react';
import { Rosette } from '../../components/Rosette';
import { Pill } from '../../components/ui';
import { greeting, longDate } from '../../lib/dashboardRules';
import { ROLE_LABEL } from '../../navigation';
import { useCurrentUser } from '../../providers/AuthProvider';
import type { WebRole } from '@direct-transfair/shared';

export function DashHero({
  context,
  actions,
  extraPill,
}: {
  /** Ligne sous la salutation : « Flash Transfer · Vendredi 23 octobre »… */
  context: string;
  actions?: ReactNode;
  extraPill?: string | null;
}) {
  const user = useCurrentUser();
  const role = user.role as WebRole;

  return (
    <header className="card card--raised dash-hero">
      <Rosette className="hero__rosette" layers={24} />
      <div className="dash-hero__text">
        <p className="dash-hero__date">{longDate()}</p>
        <h1>{user.firstName ? `${greeting()} ${user.firstName}` : greeting()}</h1>
        <p className="dash-hero__context">{context}</p>
        <div className="dash-hero__pills">
          <Pill tone="brand" icon="shield">
            {ROLE_LABEL[role]}
          </Pill>
          {extraPill ? <Pill>{extraPill}</Pill> : null}
        </div>
      </div>
      {actions ? <div className="dash-hero__actions">{actions}</div> : null}
    </header>
  );
}
