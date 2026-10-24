// apps/web-admin/src/pages/signature/SignaturePage.tsx
// Page PUBLIQUE de signature du contrat (aucune connexion) : /signature/:token — le jeton du lien reçu par e-mail fait foi.
// Pensée d'abord pour le téléphone : on lit le contrat, on coche « lu et approuvé », on saisit son nom, on dessine sa
// signature au doigt, on valide. Le contrat signé est ensuite envoyé par e-mail.

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, buildApiBase, type PublicContract } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { SignaturePad } from '../../components/SignaturePad';
import { Button, Card, Field, Notice, Spinner } from '../../components/ui';
import { API_URL, PLATFORM_LOGO_URL, PLATFORM_NAME } from '../../config';
import { api } from '../../lib/api';
import { formatDateTime, formatDay } from '../../lib/contractRules';
import { describeError } from '../../lib/errors';
import { useResource } from '../../lib/useResource';

function pdfHref(token: string, download = false): string {
  return `${buildApiBase(API_URL)}${api.contracts.publicPdfPath(token, download)}`;
}

export default function SignaturePage() {
  const { token = '' } = useParams();
  const { data, error, loading, reload } = useResource<PublicContract>(() => api.contracts.publicView(token), [token]);

  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [justSigned, setJustSigned] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const signerName = nameTouched ? name : (data?.recipientName ?? '');
  const ready = Boolean(data?.canSign && accepted && signature && signerName.trim().length >= 3);

  const missing = useMemo(() => {
    const m: string[] = [];
    if (signerName.trim().length < 3) m.push('votre nom complet');
    if (!signature) m.push('votre signature');
    if (!accepted) m.push('la case « lu et approuvé »');
    return m;
  }, [signerName, signature, accepted]);

  async function submit() {
    if (!data || !ready || busy || !signature) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await api.contracts.publicSign(token, { signerName: signerName.trim(), signature, accept: true });
      setJustSigned(res.signedAt);
      reload();
    } catch (err) {
      setProblem(describeError(err).message);
      if (err instanceof ApiError && (err.status === 409 || err.status === 410)) reload();
    } finally {
      setBusy(false);
    }
  }

  const content = data?.content;
  const signedAt = justSigned ?? data?.signedAt ?? null;

  return (
    <div className="sign-page">
      <header className="sign-page__bar">
        <img src={PLATFORM_LOGO_URL} alt="" width={40} height={40} className="sign-page__logo" />
        <div>
          <strong>{PLATFORM_NAME}</strong>
          <span>Signature électronique de contrat</span>
        </div>
      </header>

      <main className="sign-page__main">
        {loading && !data ? (
          <div className="center-block">
            <Spinner label="Chargement du contrat" />
          </div>
        ) : error || !data || !content ? (
          <Card className="empty">
            <span className="empty__icon">
              <Icon name="alert" size={26} />
            </span>
            <h2>{error instanceof ApiError && error.status === 404 ? 'Lien de signature invalide' : 'Contrat indisponible'}</h2>
            <p>
              {error instanceof ApiError && error.status === 404
                ? "Ce lien n'est pas reconnu. Vérifiez que vous avez ouvert l'adresse complète reçue par e-mail, ou demandez l'envoi d'un nouveau lien."
                : describeError(error).message}
            </p>
            <Button variant="secondary" icon="refresh" onClick={reload}>
              Réessayer
            </Button>
          </Card>
        ) : (
          <div className="stack">
            <Card className="sign-hero">
              <span className="sign-hero__icon">
                <Icon name={data.status === 'SIGNED' ? 'check' : 'pen'} size={24} />
              </span>
              <div>
                <p className="sign-hero__ref">Réf. {data.reference}</p>
                <h1>{content.title}</h1>
                <p className="sign-hero__sub">{content.subtitle}</p>
                <p className="sign-hero__for">
                  Société : <strong>{data.companyName}</strong>
                </p>
              </div>
            </Card>

            {data.status === 'SIGNED' ? (
              <Card className="sign-done">
                <Notice tone="ok" title="Ce contrat est signé">
                  {signedAt ? `Signé le ${formatDateTime(signedAt)}${data.signerName ? ` par ${data.signerName}` : ''}. ` : ''}
                  Un exemplaire signé a été envoyé à {data.recipientEmail}.
                </Notice>
                <div className="sign-done__actions">
                  <a className="btn btn--primary" href={pdfHref(token, true)}>
                    <Icon name="download" size={18} />
                    <span>Télécharger le contrat signé (PDF)</span>
                  </a>
                </div>
              </Card>
            ) : data.status === 'EXPIRED' ? (
              <Notice tone="error" title="Ce lien de signature a expiré">
                Demandez à votre interlocuteur de vous envoyer un nouveau lien.
              </Notice>
            ) : data.status === 'CANCELLED' ? (
              <Notice tone="error" title="Ce contrat a été annulé">
                Contactez votre interlocuteur pour en obtenir un nouveau.
              </Notice>
            ) : null}

            <Card className="section-card">
              <header className="section-card__head">
                <span className="section-card__icon">
                  <Icon name="file" size={20} />
                </span>
                <div className="section-card__title">
                  <h2>L'essentiel du contrat</h2>
                  <p>Les parties et les conditions principales.</p>
                </div>
              </header>

              <div className="sign-parties">
                {[content.provider, content.customer].map((p) => (
                  <div key={p.role} className="sign-party">
                    <span className="sign-party__role">{p.role}</span>
                    <strong>{p.name}</strong>
                    {p.lines.map((l) => (
                      <span key={l}>{l}</span>
                    ))}
                    <em>{p.representative}</em>
                  </div>
                ))}
              </div>

              <dl className="kv">
                {content.summary.map((row) => (
                  <div className="kv__row" key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="sign-links">
                <button type="button" className="btn btn--secondary" onClick={() => setReading((r) => !r)} aria-expanded={reading}>
                  <Icon name="file" size={18} />
                  <span>{reading ? 'Masquer le texte du contrat' : 'Lire le contrat en entier'}</span>
                </button>
                <a className="btn btn--ghost" href={pdfHref(token)} target="_blank" rel="noopener noreferrer">
                  <Icon name="external" size={18} />
                  <span>Ouvrir le PDF</span>
                </a>
              </div>
            </Card>

            {reading ? (
              <Card className="section-card sign-text">
                {content.preamble.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {content.articles.map((a) => (
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

            {data.canSign ? (
              <Card className="section-card sign-form">
                <header className="section-card__head">
                  <span className="section-card__icon">
                    <Icon name="pen" size={20} />
                  </span>
                  <div className="section-card__title">
                    <h2>Signer le contrat</h2>
                    <p>
                      Lien valable jusqu'au {formatDay(data.expiresAt)}. Votre signature a la même valeur qu'une signature
                      manuscrite.
                    </p>
                  </div>
                </header>

                <div className="stack stack--tight">
                  <Field
                    id="sign-name"
                    label="Votre nom complet"
                    value={signerName}
                    onChange={(e) => {
                      setNameTouched(true);
                      setName(e.target.value);
                    }}
                    maxLength={120}
                    autoComplete="name"
                    disabled={busy}
                    hint={`Vous signez au nom de ${data.companyName}.`}
                  />

                  <div className="field">
                    <label id="sign-pad-label">Votre signature</label>
                    <SignaturePad onChange={setSignature} disabled={busy} />
                  </div>

                  <label className="sign-accept">
                    <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} disabled={busy} />
                    <span>
                      J'ai lu le contrat <strong>{data.reference}</strong> et j'en approuve l'intégralité des clauses. « Lu et
                      approuvé ».
                    </span>
                  </label>

                  {problem ? <Notice tone="error">{problem}</Notice> : null}

                  <Button icon="check" busy={busy} disabled={!ready} onClick={() => void submit()} block>
                    Signer le contrat
                  </Button>
                  {!ready && !busy ? <p className="field__hint sign-missing">Il manque : {missing.join(', ')}.</p> : null}
                </div>
              </Card>
            ) : null}
          </div>
        )}
      </main>

      <footer className="sign-page__foot">
        <Icon name="shield" size={16} />
        <span>Lien personnel et sécurisé. Ne le partagez pas.</span>
      </footer>
    </div>
  );
}
