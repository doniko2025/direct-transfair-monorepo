// src/components/UrgentBanner.tsx
// Accueil : demandes urgentes qui attendent une réponse (dossiers à valider, litiges, remboursements, retraits, signalements).
// Elles apparaissent dès qu'il y a du nouveau et disparaissent pour de bon au moindre clic (sur la ligne ou sur la croix) ;
// elles ne reviennent que si de nouvelles demandes arrivent. Un clic sur la ligne ouvre directement la page de traitement.

import { Link } from 'react-router-dom';
import { freshLabel, urgentLabel } from '../lib/urgentRules';
import { useUrgent } from '../providers/UrgentProvider';
import { Icon } from './Icon';

export function UrgentBanner() {
  const { items, dismiss, dismissAll } = useUrgent();
  if (items.length === 0) return null;

  return (
    <section className="urgent" aria-label="Demandes urgentes" aria-live="polite">
      <header className="urgent__head">
        <h2>
          <span className="urgent__pulse" aria-hidden="true" />
          À traiter maintenant
        </h2>
        {items.length > 1 ? (
          <button type="button" className="link-btn" onClick={dismissAll}>
            Tout masquer
          </button>
        ) : null}
      </header>
      <ul className="urgent__list">
        {items.map((item) => (
          <li key={item.kind} className={`urgent__item urgent__item--${item.meta.tone}`}>
            <Link to={item.meta.to} className="urgent__link" onClick={() => dismiss(item.kind)}>
              <span className="urgent__icon" aria-hidden="true">
                <Icon name={item.meta.icon} size={20} />
              </span>
              <span className="urgent__text">
                <strong>{urgentLabel(item)}</strong>
                <small>{freshLabel(item)}</small>
              </span>
              <Icon name="chevronRight" size={18} />
            </Link>
            <button type="button" className="urgent__close" onClick={() => dismiss(item.kind)} aria-label={`Masquer : ${urgentLabel(item)}`}>
              <Icon name="close" size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
