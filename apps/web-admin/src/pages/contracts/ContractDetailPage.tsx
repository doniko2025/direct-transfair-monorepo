// apps/web-admin/src/pages/contracts/ContractDetailPage.tsx
// Fiche d'un contrat (SUPER_ADMIN) : conditions, état de la signature, piste d'audit, PDF signé, relance du lien, annulation.

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, CONTRACT_KIND_LABEL, type ContractDetail, type ResendLinkResult } from '@direct-transfair/shared';
import { CompanyMark } from '../../components/CompanyMark';
import { ConfirmDialog, CopyButton } from '../../components/form';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { CONTRACT_TONE, contractStatusLabel, formatDateTime, formatDay, saveBlob, termsHeadline } from '../../lib/contractRules';
import { describeError } from '../../lib/errors';
import { useResource } from '../../lib/useResource';

export default function ContractDetailPage() {
  const { id = '' } = useParams();
  const { data, error, loading, reload } = useResource<ContractDetail>(() => api.contracts.get(id), [id]);

  const [busy, setBusy] = useState<null | 'pdf' | 'resend' | 'resend-signed' | 'cancel'>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [link, setLink] = useState<ResendLinkResult | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reading, setReading] = useState(false);

  const back = (
    <Link to="/contracts" className="btn btn--secondary">
      <Icon name="arrowLeft" size={18} />
      <span>Tous les contrats</span>
    </Link>
  );

  if (loading && !data) {
    return (
      <div className="center-block">
        <Spinner label="Chargement du contrat" />
      </div>
    );
  }

  if (error || !data) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <>
        <PageHeader title={notFound ? 'Contrat introuvable' : 'Contrat'} actions={back} />
        <Card>
          <Notice
            tone="error"
            title={notFound ? "Ce contrat n'existe pas" : 'Impossible de charger le contrat'}
            action={
              notFound ? undefined : (
                <button type="button" className="link-btn" onClick={reload}>
                  Réessayer
                </button>
              )
            }
          >
            {notFound ? "Il a peut-être été supprimé, ou l'adresse est incorrecte." : describeError(error).message}
          </Notice>
        </Card>
      </>
    );
  }

  const c = data;
  const open = c.status === 'PENDING' || c.status === 'EXPIRED';

  async function run(kind: NonNullable<typeof busy>, task: () => Promise<void>) {
    setBusy(kind);
    setProblem(null);
    setFlash(null);
    try {
      await task();
    } catch (err) {
      setProblem(describeError(err).message);
    } finally {
      setBusy(null);
    }
  }

  const downloadPdf = () =>
    run('pdf', async () => {
      const blob = await api.contracts.pdf(c.id);
      saveBlob(blob, `contrat-${c.reference}${c.status === 'SIGNED' ? '-signe' : '-apercu'}.pdf`);
    });

  const resendLink = () =>
    run('resend', async () => {
      const res = await api.contracts.resend(c.id);
      setLink(res);
      setFlash(
        res.emailed
          ? `Un nouveau lien a été envoyé à ${res.recipientEmail}. L'ancien lien ne fonctionne plus.`
          : "Nouveau lien créé, mais l'e-mail n'a pas pu partir : copiez le lien ci-dessous et transmettez-le vous-même.",
      );
      reload();
    });

  const resendSigned = () =>
    run('resend-signed', async () => {
      const res = await api.contracts.resendSigned(c.id);
      setFlash(`Le contrat signé a été renvoyé à ${res.recipientEmail}.`);
      reload();
    });

  const cancel = () =>
    run('cancel', async () => {
      await api.contracts.cancel(c.id);
      setCancelOpen(false);
      setFlash('Contrat annulé : son lien de signature ne fonctionne plus.');
      reload();
    });

  return (
    <>
      <PageHeader title={`Contrat ${c.reference}`} description={undefined} actions={back} />

      <div className="stack">
        <Card className="company-hero">
          <CompanyMark name={c.client.name} logoUrl={c.client.logoUrl} color={c.client.primaryColor} size={64} />
          <div className="company-hero__main">
            <div className="company-hero__line">
              <span className="company-card__code">{c.reference}</span>
              <Pill tone={CONTRACT_TONE[c.status]} icon={c.status === 'SIGNED' ? 'check' : undefined}>
                {contractStatusLabel(c.status)}
              </Pill>
              <Pill tone="brand">{CONTRACT_KIND_LABEL[c.type]}</Pill>
            </div>
            <p className="company-hero__meta">
              {c.client.name} · {termsHeadline(c.type, c.terms)}
            </p>
            <Link className="company-hero__portal" to={`/companies/${c.client.id}`}>
              <Icon name="building" size={15} />
              Ouvrir la fiche de la société
            </Link>
          </div>
          <div className="company-hero__actions">
            <Button icon="download" busy={busy === 'pdf'} onClick={() => void downloadPdf()}>
              {c.status === 'SIGNED' ? 'Contrat signé (PDF)' : 'Aperçu (PDF)'}
            </Button>
          </div>
        </Card>

        {flash ? <Notice tone="ok">{flash}</Notice> : null}
        {problem ? <Notice tone="error">{problem}</Notice> : null}

        <div className="detail-grid">
          <Card as="section" className="section-card" aria-labelledby="ct-sig">
            <header className="section-card__head">
              <span className="section-card__icon">
                <Icon name={c.status === 'SIGNED' ? 'check' : 'pen'} size={20} />
              </span>
              <div className="section-card__title">
                <h2 id="ct-sig">Signature</h2>
                <p>{c.status === 'SIGNED' ? 'Signé électroniquement par le client.' : 'En attente de la signature du client.'}</p>
              </div>
            </header>

            <dl className="kv kv--grid">
              <div className="kv__row">
                <dt>Destinataire</dt>
                <dd>
                  {c.recipientName ? `${c.recipientName} — ` : ''}
                  {c.recipientEmail}
                </dd>
              </div>
              {c.status === 'SIGNED' ? (
                <>
                  <div className="kv__row kv__row--half">
                    <dt>Signataire</dt>
                    <dd>{c.signerName}</dd>
                  </div>
                  <div className="kv__row kv__row--half">
                    <dt>Signé le</dt>
                    <dd>{formatDateTime(c.signedAt)}</dd>
                  </div>
                  <div className="kv__row kv__row--half">
                    <dt>Adresse IP</dt>
                    <dd className="mono">{c.signerIp ?? '—'}</dd>
                  </div>
                  <div className="kv__row kv__row--half">
                    <dt>Contrat envoyé par e-mail</dt>
                    <dd>{c.signedMailedAt ? formatDateTime(c.signedMailedAt) : 'Non confirmé'}</dd>
                  </div>
                  <div className="kv__row">
                    <dt>Empreinte SHA-256 du contrat</dt>
                    <dd className="mono ct-hash">{c.contentHash}</dd>
                  </div>
                </>
              ) : (
                <>
                  <div className="kv__row kv__row--half">
                    <dt>Dernier envoi</dt>
                    <dd>{c.sentAt ? formatDateTime(c.sentAt) : 'Pas encore envoyé'}</dd>
                  </div>
                  <div className="kv__row kv__row--half">
                    <dt>Lien valable jusqu'au</dt>
                    <dd>{formatDay(c.tokenExpiresAt)}</dd>
                  </div>
                  {c.status === 'CANCELLED' && c.cancelReason ? (
                    <div className="kv__row">
                      <dt>Motif d'annulation</dt>
                      <dd>{c.cancelReason}</dd>
                    </div>
                  ) : null}
                </>
              )}
            </dl>

            {c.status === 'SIGNED' && c.signatureImage ? (
              <div className="ct-signature">
                <span>Signature</span>
                <img src={c.signatureImage} alt={`Signature de ${c.signerName ?? 'le signataire'}`} />
              </div>
            ) : null}

            {link?.signUrl ? (
              <div className="ct-link">
                <span>Nouveau lien de signature</span>
                <div className="inline-copy">
                  <span className="mono ct-link__url">{link.signUrl}</span>
                  <CopyButton value={link.signUrl} />
                </div>
              </div>
            ) : null}

            <div className="form-actions form-actions--start">
              {c.status === 'SIGNED' ? (
                <Button variant="secondary" icon="mail" busy={busy === 'resend-signed'} onClick={() => void resendSigned()}>
                  Renvoyer le contrat signé
                </Button>
              ) : null}
              {open ? (
                <>
                  <Button icon="mail" busy={busy === 'resend'} onClick={() => void resendLink()}>
                    {c.status === 'EXPIRED' ? 'Envoyer un nouveau lien' : 'Renvoyer le lien'}
                  </Button>
                  <Button variant="secondary" icon="close" className="btn--danger-outline" onClick={() => setCancelOpen(true)}>
                    Annuler le contrat
                  </Button>
                </>
              ) : null}
            </div>
          </Card>

          <Card as="section" className="section-card" aria-labelledby="ct-terms">
            <header className="section-card__head">
              <span className="section-card__icon">
                <Icon name="file" size={20} />
              </span>
              <div className="section-card__title">
                <h2 id="ct-terms">Conditions</h2>
                <p>
                  Figées à l'émission (modèle v{c.version}) : un contrat émis ne change plus.
                </p>
              </div>
            </header>
            <dl className="kv kv--grid">
              {c.content.summary.map((row) => (
                <div className="kv__row" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            <div className="form-actions form-actions--start">
              <Button variant="secondary" icon="file" onClick={() => setReading((r) => !r)} aria-expanded={reading}>
                {reading ? 'Masquer le texte' : 'Lire le texte du contrat'}
              </Button>
            </div>
          </Card>
        </div>

        {reading ? (
          <Card className="section-card sign-text">
            {c.content.preamble.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {c.content.articles.map((a) => (
              <section key={a.number}>
                <h3>
                  Article {a.number} — {a.title}
                </h3>
                {a.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </section>
            ))}
          </Card>
        ) : null}
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Annuler ce contrat ?"
        confirmLabel="Annuler le contrat"
        cancelLabel="Garder le contrat"
        tone="danger"
        busy={busy === 'cancel'}
        onConfirm={() => void cancel()}
        onCancel={() => setCancelOpen(false)}
      >
        Le lien de signature envoyé à {c.recipientEmail} cessera de fonctionner. Vous pourrez émettre un nouveau contrat depuis la
        fiche de la société.
      </ConfirmDialog>
    </>
  );
}
