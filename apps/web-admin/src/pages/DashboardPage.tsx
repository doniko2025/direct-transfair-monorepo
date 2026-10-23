// apps/web-admin/src/pages/DashboardPage.tsx
// v2.0 — Tableau de bord reconstruit, un par rôle :
//   SUPER_ADMIN   → PlatformDashboard (sociétés, activité de la plateforme, paiements B2B)
//   COMPANY_ADMIN → AdminDashboard    (trésorerie, activité, à traiter, agences, commissions)
//   AGENT         → AgentDashboard    (caisse, guichet, bilan du jour, commissions)
// La carte « Votre session » et la « Connexion technique » vivent désormais dans Mon compte.

import type { WebRole } from '@direct-transfair/shared';
import { useCurrentUser } from '../providers/AuthProvider';
import { AdminDashboard } from './dashboard/AdminDashboard';
import { AgentDashboard } from './dashboard/AgentDashboard';
import { PlatformDashboard } from './dashboard/PlatformDashboard';

export default function DashboardPage() {
  const user = useCurrentUser();
  const role = user.role as WebRole;

  switch (role) {
    case 'SUPER_ADMIN':
      return <PlatformDashboard />;
    case 'COMPANY_ADMIN':
      return <AdminDashboard />;
    case 'AGENT':
      return <AgentDashboard />;
  }
}
