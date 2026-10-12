// src/pages/fees/FeeRuleHistory.tsx
// Journal des modifications du barème : une carte par changement, le plus récent d'abord.

import type { FeeRuleChange } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Card, Notice, Pill, Spinner } from '../../components/ui';
import { describeError } from '../../lib/errors';
import { OP_LABEL, rangeLabel, ruleFee, ruleTitle } from '../../lib/feeScheduleRules';
import { fullDate, when } from '../../lib/supervisionRules';
import type { Resource } from '../../lib/useResource';

function Entry({ c }: { c: FeeRuleChange }) {
  const rule = c.to ?? c.from;
  return (
    <li className="fee-log">
      <div className="fee-log__main">
        <div className="fee-log__head">
          <Pill tone={c.op === 'delete' ? 'danger' : c.op === 'create' ? 'ok' : 'brand'}>{OP_LABEL[c.op] ?? 'Règle modifiée'}</Pill>
          <strong>{rule ? ruleTitle(rule) : 'Règle'}</strong>
        </div>
        {rule ? (
          <p className="fee-log__change">
            {c.from && c.to ? (
              <>
                <span className="muted">{ruleFee(c.from)}</span>
                <Icon name="chevronRight" size={16} />
                <strong>{ruleFee(c.to)}</strong>
              </>
            ) : (
              <strong>{ruleFee(rule)}</strong>
            )}
            <span className="muted"> · {rangeLabel(rule)}</span>
          </p>
        ) : null}
        <span className="muted fee-log__by">
          Par {c.user ?? 'un administrateur'} · <time dateTime={c.createdAt} title={fullDate(c.createdAt)}>{when(c.createdAt)}</time>
        </span>
      </div>
    </li>
  );
}

export default function FeeRuleHistory({ resource }: { resource: Resource<{ data: FeeRuleChange[] }> }) {
  const { data, error, loading, reload } = resource;
  return (
    <section aria-labelledby="rule-log-title" className="tr-section">
      <div className="tr-section__head">
        <h2 id="rule-log-title">Dernières modifications du barème</h2>
        <p>Qui a ajouté, modifié ou supprimé une règle, et quand.</p>
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
      ) : (data?.data ?? []).length === 0 ? (
        <Card className="empty empty--compact">
          <span className="empty__icon">
            <Icon name="list" size={26} />
          </span>
          <h3>Aucune modification enregistrée</h3>
          <p>Les changements du barème apparaîtront ici.</p>
        </Card>
      ) : (
        <ul className="fee-log-list">
          {(data?.data ?? []).map((c) => (
            <Entry key={c.id} c={c} />
          ))}
        </ul>
      )}
    </section>
  );
}
