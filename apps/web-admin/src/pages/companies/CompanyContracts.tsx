// apps/web-admin/src/pages/companies/CompanyContracts.tsx
// Carte « Contrats » de la fiche société : ses contrats (signés, en attente…) et l'émission d'un nouveau contrat
// (location ou achat) pour une société qui n'en a pas encore — par exemple créée avant l'arrivée des contrats.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ContractKind, IssueContractResult } from '@direct-transfair/shared';
import { ContractTermsFields } from '../../components/ContractTermsFields';
import { CopyButton, SelectField } from '../../components/form';
import { Icon } from '../../components/Icon';
import { Button, Card, Notice, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import {
  CONTRACT_TONE,
  contractStatusLabel,
  formatDay,
  initialTermsForm,
  termsHeadline,
  toTermsInput,
  validateTerms,
  type ContractTermsForm,
} from '../../lib/contractRules';
import { describeError } from '../../lib/errors';
import { useResource } from '../../lib/useResource';

const KIND_OPTIONS = [
  { value: 'RENTAL', label: 'Location de l’application' },
  { value: 'PURCHASE', label: 'Achat de l’application' },
];

export function CompanyContracts({
  companyId,
  defaultKind,
  defaultEmail,
}: {
  companyId: number;
  defaultKind: ContractKind;
  defaultEmail?: string | null;
}) {
  const { data, error, loading, reload } = useResource(() => api.contracts.list({ clientId: companyId }), [companyId]);
  const [issuing, setIssuing] = useState(false);
  const [kind, setKind] = useState<ContractKind>(defaultKind);
  const [terms, setTerms] = useState<ContractTermsForm>(() => initialTermsForm());
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<IssueContractResult | null>(null);

  const contracts = data ?? [];
  const hasPending = contracts.some((c) => c.status === 'PENDING');

  async function issue() {
    const e = validateTerms(terms, kind);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await api.contracts.issue({ clientId: companyId, kind, terms: toTermsInput(terms, kind) });
      setResult(res);
      setIssuing(false);
      setTerms(initialTermsForm());
      reload();
    } catch (err) {
      setProblem(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" aria-labelledby="contracts-title" className="section-card">
      <header className="section-card__head">
        <span className="section-card__icon">
          <Icon name="file" size={20} />
        </span>
        <div className="section-card__title">
          <h2 id="contracts-title">Contrats</h2>
          <p>Location ou achat de l'application, signés en ligne par le patron de la société.</p>
        </div>
        {!issuing && !hasPending ? (
          <Button variant="ghost" icon="plus" onClick={() => setIssuing(true)}>
            Émettre un contrat
          </Button>
        ) : null}
      </header>

      {result ? (
        <div className="stack stack--tight">
          <Notice tone="ok" title={`Contrat ${result.reference} émis`}>
            Un e-mail avec le lien de signature a été envoyé à {result.recipientEmail}.
          </Notice>
          {result.signUrl ? (
            <div className="ct-link">
              <span>Lien de signature (à copier si l'e-mail n'arrive pas)</span>
              <div className="inline-copy">
                <span className="mono ct-link__url">{result.signUrl}</span>
                <CopyButton value={result.signUrl} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {issuing ? (
        <div className="stack stack--tight">
          <SelectField
            id="ct-kind"
            label="Type de contrat"
            value={kind}
            onChange={(e) => setKind(e.target.value as ContractKind)}
            options={KIND_OPTIONS}
            hint={defaultEmail ? `Le lien de signature sera envoyé à ${defaultEmail}.` : undefined}
          />
          <ContractTermsFields
            idPrefix="ct"
            kind={kind}
            value={terms}
            errors={errors}
            onChange={(patch) => setTerms((t) => ({ ...t, ...patch }))}
          />
          {problem ? <Notice tone="error">{problem}</Notice> : null}
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setIssuing(false)} disabled={busy}>
              Annuler
            </Button>
            <Button icon="mail" busy={busy} onClick={() => void issue()}>
              Émettre et envoyer pour signature
            </Button>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="center-block center-block--sm">
          <Spinner label="Chargement des contrats" />
        </div>
      ) : error ? (
        <Notice
          tone="error"
          action={
            <button type="button" className="link-btn" onClick={reload}>
              Réessayer
            </button>
          }
        >
          {describeError(error).message}
        </Notice>
      ) : contracts.length === 0 ? (
        issuing ? null : <p className="muted">Aucun contrat pour cette société.</p>
      ) : (
        <ul className="people">
          {contracts.map((c) => (
            <li key={c.id}>
              <Link to={`/contracts/${c.id}`} className="person ct-row">
                <span className="avatar" aria-hidden="true">
                  <Icon name="file" size={18} />
                </span>
                <div className="person__text">
                  <strong>
                    {c.reference} · {termsHeadline(c.type, c.terms)}
                  </strong>
                  <span>
                    {c.status === 'SIGNED'
                      ? `Signé le ${formatDay(c.signedAt)} par ${c.signerName ?? ''}`
                      : `Créé le ${formatDay(c.createdAt)}`}
                  </span>
                </div>
                <Pill tone={CONTRACT_TONE[c.status]}>{contractStatusLabel(c.status)}</Pill>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
