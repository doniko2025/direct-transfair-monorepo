// src/pages/rates/RateHistoryPage.tsx
// Historique d'un couple : une carte par enregistrement, du plus récent au plus ancien,
// avec la variation par rapport à l'enregistrement précédent.

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, type RateHistoryEntry } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { changeBetween, changeTone, formatChange, formatRate, rateLine } from '../../lib/ratesRules';
import { fullDate, plural } from '../../lib/supervisionRules';
import { useResource } from '../../lib/useResource';

const STEP = 50;
const MAX = 100;

export default function RateHistoryPage() {
  const { pair = '' } = useParams();
  const [limit, setLimit] = useState(STEP);
  const history = useResource(() => api.rates.history(pair, limit), [pair, limit]);

  const back = (
    <Link to="/rates" className="btn btn--secondary">
      <Icon name="arrowLeft" size={18} />
      <span>Taux de change</span>
    </Link>
  );

  const err = history.error;
  if (!history.data && err instanceof ApiError && (err.status === 400 || err.status === 404 || err.status === 403)) {
    return (
      <>
        <PageHeader title="Couple introuvable" actions={back} />
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Ce couple de devises n’existe pas</h2>
          <p>{err.status === 403 ? 'Vous n’avez pas accès à cet historique.' : err.message}</p>
        </Card>
      </>
    );
  }

  if (history.loading && !history.data) {
    return (
      <div className="center-block">
        <Spinner label="Chargement de l’historique" />
      </div>
    );
  }

  if (err && !history.data) {
    return (
      <>
        <PageHeader title="Historique" actions={back} />
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger l’historique"
            action={
              <button type="button" className="link-btn" onClick={history.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(err).message}
          </Notice>
        </Card>
      </>
    );
  }

  const data = history.data;
  const entries: RateHistoryEntry[] = data?.data ?? [];
  // Il y a probablement d'autres enregistrements si le serveur a rempli la tranche demandée.
  const mayHaveMore = entries.length >= limit && limit < MAX;

  return (
    <>
      <PageHeader
        title={data ? `Historique ${data.base} → ${data.quote}` : 'Historique'}
        description="Chaque enregistrement du taux, du plus récent au plus ancien."
        actions={back}
      />

      {entries.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="list" size={26} />
          </span>
          <h2>Aucun enregistrement</h2>
          <p>Le taux n’a pas encore été fixé : le taux de secours du serveur s’applique.</p>
        </Card>
      ) : (
        <>
          <p className="tx-summary">
            <strong>
              {entries.length} {plural(entries.length, 'enregistrement', 'enregistrements')}
            </strong>
          </p>
          <ul className="ledger-list">
            {entries.map((e, i) => {
              const older = entries[i + 1];
              const change = older ? changeBetween(e.rate, older.rate) : null;
              return (
                <li key={e.id} className="ledger-item rate-history-item">
                  <div className="ledger-item__main">
                    <strong>{data ? rateLine(data.base, data.quote, e.rate) : formatRate(e.rate)}</strong>
                    <span className="muted">
                      <time dateTime={e.recordedAt}>{fullDate(e.recordedAt)}</time>
                      {e.source ? ` · ${e.source === 'manual' ? 'saisie manuelle' : e.source}` : ''}
                    </span>
                  </div>
                  {change !== null && change !== 0 ? <Pill tone={changeTone(change)}>{formatChange(change)}</Pill> : null}
                  {i === 0 ? <Pill tone="brand">Taux actuel</Pill> : null}
                </li>
              );
            })}
          </ul>
          {mayHaveMore ? (
            <div className="more">
              <Button variant="secondary" busy={history.loading} onClick={() => setLimit(MAX)}>
                Voir les enregistrements plus anciens
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
