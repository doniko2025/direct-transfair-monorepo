// src/pages/agencies/AgencyCreatePage.tsx
// Création d'une agence. Le serveur crée dans la foulée le compte du responsable
// et génère son mot de passe temporaire, affiché une seule fois.

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { CreateAgencyResult } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { CredentialsCard } from '../../components/CredentialsCard';
import { SelectField } from '../../components/form';
import { Button, Field, Card, Notice, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import {
  AGENCY_TYPE_OPTIONS,
  currencyOfCountry,
  emptyAgencyForm,
  validateAgencyForm,
  type AgencyForm,
  type AgencyFormErrors,
} from '../../lib/agencyRules';
import { COUNTRIES } from '../../lib/countries';
import { describeError } from '../../lib/errors';
import { fullName } from '../../lib/userRules';

export default function AgencyCreatePage() {
  const [form, setForm] = useState<AgencyForm>(emptyAgencyForm);
  const [errors, setErrors] = useState<AgencyFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateAgencyResult | null>(null);

  function set<K extends keyof AgencyForm>(key: K, value: AgencyForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    const problems = validateAgencyForm(form);
    setErrors(problems);
    if (Object.keys(problems).length > 0) {
      setFormError('Corrigez les champs signalés avant de continuer.');
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      const code = form.code.trim().toUpperCase();
      const phone = form.phone.trim();
      const result = await api.agencies.create({
        name: form.name.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        country: form.country,
        type: form.type,
        email: form.email.trim().toLowerCase(),
        adminFirstName: form.adminFirstName.trim(),
        adminLastName: form.adminLastName.trim(),
        ...(code ? { code } : {}),
        ...(phone ? { phone } : {}),
      });
      setCreated(result);
    } catch (err) {
      setFormError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setForm(emptyAgencyForm());
    setErrors({});
    setFormError(null);
    setCreated(null);
  }

  if (created) {
    const manager = fullName(created.agent);
    return (
      <>
        <PageHeader title="Agence créée" description={`${created.agency.name} est prête, avec ${manager} comme responsable.`} />
        <div className="stack">
          {created.generatedPassword ? (
            <CredentialsCard
              title="Accès du responsable"
              intro="Transmettez-lui ces identifiants par un canal sûr. Un email avec son mot de passe temporaire lui a aussi été envoyé."
              rows={[
                { label: 'Agence', value: created.agency.name },
                { label: 'Identifiant', value: created.agent.email, copy: true },
              ]}
              password={created.generatedPassword}
            />
          ) : (
            <Notice tone="ok" title="Compte du responsable créé">
              {manager} peut se connecter avec {created.agent.email}.
            </Notice>
          )}
          <div className="form-actions form-actions--start">
            <Link to={`/agencies/${encodeURIComponent(created.agency.id)}`} className="btn btn--primary">
              <Icon name="building" size={18} />
              <span>Ouvrir l'agence</span>
            </Link>
            <Button variant="secondary" icon="plus" onClick={reset}>
              Créer une autre agence
            </Button>
          </div>
        </div>
      </>
    );
  }

  const currency = currencyOfCountry(form.country);

  return (
    <>
      <PageHeader
        title="Nouvelle agence"
        description="L'agence reçoit une caisse dans la devise de son pays et un responsable qui pourra se connecter."
        actions={
          <Link to="/agencies" className="btn btn--secondary">
            <Icon name="arrowLeft" size={18} />
            <span>Retour aux agences</span>
          </Link>
        }
      />

      <form onSubmit={(e) => void submit(e)} noValidate className="stack">
        {formError ? <Notice tone="error">{formError}</Notice> : null}

        <Card className="section-card">
          <header className="section-card__head">
            <span className="section-card__icon">
              <Icon name="building" size={20} />
            </span>
            <div className="section-card__title">
              <h2>L'agence</h2>
              <p>Où elle se trouve et comment la reconnaître.</p>
            </div>
          </header>
          <div className="form-grid">
            <div className="form-grid__wide">
              <Field
                id="ag-name"
                label="Nom de l'agence"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                error={errors.name}
                maxLength={120}
                autoComplete="off"
              />
            </div>
            <Field
              id="ag-city"
              label="Ville"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              error={errors.city}
              maxLength={80}
              autoComplete="off"
            />
            <SelectField
              id="ag-country"
              label="Pays"
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
              options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
              placeholder="Choisir un pays"
              hint={currency ? `La caisse de l'agence sera en ${currency}. Si le pays change plus tard, la caisse principale passera dans la devise du nouveau pays.` : undefined}
              error={errors.country}
            />
            <div className="form-grid__wide">
              <Field
                id="ag-address"
                label="Adresse"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                error={errors.address}
                maxLength={200}
                autoComplete="off"
              />
            </div>
            <SelectField
              id="ag-type"
              label="Type"
              value={form.type}
              onChange={(e) => set('type', e.target.value as AgencyForm['type'])}
              options={AGENCY_TYPE_OPTIONS}
              hint="Une filiale appartient à votre société ; un partenaire est un point de service tiers."
            />
            <Field
              id="ag-code"
              label="Code agence"
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              error={errors.code}
              hint="Facultatif. Exemple : CKY-01."
              maxLength={16}
              autoComplete="off"
            />
          </div>
        </Card>

        <Card className="section-card">
          <header className="section-card__head">
            <span className="section-card__icon">
              <Icon name="user" size={20} />
            </span>
            <div className="section-card__title">
              <h2>Le responsable</h2>
              <p>Son compte est créé avec l'agence. Il gère la caisse et l'équipe.</p>
            </div>
          </header>
          <div className="form-grid">
            <Field
              id="ag-first"
              label="Prénom"
              className="form-grid__half"
              value={form.adminFirstName}
              onChange={(e) => set('adminFirstName', e.target.value)}
              error={errors.adminFirstName}
              maxLength={80}
              autoComplete="off"
            />
            <Field
              id="ag-last"
              label="Nom"
              className="form-grid__half"
              value={form.adminLastName}
              onChange={(e) => set('adminLastName', e.target.value)}
              error={errors.adminLastName}
              maxLength={80}
              autoComplete="off"
            />
            <Field
              id="ag-email"
              type="email"
              label="Adresse email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              error={errors.email}
              hint="Ce sera son identifiant de connexion."
              autoComplete="off"
            />
            <Field
              id="ag-phone"
              type="tel"
              label="Téléphone"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              error={errors.phone}
              hint="Facultatif. Format international, exemple : +224620000000."
              autoComplete="off"
            />
          </div>
        </Card>

        <div className="form-actions form-actions--start">
          <Button type="submit" busy={busy} icon="check">
            Créer l'agence
          </Button>
          <Link to="/agencies" className="btn btn--ghost">
            Annuler
          </Link>
        </div>
      </form>
    </>
  );
}
