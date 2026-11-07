// src/pages/settings/SplitHistory.tsx
// Journal des changements de répartition : une entrée compacte par changement (seules les parts modifiées sont listées).

import type { SplitChange } from '@direct-transfair/shared';
import { changeTitle, pct } from '../../lib/splitRules';
import type { Resource } from '../../lib/useResource';
import { ChangeLog, type LogItem, type LogLine } from './SettingsKit';

const PARTS = [
  ['senderShare', 'Envoi'],
  ['payerShare', 'Paiement'],
  ['platformShare', 'Société'],
] as const;

function toItem(c: SplitChange): LogItem {
  const lines: LogLine[] = [];
  if (c.to) {
    for (const [key, label] of PARTS) {
      if (c.from && c.from[key] === c.to[key]) continue;
      lines.push({ label, from: c.from ? pct(c.from[key]) : null, to: pct(c.to[key]) });
    }
  }
  return { id: c.id, title: changeTitle(c), createdAt: c.createdAt, user: c.user, lines };
}

export default function SplitHistory({ resource }: { resource: Resource<{ data: SplitChange[] }> }) {
  return <ChangeLog resource={resource} toItem={toItem} emptyText="Les changements de répartition apparaîtront ici." />;
}
