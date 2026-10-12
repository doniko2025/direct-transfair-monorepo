// src/pages/supervision/ActivitySection.tsx
// Chiffres des dernières 24 heures : activité, sécurité et (super admin) parc de sociétés.

import type { ReactNode } from 'react';
import type { SupervisionOverview } from '@direct-transfair/shared';
import { plural, type Tone } from '../../lib/supervisionRules';

interface StatProps {
  label: string;
  value: number;
  note?: string;
  /** Ton appliqué seulement quand la valeur est supérieure à zéro (une alerte à 0 n'est pas une alerte). */
  alert?: Exclude<Tone, 'neutral' | 'brand' | 'ok'>;
}

function Stat({ label, value, note, alert }: StatProps) {
  const tone = alert && value > 0 ? alert : 'neutral';
  return (
    <li className={`sv-stat sv-stat--${tone}`}>
      <strong className="sv-stat__value">{value.toLocaleString('fr-FR')}</strong>
      <span className="sv-stat__label">{label}</span>
      {note ? <span className="sv-stat__note">{note}</span> : null}
    </li>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="sv-group">
      <h3>{title}</h3>
      <ul className="sv-stat-grid">{children}</ul>
    </div>
  );
}

export default function ActivitySection({ overview }: { overview: SupervisionOverview }) {
  const { last24h, security, companies } = overview;
  const success = last24h.transactions - last24h.failedTransactions;

  return (
    <section aria-labelledby="sv-activity-title" className="sv-section">
      <div className="sv-section__head">
        <h2 id="sv-activity-title">Dernières 24 heures</h2>
        <p>L’activité et la sécurité de la plateforme sur la journée écoulée.</p>
      </div>

      <div className="sv-groups">
        <Group title="Activité">
          <Stat
            label={plural(last24h.transactions, 'Transaction créée', 'Transactions créées')}
            value={last24h.transactions}
            note={last24h.transactions > 0 ? `${success} sans échec` : undefined}
          />
          <Stat label={plural(last24h.failedTransactions, 'Transaction en échec', 'Transactions en échec')} value={last24h.failedTransactions} alert="danger" />
        </Group>

        <Group title="Sécurité">
          <Stat label={plural(security.failedOtp24h, 'Code de vérification refusé', 'Codes de vérification refusés')} value={security.failedOtp24h} alert="warn" />
          <Stat label={plural(security.lockouts24h, 'Verrouillage de compte', 'Verrouillages de compte')} value={security.lockouts24h} alert="warn" />
          <Stat label={plural(security.suspicious24h, 'Activité suspecte', 'Activités suspectes')} value={security.suspicious24h} alert="danger" />
          <Stat
            label={plural(security.lockedAccountsNow, 'Compte verrouillé en ce moment', 'Comptes verrouillés en ce moment')}
            value={security.lockedAccountsNow}
            alert="warn"
          />
        </Group>

        {companies ? (
          <Group title="Sociétés">
            <Stat label={plural(companies.total, 'Société hébergée', 'Sociétés hébergées')} value={companies.total} />
            <Stat label={plural(companies.active, 'Abonnement actif', 'Abonnements actifs')} value={companies.active} />
            <Stat label={plural(companies.trial, 'Société en essai', 'Sociétés en essai')} value={companies.trial} />
            <Stat label={plural(companies.suspended, 'Société suspendue', 'Sociétés suspendues')} value={companies.suspended} alert="danger" />
            <Stat label={plural(companies.expired, 'Abonnement expiré', 'Abonnements expirés')} value={companies.expired} alert="danger" />
            <Stat label={plural(companies.expiringSoon, 'Abonnement échu sous 14 jours', 'Abonnements échus sous 14 jours')} value={companies.expiringSoon} alert="warn" />
          </Group>
        ) : null}
      </div>
    </section>
  );
}
