// src/pages/treasury/AgencyCards.tsx
// Admin de société : les agences du réseau avec leurs soldes, et les deux opérations de caisse
// (recharger, récupérer des fonds).

import type { TreasuryAgency } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, Pill, Spinner } from '../../components/ui';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { agencyWallet } from '../../lib/treasuryRules';

interface Props {
  agencies: readonly TreasuryAgency[] | null;
  error: unknown;
  loading: boolean;
  onRetry: () => void;
  onRefill: (agencyId: string) => void;
  onCollect: (agencyId: string) => void;
}

export default function AgencyCards({ agencies, error, loading, onRetry, onRefill, onCollect }: Props) {
  return (
    <section aria-labelledby="agencies-title" className="tr-section">
      <div className="tr-section__head">
        <h2 id="agencies-title">Caisses des agences</h2>
        <p>Le solde de chaque agence par devise. Rechargez une caisse presque vide ou récupérez les fonds en trop.</p>
      </div>

      {loading && !agencies ? (
        <div className="center-block">
          <Spinner label="Chargement des agences" />
        </div>
      ) : error && !agencies ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les agences"
            action={
              <button type="button" className="link-btn" onClick={onRetry}>
                Réessayer
              </button>
            }
          >
            {describeError(error).message}
          </Notice>
        </Card>
      ) : !agencies || agencies.length === 0 ? (
        <Card className="empty empty--compact">
          <span className="empty__icon">
            <Icon name="building" size={26} />
          </span>
          <h3>Aucune agence pour l’instant</h3>
          <p>Créez une agence pour pouvoir recharger sa caisse.</p>
        </Card>
      ) : (
        <ul className="agency-grid">
          {agencies.map((a) => {
            const main = agencyWallet(a);
            const agents = a.agents?.length ?? 0;
            return (
              <li key={a.id} className="agency-card">
                <div className="agency-card__head">
                  <div>
                    <strong>{a.name}</strong>
                    <span className="muted">
                      {a.city}
                      {agents > 0 ? ` · ${agents} agent${agents > 1 ? 's' : ''}` : ''}
                    </span>
                  </div>
                  <Pill tone={a.isActive ? 'ok' : 'neutral'}>{a.isActive ? 'Active' : 'Désactivée'}</Pill>
                </div>
                {(a.wallets ?? []).length > 0 ? (
                  <ul className="agency-card__wallets">
                    {(a.wallets ?? []).map((w) => (
                      <li key={w.id} className={w.id === main?.id ? 'is-main' : undefined}>
                        <span>{w.currency}</span>
                        <strong>{formatAmount(w.balance, w.currency)}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Aucune caisse ouverte : la première recharge en crée une.</p>
                )}
                <div className="agency-card__actions">
                  <Button disabled={!a.isActive} onClick={() => onRefill(a.id)}>
                    Recharger
                  </Button>
                  <Button variant="secondary" disabled={!a.isActive || !main || main.availableBalance <= 0} onClick={() => onCollect(a.id)}>
                    Récupérer des fonds
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
