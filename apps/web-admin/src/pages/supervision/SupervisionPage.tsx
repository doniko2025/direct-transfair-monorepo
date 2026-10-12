// src/pages/supervision/SupervisionPage.tsx
// Supervision de la plateforme (super admin) : points d'attention, état réel de la base et du serveur,
// chiffres des dernières 24 heures, alertes et journal d'audit.
// Les alertes et le journal se chargent à part : une panne de l'un n'empêche pas d'afficher le reste.

import { useCallback, useState } from 'react';
import { ApiError } from '@direct-transfair/shared';
import { Button, Card, Notice, PageHeader, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { fullDate } from '../../lib/supervisionRules';
import { useResource } from '../../lib/useResource';
import { useCurrentUser } from '../../providers/AuthProvider';
import ActivitySection from './ActivitySection';
import AlertsSection from './AlertsSection';
import AttentionSection from './AttentionSection';
import AuditSection from './AuditSection';
import HealthSection from './HealthSection';

function scrollToAlerts() {
  const el = document.getElementById('alerts');
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

export default function SupervisionPage() {
  const me = useCurrentUser();
  const overview = useResource(() => api.supervision.overview(), []);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshAll = useCallback(() => {
    overview.reload();
    setRefreshKey((k) => k + 1);
  }, [overview]);

  const data = overview.data;
  const notDeployed = overview.error instanceof ApiError && overview.error.status === 404;

  return (
    <>
      <PageHeader
        title="Supervision"
        description={
          me.role === 'SUPER_ADMIN'
            ? 'Ce qui demande votre attention, l’état de la plateforme et la trace des actions sensibles.'
            : 'Ce qui demande votre attention dans votre société et la trace des actions sensibles.'
        }
        actions={
          <Button variant="secondary" onClick={refreshAll} busy={overview.loading && data !== null}>
            Actualiser
          </Button>
        }
      />

      {overview.loading && !data ? (
        <div className="center-block">
          <Spinner label="Chargement de la supervision" />
        </div>
      ) : overview.error && !data ? (
        <Card>
          <Notice
            tone="error"
            title={notDeployed ? 'La supervision n’est pas encore disponible sur le serveur' : 'Impossible de charger la supervision'}
            action={
              <button type="button" className="link-btn" onClick={overview.reload}>
                Réessayer
              </button>
            }
          >
            {notDeployed
              ? 'Le serveur ne connaît pas encore les routes /supervision. Déployez la dernière version du backend, puis réessayez.'
              : describeError(overview.error).message}
          </Notice>
        </Card>
      ) : data ? (
        <div className="sv-stack">
          {overview.error ? (
            <Notice tone="error" title="L’actualisation a échoué">
              {describeError(overview.error).message} Les chiffres affichés peuvent être anciens.
            </Notice>
          ) : null}
          <p className="sv-stamp muted">
            Données du <time dateTime={data.generatedAt}>{fullDate(data.generatedAt)}</time>
          </p>

          <AttentionSection items={data.attention} onGoToAlerts={scrollToAlerts} />
          <HealthSection health={data.health} />
          <ActivitySection overview={data} />
          <AlertsSection refreshKey={refreshKey} onResolved={overview.reload} />
          <AuditSection refreshKey={refreshKey} canFilterCompany={data.scope === 'PLATFORM'} />
        </div>
      ) : null}
    </>
  );
}
