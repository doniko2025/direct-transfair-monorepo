// apps/web-admin/src/pages/dashboard/SupportDashboard.tsx
// Tableau de bord du service client : ce qui attend une réponse, uniquement pour les domaines que l'administrateur a délégués.

import type { SupportPermissionMeta } from '@direct-transfair/shared';
import { SUPPORT_GROUP_LABEL, can } from '@direct-transfair/shared';
import { api } from '../../lib/api';
import { groupedCatalog } from '../../lib/supportRules';
import { useResource } from '../../lib/useResource';
import { useCurrentUser } from '../../providers/AuthProvider';
import { DashHero } from './DashHero';
import { KpiCard, KpiGrid, Panel, PanelState } from './parts';

export function SupportDashboard() {
  const user = useCurrentUser();
  const overview = useResource(() => api.support.overview(), [user.supportPermissions?.join(',')]);
  const catalog = useResource(() => api.support.catalog(), []);
  const c = overview.data?.counts;
  const loading = overview.loading && !overview.data;

  const mine = new Set(user.supportPermissions ?? []);
  const cards = [
    c?.tickets != null && can(user, 'TICKETS_HANDLE')
      ? { key: 'tickets', icon: 'list' as const, label: 'Demandes en cours', value: c.tickets, to: '/support/tickets', warn: c.tickets > 0 }
      : null,
    c?.disputes != null && can(user, 'TICKETS_HANDLE')
      ? { key: 'disputes', icon: 'alert' as const, label: 'Litiges ouverts', value: c.disputes, to: '/support/tickets?kind=DISPUTE', warn: c.disputes > 0 }
      : null,
    c?.kyc != null && can(user, 'KYC_REVIEW') ? { key: 'kyc', icon: 'shield' as const, label: 'Pièces à valider', value: c.kyc, to: '/kyc', warn: c.kyc > 0 } : null,
    c?.refunds != null && can(user, 'REFUNDS_DECIDE')
      ? { key: 'refunds', icon: 'swap' as const, label: 'Remboursements à valider', value: c.refunds, to: '/support/refunds', warn: c.refunds > 0 }
      : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="dash">
      <DashHero context={user.client?.name ?? undefined} />

      {cards.length > 0 ? (
        <section className="dash-section" aria-labelledby="sp-todo-title">
          <header className="dash-section__head">
            <h2 id="sp-todo-title" className="dash-section__title">
              À traiter
            </h2>
          </header>
          <KpiGrid label="Éléments à traiter">
            {cards.map((k) => (
              <KpiCard key={k.key} icon={k.icon} label={k.label} value={String(k.value)} to={k.to} tone={k.warn ? 'warn' : 'ok'} note={k.warn ? 'À traiter' : 'Rien en attente'} loading={loading} />
            ))}
          </KpiGrid>
        </section>
      ) : null}

      <Panel title="Vos délégations">
        <PanelState
          res={catalog}
          what="vos délégations"
          empty={{ when: () => mine.size === 0, text: "Aucune délégation active pour l'instant. Votre administrateur peut en activer depuis la rubrique « Service client »." }}
        >
          {(cat: SupportPermissionMeta[]) => (
            <ul className="sp-mine">
              {groupedCatalog(cat).map(({ group, items }) => {
                const active = items.filter((m) => mine.has(m.key));
                if (active.length === 0) return null;
                return (
                  <li key={group}>
                    <strong>{SUPPORT_GROUP_LABEL[group]}</strong>
                    <span>{active.map((m) => m.label).join(' · ')}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </PanelState>
      </Panel>
    </div>
  );
}
