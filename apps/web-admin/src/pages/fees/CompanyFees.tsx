// src/pages/fees/CompanyFees.tsx
// Frais de ma société (admin de société) : une carte par mode de retrait, modifiable.

import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FeeMethod } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Button, Card, Field, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { computeFee, feeIcon, feeSummary, formatNumber, parseExample, toInput } from '../../lib/feeRules';
import { useResource } from '../../lib/useResource';
import FeeEditDialog from './FeeEditDialog';
import FeeHistory from './FeeHistory';

function MethodCard({ m, example, onEdit }: { m: FeeMethod; example: number | null; onEdit: (m: FeeMethod) => void }) {
  const fee = example !== null && m.charged ? computeFee(example, m) : null;
  return (
    <li className={`fee-card${m.charged ? '' : ' fee-card--free'}`} data-method={m.payoutMethod}>
      <div className="fee-card__head">
        <span className="fee-card__icon" aria-hidden="true">
          <Icon name={feeIcon(m.payoutMethod)} size={22} />
        </span>
        <h3>{m.label}</h3>
        {m.charged ? (
          m.configured ? <Pill tone="ok">Configuré</Pill> : <Pill tone="warn">Par défaut</Pill>
        ) : (
          <Pill tone="brand">Gratuit</Pill>
        )}
      </div>

      {m.charged ? (
        <>
          <strong className="fee-card__value">{feeSummary(m)}</strong>
          {fee !== null && example !== null ? (
            <p className="fee-card__example">
              Sur {formatNumber(example)} envoyés : <strong>{formatNumber(fee)}</strong> de frais, le client paie{' '}
              <strong>{formatNumber(example + fee)}</strong>.
            </p>
          ) : (
            <p className="fee-card__example muted">Saisissez un montant d’exemple pour voir le calcul.</p>
          )}
          {!m.configured ? (
            <p className="fee-card__hint">Vous n’avez rien configuré : le taux par défaut de la plateforme s’applique.</p>
          ) : null}
          <div className="fee-card__actions">
            <Button variant="secondary" icon="edit" onClick={() => onEdit(m)}>
              Modifier
            </Button>
          </div>
        </>
      ) : (
        <>
          <strong className="fee-card__value">Aucun frais</strong>
          <p className="fee-card__hint">Le serveur ne prélève jamais de frais sur ce mode d’envoi.</p>
          {m.storedFeeRate !== null ? (
            <p className="fee-card__warn" role="note">
              <Icon name="alert" size={16} />
              <span>Un taux de {formatNumber(m.storedFeeRate)} % est enregistré mais il n’est pas appliqué.</span>
            </p>
          ) : null}
        </>
      )}
    </li>
  );
}

export default function CompanyFees() {
  const mine = useResource(() => api.fees.mine(), []);
  const history = useResource(() => api.fees.history(undefined, 10), []);
  const [editing, setEditing] = useState<FeeMethod | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [exampleRaw, setExampleRaw] = useState(toInput(100000));

  const done = useCallback(
    (message: string) => {
      setEditing(null);
      setFlash(message);
      mine.reload();
      history.reload();
    },
    [mine, history],
  );

  const example = parseExample(exampleRaw);
  const methods = mine.data?.methods ?? [];

  return (
    <>
      <PageHeader
        title="Frais d’envoi"
        description={
          mine.data
            ? `Ce que ${mine.data.company.name} facture à ses clients sur chaque envoi, selon le mode de retrait.`
            : 'Ce que votre société facture à ses clients sur chaque envoi.'
        }
        actions={
          <>
            <Link to="/fees/schedule" className="btn btn--secondary">
              Barème par montant et pays
            </Link>
            <Button variant="secondary" onClick={mine.reload} busy={mine.loading && mine.data !== null}>
              Actualiser
            </Button>
          </>
        }
      />

      {flash ? (
        <div className="stack stack--tight">
          <Notice
            tone="ok"
            title={flash}
            action={
              <button type="button" className="link-btn" onClick={() => setFlash(null)}>
                Fermer
              </button>
            }
          />
        </div>
      ) : null}

      {mine.loading && !mine.data ? (
        <div className="center-block">
          <Spinner label="Chargement des frais" />
        </div>
      ) : mine.error && !mine.data ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les frais"
            action={
              <button type="button" className="link-btn" onClick={mine.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(mine.error).message}
          </Notice>
        </Card>
      ) : (
        <div className="tr-stack">
          <section aria-labelledby="fee-methods-title" className="tr-section">
            <div className="tr-section__head">
              <h2 id="fee-methods-title">Tarifs par mode de retrait</h2>
              <p>Le frais est prélevé en plus du montant envoyé, au moment de l’envoi.</p>
            </div>
            <div className="fee-sim">
              <Field
                id="fee-example"
                label="Calculer pour un envoi de"
                inputMode="decimal"
                autoComplete="off"
                value={exampleRaw}
                onChange={(e) => setExampleRaw(e.target.value)}
                error={exampleRaw.trim() !== '' ? example.error : null}
                hint="Exemple indicatif, sans devise."
              />
            </div>
            <ul className="fee-grid">
              {methods.map((m) => (
                <MethodCard key={m.payoutMethod} m={m} example={example.value} onEdit={setEditing} />
              ))}
            </ul>
          </section>

          <FeeHistory resource={history} withCompany={false} />
        </div>
      )}

      {editing ? <FeeEditDialog method={editing} onClose={() => setEditing(null)} onDone={done} /> : null}
    </>
  );
}
