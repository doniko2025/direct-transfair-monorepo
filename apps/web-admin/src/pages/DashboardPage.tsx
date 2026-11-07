// apps/web-admin/src/pages/DashboardPage.tsx
// v2.0 — Tableau de bord reconstruit, un par rôle :
//   SUPER_ADMIN   → PlatformDashboard (sociétés, activité de la plateforme, paiements B2B)
//   COMPANY_ADMIN → AdminDashboard    (trésorerie, activité, à traiter, agences, commissions)
//   AGENT         → AgentDashboard    (caisse, guichet, bilan du jour, commissions)
// La carte « Votre session » et la « Connexion technique » vivent désormais dans Mon compte.

import type { WebRole } from '@direct-transfair/shared';
import { UrgentBanner } from '../components/UrgentBanner';
import { useCurrentUser } from '../providers/AuthProvider';
import { AdminDashboard } from './dashboard/AdminDashboard';
import { AgentDashboard } from './dashboard/AgentDashboard';
import { PlatformDashboard } from './dashboard/PlatformDashboard';
import { SupportDashboard } from './dashboard/SupportDashboard';

export default function DashboardPage() {
  const user = useCurrentUser();
  const role = user.role as WebRole;

  return (
    <>
      <UrgentBanner />
      {role === 'SUPER_ADMIN' ? <PlatformDashboard /> : null}
      {role === 'COMPANY_ADMIN' ? <AdminDashboard /> : null}
      {role === 'AGENT' ? <AgentDashboard /> : null}
      {role === 'SUPPORT' ? <SupportDashboard /> : null}
    </>
  );
}
