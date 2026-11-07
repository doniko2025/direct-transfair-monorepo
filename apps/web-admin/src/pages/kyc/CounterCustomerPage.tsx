// src/pages/kyc/CounterCustomerPage.tsx
// Fiche d'un client de passage : identité, références de la pièce recopiées par l'agent, photos prises au comptoir et derniers envois.
// L'ouverture de la fiche et de chaque photo est journalisée (KYC_VIEW).

import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { countryName } from '../../lib/countries';
import { formatAmount } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { formatDay } from '../../lib/kycRules';
import { statusLabel } from '../../lib/transactionRules';
import { useResource } from '../../lib/useResource';
import { formatDateTime } from '../../lib/userRules';
import { KycFileView } from './KycFileView';

export default function CounterCustomerPage() {
  const { id = '' } = useParams();
  const res = useResource(() => api.kyc.counterCustomer(id), [id]);
  const c = res.data;

  const back = (
    <Link className="btn btn--secondary" to="/kyc/passage">
      <Icon name="arrowLeft" size={18} />
      <span>Clients de passage</span>
    </Link>
  );

  if (res.loading && !c) {
    return (
      <div className="center-block">
        <Spinner label="Chargement de la fiche" />
      </div>
    );
  }

  if (!c) {
    const notFound = res.error instanceof ApiError && res.error.status === 404;
    return (
      <>
        <PageHeader title="Client de passage" actions={back} />
        <Card>
          <Notice
            tone="error"
            title={notFound ? 'Fiche introuvable' : 'Impossible de charger la fiche'}
            action={
              notFound ? undefined : (
                <button type="button" className="link-btn" onClick={res.reload}>
                  Réessayer
                </button>
              )
            }
          >
            {notFound ? 'Cette fiche n’existe pas ou n’appartient pas à votre société.' : describeError(res.error).message}
          </Notice>
        </Card>
      </>
    );
  }

  const has = (kind: 'front' | 'back') => c.files.some((f) => f.kind === kind);

  return (
    <>
      <PageHeader
        title={c.name}
        description={`Client de passage · fiche créée le ${formatDateTime(c.createdAt)}${c.registeredBy ? ` par ${c.registeredBy}` : ''}`}
        actions={
          <>
            {back}
            <Button variant="secondary" icon="refresh" onClick={res.reload}>
              Actualiser
            </Button>
          </>
        }
      />

      <Notice tone="info" title="Consultation journalisée">
        L’ouverture de cette fiche et de chaque photo est enregistrée dans le journal d’audit avec votre nom et l’heure.
      </Notice>

      {c.idExpired ? (
        <Notice tone="error" title="Pièce expirée">
          La pièce enregistrée a expiré le {formatDay(c.idExpiry)} : l’agent devra en saisir une nouvelle (et la photographier) au prochain envoi.
        </Notice>
      ) : null}

      <div className="kyc-docs">
        <Card as="article" className="kyc-doc" aria-label="Pièce d’identité">
          <header className="kyc-doc__head">
            <h3>{c.idTypeLabel}</h3>
            <Pill tone={c.files.length > 0 ? 'ok' : 'warn'}>{c.files.length > 0 ? 'Photographiée' : 'Sans photo'}</Pill>
          </header>
          {c.files.length > 0 ? (
            <div className={has('back') ? 'kyc-doc__files kyc-doc__files--two' : 'kyc-doc__files'}>
              {has('front') ? (
                <figure>
                  <KycFileView source="counter" documentId={c.id} kind="front" label={has('back') ? `${c.idTypeLabel} — recto` : c.idTypeLabel} />
                  {has('back') ? <figcaption>Recto</figcaption> : null}
                </figure>
              ) : null}
              {has('back') ? (
                <figure>
                  <KycFileView source="counter" documentId={c.id} kind="back" label={`${c.idTypeLabel} — verso`} />
                  <figcaption>Verso</figcaption>
                </figure>
              ) : null}
            </div>
          ) : (
            <Notice tone="info" title="Aucune photo">
              Cette fiche date d’avant la photographie obligatoire : la photo sera demandée à l’agent au prochain envoi de cette personne.
            </Notice>
          )}
          <dl className="kv kv--grid">
            <div className="kv__row kv__row--half">
              <dt>Numéro</dt>
              <dd>{c.idNumber}</dd>
            </div>
            <div className="kv__row kv__row--half">
              <dt>Expire le</dt>
              <dd>{formatDay(c.idExpiry)}</dd>
            </div>
            {c.idCountry ? (
              <div className="kv__row">
                <dt>Pays émetteur</dt>
                <dd>{countryName(c.idCountry) ?? c.idCountry}</dd>
              </div>
            ) : null}
            {c.photoAt ? (
              <div className="kv__row">
                <dt>Photographiée le</dt>
                <dd>{formatDateTime(c.photoAt)}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <Card as="section" className="kyc-doc" aria-label="Identité déclarée">
          <header className="kyc-doc__head">
            <h3>Identité déclarée</h3>
          </header>
          <dl className="kv kv--grid">
            <div className="kv__row kv__row--half">
              <dt>Prénom</dt>
              <dd>{c.firstName}</dd>
            </div>
            <div className="kv__row kv__row--half">
              <dt>Nom</dt>
              <dd>{c.lastName}</dd>
            </div>
            <div className="kv__row kv__row--half">
              <dt>Né(e) le</dt>
              <dd>{formatDay(c.birthDate)}</dd>
            </div>
            <div className="kv__row kv__row--half">
              <dt>Téléphone</dt>
              <dd>{c.phone}</dd>
            </div>
            <div className="kv__row">
              <dt>Envois au comptoir</dt>
              <dd>{c.sends}</dd>
            </div>
          </dl>
          {c.recent.length > 0 ? (
            <>
              <h4>Derniers envois</h4>
              <ul className="kyc-history">
                {c.recent.map((t) => (
                  <li key={t.id}>
                    <div>
                      <strong>{formatAmount(t.amount, t.currency)}</strong>
                      <p className="muted">
                        {statusLabel(t.status)} · {formatDateTime(t.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>
      </div>
    </>
  );
}
