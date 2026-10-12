// src/pages/supervision/HealthSection.tsx
// État réel de la plateforme : la base est interrogée à chaque chargement (SELECT 1 chronométré),
// l'API indique depuis quand elle tourne. Rien n'est affiché « OK » par défaut.

import type { HealthStatus, SupervisionOverview } from '@direct-transfair/shared';
import { Pill } from '../../components/ui';
import { HEALTH_TONE, formatUptime } from '../../lib/supervisionRules';

const STATUS_LABEL: Record<HealthStatus, string> = {
  ok: 'Opérationnelle',
  warn: 'Ralentie',
  error: 'Injoignable',
};

function HealthCard({ name, status, detail }: { name: string; status: HealthStatus; detail: string }) {
  return (
    <li className={`sv-health sv-health--${status}`}>
      <span className="sv-health__dot" aria-hidden="true" />
      <div className="sv-health__text">
        <strong>{name}</strong>
        <span>{detail}</span>
      </div>
      <Pill tone={HEALTH_TONE[status]}>{STATUS_LABEL[status]}</Pill>
    </li>
  );
}

export default function HealthSection({ health }: { health: SupervisionOverview['health'] }) {
  const { database, api } = health;
  const dbDetail =
    database.status === 'error'
      ? 'La base de données ne répond pas.'
      : `Répond en ${database.latencyMs ?? '—'} ms${database.status === 'warn' ? ' — plus lent que d’habitude' : ''}.`;

  return (
    <section aria-labelledby="sv-health-title" className="sv-section">
      <div className="sv-section__head">
        <h2 id="sv-health-title">État de la plateforme</h2>
        <p>Mesuré à l’instant, à chaque actualisation.</p>
      </div>
      <ul className="sv-health-grid">
        <HealthCard name="Base de données" status={database.status} detail={dbDetail} />
        <HealthCard name="Serveur d’application" status={api.status} detail={`En service depuis ${formatUptime(api.uptimeSeconds)}.`} />
      </ul>
    </section>
  );
}
