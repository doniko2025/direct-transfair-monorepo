// src/pages/companies/CompanyCreatePage.tsx
// Création d'une société de transfert + son administrateur (POST /clients).
// Le mot de passe temporaire est généré ici (tirage cryptographique) et n'est affiché
// qu'une seule fois, à l'écran de confirmation : il n'est ni stocké ni relisible ensuite.

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CreateCompanyInput, CreateCompanyResult, SubscriptionType } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { ColorField, CopyButton, SelectField } from '../../components/form';
import { Button, Card, Field, Notice, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import {
  COMPANY_CODE,
  DOMAIN,
  EMAIL,
  HEX_COLOR,
  SUBDOMAIN,
  TYPE_LABEL,
  suggestCode,
} from '../../lib/companyRules';
import { COUNTRIES } from '../../lib/countries';
import { describeError } from '../../lib/errors';
import { generateTempPassword } from '../../lib/password';

interface Form {
  name: string;
  code: string;
  activitySector: string;
  ownerCountry: string;
  subscriptionType: SubscriptionType;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
  contactPhone: string;
  subdomain: string;
  customDomain: string;
  primaryColor: string;
  secondaryColor: string;
}

type Errors = Partial<Record<keyof Form, string>>;

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: `${c.name} (${c.currency})` }));
const TYPE_OPTIONS = Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }));

function initialForm(): Form {
  return {
    name: '',
    code: '',
    activitySector: '',
    ownerCountry: '',
    subscriptionType: 'RENTAL',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    adminPassword: generateTempPassword(),
    contactPhone: '',
    subdomain: '',
    customDomain: '',
    primaryColor: '#059669',
    secondaryColor: '#10B981',
  };
}

function validate(f: Form): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = 'Le nom est obligatoire.';
  if (!COMPANY_CODE.test(f.code)) e.code = 'Le code doit faire 3 à 12 caractères : lettres majuscules et chiffres.';
  if (!f.ownerCountry) e.ownerCountry = 'Choisissez le pays : il détermine la devise par défaut.';
  if (!f.adminFirstName.trim()) e.adminFirstName = 'Le prénom est obligatoire.';
  if (!f.adminLastName.trim()) e.adminLastName = 'Le nom est obligatoire.';
  if (!EMAIL.test(f.adminEmail.trim())) e.adminEmail = 'Adresse email invalide.';
  if (f.adminPassword.length < 10) e.adminPassword = 'Au moins 10 caractères.';
  if (f.subdomain && !SUBDOMAIN.test(f.subdomain)) {
    e.subdomain = 'Minuscules, chiffres et tirets, 3 à 32 caractères.';
  }
  if (f.customDomain && !DOMAIN.test(f.customDomain)) e.customDomain = 'Domaine invalide. Exemple : admin.ma-societe.com';
  if (!HEX_COLOR.test(f.primaryColor)) e.primaryColor = 'Code couleur invalide, exemple : #059669.';
  if (!HEX_COLOR.test(f.secondaryColor)) e.secondaryColor = 'Code couleur invalide, exemple : #10B981.';
  return e;
}

function toInput(f: Form): CreateCompanyInput {
  const input: CreateCompanyInput = {
    code: f.code,
    name: f.name.trim(),
    adminEmail: f.adminEmail.trim(),
    adminFirstName: f.adminFirstName.trim(),
    adminLastName: f.adminLastName.trim(),
    adminPassword: f.adminPassword,
    ownerCountry: f.ownerCountry,
    subscriptionType: f.subscriptionType,
    primaryColor: f.primaryColor,
    secondaryColor: f.secondaryColor,
  };
  if (f.activitySector.trim()) input.activitySector = f.activitySector.trim();
  if (f.contactPhone.trim()) input.contactPhone = f.contactPhone.trim();
  if (f.subdomain) input.subdomain = f.subdomain;
  if (f.customDomain) input.customDomain = f.customDomain;
  return input;
}

interface Created {
  result: CreateCompanyResult;
  email: string;
  password: string;
  portal: string | null;
}

function CreatedView({ created, onAnother }: { created: Created; onAnother: () => void }) {
  const navigate = useNavigate();
  const { client } = created.result;
  const [shown, setShown] = useState(false);

  return (
    <>
      <PageHeader title="Société créée" description={`« ${client.name} » est prête. Transmettez ses accès à l'administrateur.`} />
      <div className="stack">
        <Card className="credentials">
          <header className="credentials__head">
            <span className="section-card__icon">
              <Icon name="check" size={20} />
            </span>
            <div>
              <h2>Accès de l'administrateur</h2>
              <p>
                Un email de bienvenue lui est envoyé. S'il n'arrive pas, transmettez-lui ces identifiants
                par un canal sûr.
              </p>
            </div>
          </header>

          <dl className="kv">
            <div className="kv__row">
              <dt>Code société</dt>
              <dd className="mono">{client.code}</dd>
            </div>
            {created.portal ? (
              <div className="kv__row">
                <dt>Portail</dt>
                <dd>{created.portal}</dd>
              </div>
            ) : null}
            <div className="kv__row">
              <dt>Identifiant</dt>
              <dd className="inline-copy">
                <span className="mono">{created.email}</span>
                <CopyButton value={created.email} />
              </dd>
            </div>
            <div className="kv__row">
              <dt>Mot de passe temporaire</dt>
              <dd className="inline-copy">
                <span className="mono">{shown ? created.password : '•'.repeat(created.password.length)}</span>
                <button type="button" className="copy-btn" onClick={() => setShown((s) => !s)}>
                  <Icon name={shown ? 'eyeOff' : 'eye'} size={16} />
                  <span>{shown ? 'Masquer' : 'Afficher'}</span>
                </button>
                <CopyButton value={created.password} />
              </dd>
            </div>
          </dl>

          <Notice tone="info">
            Ce mot de passe n'est affiché qu'ici. Une fois cette page quittée, il ne pourra plus être relu.
          </Notice>
        </Card>

        <div className="form-actions form-actions--start">
          <Button icon="building" onClick={() => navigate(`/companies/${client.id}`)}>
            Ouvrir la fiche
          </Button>
          <Button variant="secondary" icon="plus" onClick={onAnother}>
            Créer une autre société
          </Button>
        </div>
      </div>
    </>
  );
}

export default function CompanyCreatePage() {
  const [form, setForm] = useState<Form>(initialForm);
  const [codeTouched, setCodeTouched] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function onNameChange(name: string) {
    setForm((f) => ({ ...f, name, code: codeTouched ? f.code : suggestCode(name) }));
    if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    const problems = validate(form);
    setErrors(problems);
    if (Object.keys(problems).length > 0) {
      setFormError('Corrigez les champs signalés avant de continuer.');
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      const result = await api.companies.create(toInput(form));
      setCreated({
        result,
        email: form.adminEmail.trim(),
        password: form.adminPassword,
        portal: form.customDomain || form.subdomain || null,
      });
    } catch (err) {
      setFormError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setForm(initialForm());
    setCodeTouched(false);
    setErrors({});
    setFormError(null);
    setShowPassword(false);
    setCreated(null);
  }

  if (created) return <CreatedView created={created} onAnother={reset} />;

  return (
    <>
      <PageHeader
        title="Nouvelle société"
        description="Créez la société et son administrateur. Les agences, agents et clients se gèrent ensuite depuis l'espace de la société."
        actions={
          <Link to="/companies" className="btn btn--secondary">
            <Icon name="arrowLeft" size={18} />
            <span>Retour aux sociétés</span>
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
              <h2>La société</h2>
              <p>Son nom, son code d'identification et son pays d'implantation.</p>
            </div>
          </header>
          <div className="form-grid">
            <Field
              id="c-name"
              label="Nom de la société"
              value={form.name}
              onChange={(e) => onNameChange(e.target.value)}
              error={errors.name}
              maxLength={120}
              autoComplete="off"
              autoFocus
            />
            <Field
              id="c-code"
              label="Code société"
              value={form.code}
              onChange={(e) => {
                setCodeTouched(true);
                set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
              }}
              error={errors.code}
              hint="Identifiant technique du portail. Il ne pourra plus être changé."
              maxLength={12}
              autoComplete="off"
              spellCheck={false}
            />
            <SelectField
              id="c-country"
              label="Pays du propriétaire"
              value={form.ownerCountry}
              onChange={(e) => set('ownerCountry', e.target.value)}
              options={COUNTRY_OPTIONS}
              placeholder="Choisir un pays"
              error={errors.ownerCountry}
              hint="Détermine la devise par défaut de la société."
            />
            <Field
              id="c-sector"
              label="Secteur d'activité"
              value={form.activitySector}
              onChange={(e) => set('activitySector', e.target.value)}
              maxLength={120}
              autoComplete="off"
            />
            <SelectField
              id="c-type"
              label="Type d'abonnement"
              value={form.subscriptionType}
              onChange={(e) => set('subscriptionType', e.target.value as SubscriptionType)}
              options={TYPE_OPTIONS}
            />
          </div>
        </Card>

        <Card className="section-card">
          <header className="section-card__head">
            <span className="section-card__icon">
              <Icon name="user" size={20} />
            </span>
            <div className="section-card__title">
              <h2>L'administrateur</h2>
              <p>Il gère la société : agences, agents, clients et trésorerie.</p>
            </div>
          </header>
          <div className="form-grid">
            <Field
              id="c-admin-first"
              label="Prénom"
              value={form.adminFirstName}
              onChange={(e) => set('adminFirstName', e.target.value)}
              error={errors.adminFirstName}
              autoComplete="off"
            />
            <Field
              id="c-admin-last"
              label="Nom"
              value={form.adminLastName}
              onChange={(e) => set('adminLastName', e.target.value)}
              error={errors.adminLastName}
              autoComplete="off"
            />
            <Field
              id="c-admin-email"
              type="email"
              label="Adresse email"
              value={form.adminEmail}
              onChange={(e) => set('adminEmail', e.target.value)}
              error={errors.adminEmail}
              hint="Ce sera son identifiant de connexion."
              autoComplete="off"
            />
            <Field
              id="c-phone"
              type="tel"
              label="Téléphone"
              value={form.contactPhone}
              onChange={(e) => set('contactPhone', e.target.value)}
              hint="Facultatif. Format international, exemple : +33612345678."
              autoComplete="off"
            />
            <div className="form-grid__wide">
              <Field
                id="c-admin-password"
                type={showPassword ? 'text' : 'password'}
                label="Mot de passe temporaire"
                value={form.adminPassword}
                onChange={(e) => set('adminPassword', e.target.value)}
                error={errors.adminPassword}
                hint="Généré automatiquement. Vous pourrez le copier après la création."
                autoComplete="new-password"
                spellCheck={false}
                trailing={
                  <button
                    type="button"
                    className="icon-btn icon-btn--quiet"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                  </button>
                }
              />
              <button
                type="button"
                className="link-btn"
                onClick={() => set('adminPassword', generateTempPassword())}
              >
                Générer un autre mot de passe
              </button>
            </div>
          </div>
        </Card>

        <Card className="section-card">
          <header className="section-card__head">
            <span className="section-card__icon">
              <Icon name="globe" size={20} />
            </span>
            <div className="section-card__title">
              <h2>Portail et apparence</h2>
              <p>Facultatif : tout peut être complété plus tard depuis la fiche de la société.</p>
            </div>
          </header>
          <div className="form-grid">
            <Field
              id="c-subdomain"
              label="Sous-domaine"
              value={form.subdomain}
              onChange={(e) => set('subdomain', e.target.value.toLowerCase().trim())}
              error={errors.subdomain}
              placeholder="flash"
              autoComplete="off"
              spellCheck={false}
            />
            <Field
              id="c-domain"
              label="Domaine personnalisé"
              value={form.customDomain}
              onChange={(e) => set('customDomain', e.target.value.toLowerCase().trim())}
              error={errors.customDomain}
              placeholder="admin.ma-societe.com"
              autoComplete="off"
              spellCheck={false}
            />
            <ColorField
              id="c-primary"
              label="Couleur principale"
              value={form.primaryColor}
              fallback="#059669"
              onChange={(v) => set('primaryColor', v)}
              error={errors.primaryColor}
            />
            <ColorField
              id="c-secondary"
              label="Couleur d'accent"
              value={form.secondaryColor}
              fallback="#10B981"
              onChange={(v) => set('secondaryColor', v)}
              error={errors.secondaryColor}
            />
          </div>
        </Card>

        <div className="form-actions form-actions--start">
          <Button type="submit" busy={busy} icon="check">
            Créer la société
          </Button>
          <Link to="/companies" className="btn btn--ghost">
            Annuler
          </Link>
        </div>
      </form>
    </>
  );
}
