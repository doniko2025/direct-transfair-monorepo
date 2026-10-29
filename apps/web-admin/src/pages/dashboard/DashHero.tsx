// apps/web-admin/src/pages/dashboard/DashHero.tsx
// Bandeau d'accueil commun : salutation, date, contexte (société, agence) et actions rapides.
// Mode `compact` : seulement la date et la salutation, puis `children` (ex. la caisse de l'agent).

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
  compact = false,
  children,
}: {
  /** Ligne sous la salutation : « Flash Transfer · Vendredi 23 octobre »… (ignorée en mode compact) */
  context?: string;
  actions?: ReactNode;
  extraPill?: string | null;
  /** Bandeau réduit : date + salutation uniquement, pour gagner de la place. */
  compact?: boolean;
  /** Contenu affiché sous la salutation (mode compact). */
  children?: ReactNode;
}) {
  const user = useCurrentUser();
  const role = user.role as WebRole;

  return (
    <header className={`card card--raised dash-hero${compact ? ' dash-hero--compact' : ''}`}>
      <Rosette className="hero__rosette" layers={24} />
      <div className="dash-hero__text">
        <p className="dash-hero__date">{longDate()}</p>
        <h1>{user.firstName ? `${greeting()} ${user.firstName}` : greeting()}</h1>
        {!compact && context ? <p className="dash-hero__context">{context}</p> : null}
        {!compact ? (
          <div className="dash-hero__pills">
            <Pill tone="brand" icon="shield">
              {ROLE_LABEL[role]}
            </Pill>
            {extraPill ? <Pill>{extraPill}</Pill> : null}
          </div>
        ) : null}
      </div>
      {children ? <div className="dash-hero__body">{children}</div> : null}
      {actions ? <div className="dash-hero__actions">{actions}</div> : null}
    </header>
  );
}
