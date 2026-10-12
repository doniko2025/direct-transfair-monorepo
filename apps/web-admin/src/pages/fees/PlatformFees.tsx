// src/pages/fees/PlatformFees.tsx
// Frais de chaque société (super admin) : lecture seule. Le tarif appartient à la société.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CompanyFees } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { feeIcon, feeSummary } from '../../lib/feeRules';
import { plural } from '../../lib/supervisionRules';
import { useResource } from '../../lib/useResource';
import FeeHistory from './FeeHistory';

const STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' }> = {
  ACTIVE: { label: 'Active', tone: 'ok' },
  TRIAL: { label: 'Essai', tone: 'warn' },
  SUSPENDED: { label: 'Suspendue', tone: 'danger' },
  EXPIRED: { label: 'Expirée', tone: 'danger' },
};

function CompanyCard({ c }: { c: CompanyFees }) {
  const status = STATUS[c.subscriptionStatus] ?? { label: c.subscriptionStatus, tone: 'neutral' as const };
  const charged = c.methods.filter((m) => m.charged);
  const defaults = charged.filter((m) => !m.configured).length;
  return (
    <li className="fee-company" data-code={c.code}>
      <div className="fee-company__head">
        <div>
          <h3>{c.name}</h3>
          <span className="muted">{c.code}</span>
        </div>
        <Pill tone={status.tone}>{status.label}</Pill>
      </div>
      <ul className="fee-lines">
        {charged.map((m) => (
          <li key={m.payoutMethod} className="fee-line">
            <span className="fee-line__label">
              <Icon name={feeIcon(m.payoutMethod)} size={16} />
              {m.label}
            </span>
            <strong>{feeSummary(m)}</strong>
            {m.configured ? null : <span className="fee-line__default">par défaut</span>}
          </li>
        ))}
      </ul>
      {defaults === charged.length ? (
        <p className="fee-card__hint">Cette société n’a encore rien configuré : le taux par défaut s’applique partout.</p>
      ) : null}
    </li>
  );
}

export default function PlatformFees() {
  const list = useResource(() => api.fees.companies(), []);
  const history = useResource(() => api.fees.history(undefined, 20), []);
  const [query, setQuery] = useState('');

  const all = useMemo(() => list.data?.companies ?? [], [list.data]);
  const q = query.trim().toLowerCase();
  const shown = q ? all.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) : all;

  return (
    <>
      <PageHeader
        title="Frais d’envoi"
        description="Le tarif de chaque société. Chaque administrateur de société fixe le sien : vous les consultez ici."
        actions={
          <>
            <Link to="/fees/schedule" className="btn btn--secondary">
              Barèmes par montant et pays
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                list.reload();
                history.reload();
              }}
              busy={list.loading && list.data !== null}
            >
              Actualiser
            </Button>
          </>
        }
      />

      {list.loading && !list.data ? (
        <div className="center-block">
          <Spinner label="Chargement des frais" />
        </div>
      ) : list.error && !list.data ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les frais"
            action={
              <button type="button" className="link-btn" onClick={list.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(list.error).message}
          </Notice>
        </Card>
      ) : (
        <div className="tr-stack">
          <section aria-labelledby="fee-companies-title" className="tr-section">
            <div className="tr-section__head">
              <h2 id="fee-companies-title">
                {all.length} {plural(all.length, 'société', 'sociétés')}
              </h2>
              <p>Les modes Mobile Money et wallet vers wallet sont gratuits pour toutes les sociétés.</p>
            </div>
            <div className="toolbar">
              <div className="search">
                <Icon name="search" size={18} />
                <input
                  type="search"
                  placeholder="Rechercher une société"
                  aria-label="Rechercher une société"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            {shown.length === 0 ? (
              <Card className="empty empty--compact">
                <span className="empty__icon">
                  <Icon name="building" size={26} />
                </span>
                <h3>{all.length === 0 ? 'Aucune société' : 'Aucun résultat'}</h3>
                <p>{all.length === 0 ? 'Les sociétés créées apparaîtront ici.' : 'Aucune société ne correspond à cette recherche.'}</p>
              </Card>
            ) : (
              <ul className="fee-company-grid">
                {shown.map((c) => (
                  <CompanyCard key={c.id} c={c} />
                ))}
              </ul>
            )}
          </section>

          <FeeHistory resource={history} withCompany />
        </div>
      )}
    </>
  );
}
