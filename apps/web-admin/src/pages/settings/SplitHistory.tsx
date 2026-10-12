// src/pages/settings/SplitHistory.tsx
// Journal des changements de répartition : une carte par changement, le plus récent d'abord.

import type { SplitChange } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Card, Notice, Pill, Spinner } from '../../components/ui';
import { describeError } from '../../lib/errors';
import { changeTitle, pct } from '../../lib/splitRules';
import { fullDate, when } from '../../lib/supervisionRules';
import type { Resource } from '../../lib/useResource';

function Entry({ c }: { c: SplitChange }) {
  return (
    <li className="fee-log">
      <div className="fee-log__main">
        <div className="fee-log__head">
          <Pill tone="brand">Répartition modifiée</Pill>
          <strong>{changeTitle(c)}</strong>
        </div>
        {c.to ? (
          <p className="fee-log__change">
            {c.from ? (
              <>
                <span className="muted">
                  {pct(c.from.senderShare)} / {pct(c.from.payerShare)} / {pct(c.from.platformShare)}
                </span>
                <Icon name="chevronRight" size={16} />
              </>
            ) : null}
            <strong>
              {pct(c.to.senderShare)} / {pct(c.to.payerShare)} / {pct(c.to.platformShare)}
            </strong>
            <span className="muted"> · envoi / paiement / société</span>
          </p>
        ) : null}
        <span className="muted fee-log__by">
          Par {c.user ?? 'un administrateur'} ·{' '}
          <time dateTime={c.createdAt} title={fullDate(c.createdAt)}>
            {when(c.createdAt)}
          </time>
        </span>
      </div>
    </li>
  );
}

export default function SplitHistory({ resource }: { resource: Resource<{ data: SplitChange[] }> }) {
  const { data, error, loading, reload } = resource;
  const list = data?.data ?? [];
  return (
    <section aria-labelledby="split-log-title" className="tr-section">
      <div className="tr-section__head">
        <h2 id="split-log-title">Dernières modifications</h2>
        <p>Qui a changé une répartition, et quand.</p>
      </div>
      {loading && !data ? (
        <div className="center-block">
          <Spinner label="Chargement du journal" />
        </div>
      ) : error && !data ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger le journal"
            action={
              <button type="button" className="link-btn" onClick={reload}>
                Réessayer
              </button>
            }
          >
            {describeError(error).message}
          </Notice>
        </Card>
      ) : list.length === 0 ? (
        <Card className="empty empty--compact">
          <span className="empty__icon">
            <Icon name="list" size={26} />
          </span>
          <h3>Aucune modification enregistrée</h3>
          <p>Les changements de répartition apparaîtront ici.</p>
        </Card>
      ) : (
        <ul className="fee-log-list">
          {list.map((c) => (
            <Entry key={c.id} c={c} />
          ))}
        </ul>
      )}
    </section>
  );
}
