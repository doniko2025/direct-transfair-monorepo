// src/pages/supervision/AttentionSection.tsx
// Ce qui demande une action maintenant, détecté sur les données réelles.

import { Link } from 'react-router-dom';
import type { AttentionItem } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Card } from '../../components/ui';
import { ATTENTION } from '../../lib/supervisionRules';

interface Props {
  items: readonly AttentionItem[];
  onGoToAlerts: () => void;
}

export default function AttentionSection({ items, onGoToAlerts }: Props) {
  return (
    <section aria-labelledby="sv-attention-title" className="sv-section">
      <div className="sv-section__head">
        <h2 id="sv-attention-title">À traiter en priorité</h2>
        <p>Les situations qui demandent une décision ou une vérification.</p>
      </div>

      {items.length === 0 ? (
        <Card className="empty empty--calm">
          <span className="empty__icon empty__icon--ok">
            <Icon name="check" size={26} />
          </span>
          <h3>Rien à signaler</h3>
          <p>Aucune transaction bloquée, aucun compte verrouillé et aucun abonnement à surveiller.</p>
        </Card>
      ) : (
        <ul className="sv-attn-grid">
          {items.map((item) => {
            const view = ATTENTION[item.kind];
            return (
              <li key={item.kind} className={`sv-attn sv-attn--${item.severity}`}>
                <span className="sv-attn__icon" aria-hidden="true">
                  <Icon name={view.icon} size={22} />
                </span>
                <div className="sv-attn__text">
                  <strong>{view.title}</strong>
                  <span>{view.text(item.count)}</span>
                  {view.to ? (
                    <Link className="link" to={view.to}>
                      {view.cta}
                    </Link>
                  ) : (
                    <button type="button" className="link-btn" onClick={onGoToAlerts}>
                      {view.cta}
                    </button>
                  )}
                </div>
                <span className="sv-attn__count" aria-label={`${item.count}`}>
                  {item.count}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
