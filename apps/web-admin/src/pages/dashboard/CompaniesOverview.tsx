// src/pages/dashboard/CompaniesOverview.tsx
// Carte « Sociétés » du tableau de bord super admin : compteurs et dernières sociétés créées.

import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { CompanyMark } from '../../components/CompanyMark';
import { Card, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { isActiveStatus, statusLabel, statusTone } from '../../lib/companyRules';
import { useResource } from '../../lib/useResource';

export function CompaniesOverview() {
  const { data, error, loading } = useResource(() => api.companies.list(), []);
  const companies = data ?? [];
  const active = companies.filter((c) => isActiveStatus(c.subscriptionStatus)).length;
  const latest = [...companies]
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, 3);

  return (
    <Card as="section" aria-labelledby="overview-companies">
      <div className="overview__head">
        <h2 className="card-title" id="overview-companies">
          Sociétés
        </h2>
        <Link to="/companies" className="link-btn overview__more">
          Tout voir
          <Icon name="chevronRight" size={15} />
        </Link>
      </div>

      {loading && !data ? (
        <div className="center-block center-block--sm">
          <Spinner label="Chargement des sociétés" />
        </div>
      ) : error ? (
        <p className="muted">Impossible de charger les sociétés pour le moment.</p>
      ) : companies.length === 0 ? (
        <p className="muted">
          Aucune société pour l'instant.{' '}
          <Link to="/companies/new" className="link-btn">
            Créer la première
          </Link>
        </p>
      ) : (
        <>
          <p className="overview__summary">
            <strong>{companies.length}</strong> {companies.length > 1 ? 'sociétés' : 'société'}
            {' · '}
            {active} {active > 1 ? 'actives' : 'active'}
          </p>
          <ul className="overview__list">
            {latest.map((c) => (
              <li key={c.id}>
                <Link to={`/companies/${c.id}`} className="overview__item">
                  <CompanyMark name={c.name} logoUrl={c.logoUrl} color={c.primaryColor} size={36} />
                  <span className="overview__name">
                    <strong>{c.name}</strong>
                    <span>{c.code}</span>
                  </span>
                  <Pill tone={statusTone(c.subscriptionStatus)}>{statusLabel(c.subscriptionStatus)}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
