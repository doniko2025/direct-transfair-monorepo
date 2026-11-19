// src/pages/desk/StatsPage.tsx
// Statistiques du jour de l'agent : dépôts, retraits payés, envois et remises (ex-compteurs de l'accueil, désormais dans le menu).

import type { DeskSummary } from '@direct-transfair/shared';
import type { IconName } from '../../components/Icon';
import { PageHeader } from '../../components/ui';
import { totalsLabel } from '../../lib/deskRules';
import { KpiCard, KpiGrid } from '../dashboard/parts';
import { useDesk } from './useDesk';

type Kind = 'in' | 'out' | 'send' | 'vault';

export default function StatsPage() {
  const desk = useDesk();
  const today = desk.data?.today ?? null;
  const loading = desk.loading && !desk.data;

  const stats: { label: string; icon: IconName; kind: Kind; summary: DeskSummary | undefined }[] = [
    { label: 'Dépôts', icon: 'deposit', kind: 'in', summary: today?.deposits },
    { label: 'Retraits payés', icon: 'withdraw', kind: 'out', summary: today?.payouts },
    { label: 'Envois', icon: 'send', kind: 'send', summary: today?.sends },
    { label: 'Remises', icon: 'vault', kind: 'vault', summary: today?.remittances },
  ];

  return (
    <div className="desk-page">
      <PageHeader title="Statistiques du jour" description="Votre activité d’aujourd’hui au guichet." />
      <KpiGrid label="Bilan du jour" className="dash-kpis--stats dash-kpis--grid">
        {stats.map((s) => (
          <KpiCard
            key={s.label}
            icon={s.icon}
            variant={s.kind}
            label={s.label}
            loading={loading}
            value={desk.error ? '—' : String(s.summary?.count ?? 0)}
            note={desk.error ? 'Indisponible' : s.summary && s.summary.count > 0 ? totalsLabel(s.summary.totals) : 'Aucune aujourd’hui'}
          />
        ))}
      </KpiGrid>
    </div>
  );
}
