// src/pages/fees/FeeHistory.tsx
// Journal des modifications de frais : une carte par modification, la plus récente d'abord.

import type { FeeChange, FeeValues } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Card, Notice, Pill, Spinner } from '../../components/ui';
import { describeError } from '../../lib/errors';
import { feeSummary } from '../../lib/feeRules';
import { fullDate, when } from '../../lib/supervisionRules';
import type { Resource } from '../../lib/useResource';

const METHOD_LABEL: Record<string, string> = {
  CASH_PICKUP: 'Retrait cash',
  BANK_DEPOSIT: 'Virement bancaire',
  IBAN_TRANSFER: 'Virement IBAN (Europe)',
  MOBILE_MONEY: 'Mobile Money',
  WALLET: 'Wallet vers wallet',
};

function before(v: FeeValues | null): string {
  if (!v) return 'Inconnu';
  return v.configured === false ? `${feeSummary(v)} (par défaut)` : feeSummary(v);
}

function Entry({ c, withCompany }: { c: FeeChange; withCompany: boolean }) {
  return (
    <li className="fee-log">
      <div className="fee-log__main">
        <div className="fee-log__head">
          <Pill tone="brand">{c.payoutMethod ? (METHOD_LABEL[c.payoutMethod] ?? c.payoutMethod) : 'Frais'}</Pill>
          {withCompany && c.company ? <strong>{c.company}</strong> : null}
        </div>
        <p className="fee-log__change">
          <span className="muted">{before(c.from)}</span>
          <Icon name="chevronRight" size={16} />
          <strong>{c.to ? feeSummary(c.to) : 'Inconnu'}</strong>
        </p>
        <span className="muted fee-log__by">
          Par {c.user ?? 'un administrateur'} · <time dateTime={c.createdAt} title={fullDate(c.createdAt)}>{when(c.createdAt)}</time>
        </span>
      </div>
    </li>
  );
}

export default function FeeHistory({ resource, withCompany }: { resource: Resource<{ data: FeeChange[] }>; withCompany: boolean }) {
  const { data, error, loading, reload } = resource;
  return (
    <section aria-labelledby="fee-log-title" className="tr-section">
      <div className="tr-section__head">
        <h2 id="fee-log-title">Dernières modifications</h2>
        <p>Qui a changé quels frais, et quand.</p>
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
          <p>Les changements de frais apparaîtront ici.</p>
        </Card>
      ) : (
        <ul className="fee-log-list">
          {(data?.data ?? []).map((c) => (
            <Entry key={c.id} c={c} withCompany={withCompany} />
          ))}
        </ul>
      )}
    </section>
  );
}
