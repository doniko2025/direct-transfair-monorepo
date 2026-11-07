// src/pages/kyc/KycReviewPage.tsx
// Dossier d'identité d'un client : ses informations de compte à côté des pièces envoyées, pour comparer.
// Valider / refuser chaque pièce, révoquer une pièce déjà validée, relancer le client, voir l'historique.

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, KYC_DOC_LABEL, KYC_DOC_STATUS_LABEL, KYC_STATUS_LABEL, type KycDocumentView } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { countryName } from '../../lib/countries';
import { describeError } from '../../lib/errors';
import { DOC_TONE, OVERALL_TONE, expiresSoon, formatDay } from '../../lib/kycRules';
import { useResource } from '../../lib/useResource';
import { KYC_LABEL, formatDateTime, initialsOf } from '../../lib/userRules';
import { ApproveDialog, RejectDialog } from './KycDecisionDialogs';
import { KycFileView } from './KycFileView';

function DocCard({ doc, onApprove, onReject }: { doc: KycDocumentView; onApprove: () => void; onReject: () => void }) {
  const warnExpiry = doc.status === 'APPROVED' && expiresSoon(doc.expiryDate);
  return (
    <Card as="article" className="kyc-doc" aria-label={doc.label}>
      <header className="kyc-doc__head">
        <h3>{doc.label}</h3>
        <Pill tone={DOC_TONE[doc.status]}>{KYC_DOC_STATUS_LABEL[doc.status]}</Pill>
      </header>

      <div className={doc.hasBack ? 'kyc-doc__files kyc-doc__files--two' : 'kyc-doc__files'}>
        <figure>
          <KycFileView documentId={doc.id} kind="front" label={doc.hasBack ? `${doc.label} — recto` : doc.label} />
          {doc.hasBack ? <figcaption>Recto</figcaption> : null}
        </figure>
        {doc.hasBack ? (
          <figure>
            <KycFileView documentId={doc.id} kind="back" label={`${doc.label} — verso`} />
            <figcaption>Verso</figcaption>
          </figure>
        ) : null}
      </div>

      <dl className="kv kv--grid">
        {doc.documentNumber ? (
          <div className="kv__row kv__row--half">
            <dt>Numéro</dt>
            <dd>{doc.documentNumber}</dd>
          </div>
        ) : null}
        {doc.expiryDate ? (
          <div className="kv__row kv__row--half">
            <dt>Expire le</dt>
            <dd>
              {formatDay(doc.expiryDate)} {warnExpiry ? <Pill tone="warn">Bientôt</Pill> : null}
            </dd>
          </div>
        ) : null}
        {doc.issuedCountry ? (
          <div className="kv__row kv__row--half">
            <dt>Pays émetteur</dt>
            <dd>{countryName(doc.issuedCountry) ?? doc.issuedCountry}</dd>
          </div>
        ) : null}
        <div className="kv__row kv__row--half">
          <dt>Envoyée le</dt>
          <dd>{formatDateTime(doc.createdAt)}</dd>
        </div>
        {doc.reviewedAt ? (
          <div className="kv__row kv__row--half">
            <dt>Traitée le</dt>
            <dd>{formatDateTime(doc.reviewedAt)}</dd>
          </div>
        ) : null}
      </dl>

      {doc.rejectionReason ? (
        <Notice tone="error" title="Motif du refus">
          {doc.rejectionReason}
        </Notice>
      ) : null}

      {doc.status === 'PENDING' ? (
        <div className="kyc-doc__actions">
          <Button icon="check" onClick={onApprove}>
            Valider
          </Button>
          <Button variant="danger" icon="close" onClick={onReject}>
            Refuser
          </Button>
        </div>
      ) : doc.status === 'APPROVED' ? (
        <div className="kyc-doc__actions">
          <Button variant="secondary" onClick={onReject}>
            Révoquer
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export default function KycReviewPage() {
  const { userId = '' } = useParams();
  const dossier = useResource(() => api.kyc.adminDossier(userId), [userId]);
  const [approving, setApproving] = useState<KycDocumentView | null>(null);
  const [rejecting, setRejecting] = useState<KycDocumentView | null>(null);
  const [flash, setFlash] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [reminding, setReminding] = useState(false);

  const back = (
    <Link to="/kyc" className="btn btn--secondary">
      <Icon name="arrowLeft" size={18} />
      <span>Toutes les vérifications</span>
    </Link>
  );

  const d = dossier.data;
  const missing = useMemo(() => (d?.missing ?? []).map((t) => KYC_DOC_LABEL[t]), [d]);
  const notFound = dossier.error instanceof ApiError && (dossier.error.status === 404 || dossier.error.status === 403);

  if (notFound) {
    return (
      <>
        <PageHeader title="Dossier introuvable" actions={back} />
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="search" size={26} />
          </span>
          <h2>Ce dossier n'est pas accessible</h2>
          <p>Le client n'existe pas, ou ce n'est pas un client de votre société.</p>
        </Card>
      </>
    );
  }
  if (dossier.loading && !d) {
    return (
      <div className="center-block">
        <Spinner label="Chargement du dossier" />
      </div>
    );
  }
  if (!d) {
    return (
      <>
        <PageHeader title="Vérification d'identité" actions={back} />
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger le dossier"
            action={
              <button type="button" className="link-btn" onClick={dossier.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(dossier.error).message}
          </Notice>
        </Card>
      </>
    );
  }

  const u = d.user;
  const pendingCount = d.documents.filter((x) => x.status === 'PENDING').length;
  const done = (message: string) => {
    setApproving(null);
    setRejecting(null);
    setFlash({ tone: 'ok', text: message });
    dossier.reload();
  };

  async function remind() {
    setReminding(true);
    setFlash(null);
    try {
      await api.kyc.remind(u.id);
      setFlash({ tone: 'ok', text: 'Rappel envoyé (notification, push et e-mail).' });
      dossier.reload();
    } catch (err) {
      setFlash({ tone: 'error', text: describeError(err).message });
    } finally {
      setReminding(false);
    }
  }

  return (
    <>
      <PageHeader title={u.name ?? 'Client'} description="Vérification d'identité" actions={back} />

      <div className="stack">
        <Card className="company-hero">
          <span className="avatar user-hero__avatar" aria-hidden="true">
            {initialsOf({ firstName: u.firstName, lastName: u.lastName, email: u.email ?? '' })}
          </span>
          <div className="company-hero__main">
            <div className="company-hero__line">
              <Pill tone={OVERALL_TONE[d.status]} icon="shield">
                {KYC_STATUS_LABEL[d.status]}
              </Pill>
              <Pill tone={d.level === 'LEVEL_0' ? 'warn' : 'neutral'}>{KYC_LABEL[d.level].split(' · ')[0]}</Pill>
              {pendingCount > 0 ? <Pill tone="brand">{pendingCount} à valider</Pill> : null}
              {u.isSuspended ? <Pill tone="danger">Compte suspendu</Pill> : null}
            </div>
            <p className="company-hero__meta">{[u.phone, u.email].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="company-hero__actions">
            {!d.verified ? (
              <Button variant="secondary" icon="bell" busy={reminding} onClick={() => void remind()}>
                Relancer le client
              </Button>
            ) : null}
            <Link to={`/wallet-clients/${encodeURIComponent(u.id)}`} className="btn btn--secondary">
              <Icon name="user" size={18} />
              <span>Fiche client</span>
            </Link>
          </div>
        </Card>

        {flash ? (
          <Notice
            tone={flash.tone}
            title={flash.text}
            action={
              <button type="button" className="link-btn" onClick={() => setFlash(null)}>
                Fermer
              </button>
            }
          />
        ) : null}

        {d.expiry ? (
          <Notice tone={d.expiry.expired ? 'error' : 'info'} title={d.expiry.expired ? 'Pièce d’identité expirée' : 'Pièce d’identité bientôt expirée'}>
            {d.expiry.expired
              ? `${d.expiry.label} expirée le ${formatDay(d.expiry.expiryDate)} : envois, virements programmés et retraits sont bloqués jusqu’à la validation d’une nouvelle pièce.`
              : `${d.expiry.label} valable jusqu’au ${formatDay(d.expiry.expiryDate)} (encore ${d.expiry.daysLeft} jour${d.expiry.daysLeft > 1 ? 's' : ''}). Le client est prévenu à 30 puis 7 jours de l’échéance.`}
          </Notice>
        ) : null}

        {!d.verified && missing.length > 0 ? (
          <Notice tone="info" title="Ce qu'il manque pour vérifier ce client">
            {missing.join(' et ')}. Tant que l'identité n'est pas validée, le client ne peut ni envoyer, ni programmer de virement, ni retirer.
          </Notice>
        ) : null}

        <Card as="section" aria-labelledby="kyc-profile" className="section-card">
          <header className="section-card__head">
            <span className="section-card__icon">
              <Icon name="user" size={20} />
            </span>
            <div className="section-card__title">
              <h2 id="kyc-profile">Informations du compte</h2>
              <p>À comparer avec les pièces : le nom, la date de naissance et le pays doivent correspondre.</p>
            </div>
          </header>
          <dl className="kv kv--grid">
            <div className="kv__row">
              <dt>Nom complet</dt>
              <dd>{u.name ?? <span className="muted">Non renseigné</span>}</dd>
            </div>
            <div className="kv__row kv__row--half">
              <dt>Date de naissance</dt>
              <dd>{formatDay(u.birthDate) ?? <span className="muted">Non renseignée</span>}</dd>
            </div>
            <div className="kv__row kv__row--half">
              <dt>Lieu de naissance</dt>
              <dd>{u.birthPlace ?? <span className="muted">Non renseigné</span>}</dd>
            </div>
            <div className="kv__row kv__row--half">
              <dt>Nationalité</dt>
              <dd>{u.nationality ? (countryName(u.nationality) ?? u.nationality) : <span className="muted">Non renseignée</span>}</dd>
            </div>
            <div className="kv__row kv__row--half">
              <dt>Inscription</dt>
              <dd>{formatDateTime(u.createdAt)}</dd>
            </div>
            <div className="kv__row">
              <dt>Adresse</dt>
              <dd>{[u.address, u.city, countryName(u.country)].filter(Boolean).join(', ') || <span className="muted">Non renseignée</span>}</dd>
            </div>
            {!d.verified ? (
              <div className="kv__row">
                <dt>Rappels envoyés</dt>
                <dd>
                  {u.remindersSent}
                  {u.lastReminderAt ? <span className="muted"> — dernier le {formatDateTime(u.lastReminderAt)}</span> : null}
                </dd>
              </div>
            ) : (
              <div className="kv__row">
                <dt>Vérifié le</dt>
                <dd>{formatDateTime(d.verifiedAt) ?? <span className="muted">—</span>}</dd>
              </div>
            )}
          </dl>
        </Card>

        <section aria-labelledby="kyc-docs" className="tr-section">
          <div className="tr-section__head">
            <h2 id="kyc-docs">Pièces envoyées</h2>
            <p>
              {d.documents.length === 0
                ? "Ce client n'a encore rien envoyé."
                : 'La dernière version de chaque pièce. Cliquez sur une photo pour l’agrandir.'}
            </p>
          </div>
          {d.documents.length === 0 ? (
            <Card className="empty empty--compact">
              <span className="empty__icon">
                <Icon name="file" size={26} />
              </span>
              <h3>Aucune pièce</h3>
              <p>Le client reçoit des rappels automatiques ; vous pouvez aussi le relancer ci-dessus.</p>
            </Card>
          ) : (
            <div className="kyc-docs">
              {d.documents.map((doc) => (
                <DocCard key={doc.id} doc={doc} onApprove={() => setApproving(doc)} onReject={() => setRejecting(doc)} />
              ))}
            </div>
          )}
        </section>

        {d.history.length > d.documents.length ? (
          <Card as="section" aria-labelledby="kyc-history" className="section-card">
            <header className="section-card__head">
              <span className="section-card__icon">
                <Icon name="list" size={20} />
              </span>
              <div className="section-card__title">
                <h2 id="kyc-history">Historique</h2>
                <p>Toutes les versions envoyées, de la plus récente à la plus ancienne.</p>
              </div>
            </header>
            <ul className="kyc-history">
              {d.history.map((h) => (
                <li key={h.id}>
                  <div>
                    <strong>{h.label}</strong> <span className="muted">v{h.version} · {formatDateTime(h.createdAt)}</span>
                    {h.rejectionReason ? <p className="muted">Motif : {h.rejectionReason}</p> : null}
                  </div>
                  <Pill tone={DOC_TONE[h.status]}>{KYC_DOC_STATUS_LABEL[h.status]}</Pill>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      {approving ? <ApproveDialog doc={approving} onClose={() => setApproving(null)} onDone={done} /> : null}
      {rejecting ? <RejectDialog doc={rejecting} onClose={() => setRejecting(null)} onDone={done} /> : null}
    </>
  );
}
