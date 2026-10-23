// src/pages/agents/AgentCreatePage.tsx
// Ajout d'un agent à une agence de la société. Le serveur génère le mot de passe temporaire,
// affiché une seule fois.

import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { CreateAgentResult } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { CredentialsCard } from '../../components/CredentialsCard';
import { SelectField } from '../../components/form';
import { Button, Card, Field, Notice, PageHeader, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { emptyAgentForm, validateAgentForm, type AgentForm, type AgentFormErrors } from '../../lib/agencyRules';
import { describeError } from '../../lib/errors';
import { useResource } from '../../lib/useResource';
import { fullName } from '../../lib/userRules';

export default function AgentCreatePage() {
  const [params] = useSearchParams();
  const agencies = useResource(() => api.agencies.list(), []);
  const [form, setForm] = useState<AgentForm>(() => emptyAgentForm(params.get('agency') ?? ''));
  const [errors, setErrors] = useState<AgentFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateAgentResult | null>(null);

  const usable = (agencies.data ?? []).filter((a) => a.isActive);
  const agency = usable.find((a) => a.id === form.agencyId);

  function set<K extends keyof AgentForm>(key: K, value: AgentForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    const problems = validateAgentForm(form);
    setErrors(problems);
    if (Object.keys(problems).length > 0) {
      setFormError('Corrigez les champs signalés avant de continuer.');
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      const phone = form.phone.trim();
      const result = await api.agents.create({
        agencyId: form.agencyId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        ...(phone ? { phone } : {}),
        ...(form.makeManager ? { makeManager: true } : {}),
      });
      setCreated(result);
    } catch (err) {
      setFormError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setForm(emptyAgentForm(form.agencyId));
    setErrors({});
    setFormError(null);
    setCreated(null);
  }

  if (created) {
    return (
      <>
        <PageHeader
          title="Agent créé"
          description={`${fullName(created.agent)} travaille à ${created.agent.agency?.name ?? 'son agence'}.`}
        />
        <div className="stack">
          <CredentialsCard
            title="Accès de l'agent"
            intro="Transmettez-lui ces identifiants par un canal sûr. Un email avec son mot de passe temporaire lui a aussi été envoyé."
            rows={[
              ...(created.agent.agency ? [{ label: 'Agence', value: created.agent.agency.name }] : []),
              { label: 'Identifiant', value: created.agent.email, copy: true },
            ]}
            password={created.generatedPassword}
          />
          <div className="form-actions form-actions--start">
            <Link to="/agents" className="btn btn--primary">
              <Icon name="users" size={18} />
              <span>Voir les agents</span>
            </Link>
            <Button variant="secondary" icon="plus" onClick={reset}>
              Ajouter un autre agent
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Nouvel agent"
        description="Choisissez l'agence où il travaille. Son compte est créé avec un mot de passe temporaire."
        actions={
          <Link to="/agents" className="btn btn--secondary">
            <Icon name="arrowLeft" size={18} />
            <span>Retour aux agents</span>
          </Link>
        }
      />

      {agencies.loading && !agencies.data ? (
        <div className="center-block">
          <Spinner label="Chargement des agences" />
        </div>
      ) : agencies.error ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les agences"
            action={
              <button type="button" className="link-btn" onClick={agencies.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(agencies.error).message}
          </Notice>
        </Card>
      ) : usable.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="building" size={26} />
          </span>
          <h2>Aucune agence active</h2>
          <p>Un agent travaille toujours dans une agence. Créez d'abord l'agence.</p>
          <Link to="/agencies/new" className="btn btn--primary">
            <Icon name="plus" size={18} />
            <span>Créer une agence</span>
          </Link>
        </Card>
      ) : (
        <form onSubmit={(e) => void submit(e)} noValidate className="stack">
          {formError ? <Notice tone="error">{formError}</Notice> : null}

          <Card className="section-card">
            <header className="section-card__head">
              <span className="section-card__icon">
                <Icon name="user" size={20} />
              </span>
              <div className="section-card__title">
                <h2>Le compte</h2>
                <p>Il pourra déposer, retirer et envoyer de l'argent pour vos clients.</p>
              </div>
            </header>
            <div className="form-grid">
              <div className="form-grid__wide">
                <SelectField
                  id="ng-agency"
                  label="Agence"
                  value={form.agencyId}
                  onChange={(e) => set('agencyId', e.target.value)}
                  options={usable.map((a) => ({ value: a.id, label: `${a.name} — ${a.city}` }))}
                  placeholder="Choisir une agence"
                  error={errors.agencyId}
                />
              </div>
              <Field
                id="ng-first"
                label="Prénom"
                className="form-grid__half"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                error={errors.firstName}
                maxLength={80}
                autoComplete="off"
              />
              <Field
                id="ng-last"
                label="Nom"
                className="form-grid__half"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                error={errors.lastName}
                maxLength={80}
                autoComplete="off"
              />
              <Field
                id="ng-email"
                type="email"
                label="Adresse email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                error={errors.email}
                hint="Ce sera son identifiant de connexion."
                autoComplete="off"
              />
              <Field
                id="ng-phone"
                type="tel"
                label="Téléphone"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                error={errors.phone}
                hint="Facultatif. Format international, exemple : +224620000000."
                autoComplete="off"
              />
              <div className="form-grid__wide">
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={form.makeManager}
                    onChange={(e) => set('makeManager', e.target.checked)}
                  />
                  <span>
                    Nommer responsable{agency ? ` de ${agency.name}` : ' de l’agence'}
                    <small>Le responsable actuel, s’il y en a un, ne l’est plus.</small>
                  </span>
                </label>
              </div>
            </div>
          </Card>

          <div className="form-actions form-actions--start">
            <Button type="submit" busy={busy} icon="check">
              Créer l'agent
            </Button>
            <Link to="/agents" className="btn btn--ghost">
              Annuler
            </Link>
          </div>
        </form>
      )}
    </>
  );
}
