// apps/web-admin/src/pages/companies/CompanyCreatePage.tsx
// Création d'une société de transfert + son administrateur (POST /clients).
// Le formulaire propose TOUS les champs de la fiche société (coordonnées, portail, apparence avec logo, slogan, message
// d'accueil et police, mentions légales) : plus besoin de créer la société puis de revenir la compléter. Les champs
// supplémentaires sont pilotés par companyFields.ts, la même définition que la fiche : un champ ajouté là apparaît ici.
// Le mot de passe temporaire est généré ici (tirage cryptographique) et n'est affiché
// qu'une seule fois, à l'écran de confirmation : il n'est ni stocké ni relisible ensuite.

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CreateCompanyInput, CreateCompanyResult, SubscriptionType } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { ContractTermsFields } from '../../components/ContractTermsFields';
import { LogoUploader } from '../../components/LogoUploader';
import { ColorField, CopyButton, SelectField, TextAreaField } from '../../components/form';
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
import { initialTermsForm, toTermsInput, validateTerms, type ContractTermsForm } from '../../lib/contractRules';
import { AppearancePreview } from './AppearancePreview';
import { APPEARANCE_FIELDS, IDENTITY_FIELDS, LEGAL_FIELDS } from './companyFields';
import type { FieldDef } from './EditableSection';

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

type Errors = Partial<Record<keyof Form, string>> & Record<string, string | undefined>;

// Champs de la fiche proposés en plus du formulaire de base. Le nom, le secteur, l'abonnement et les couleurs sont déjà
// saisis plus haut ; le téléphone de contact est celui de l'administrateur à la création.
const CONTACT_KEYS = ['contactEmail', 'city', 'website', 'address'];
const BRAND_KEYS = ['tagline', 'welcomeMessage', 'logoUrl', 'fontFamily'];
const CONTACT_FIELDS: readonly FieldDef[] = IDENTITY_FIELDS.filter((f) => CONTACT_KEYS.includes(f.key));
const BRAND_FIELDS: readonly FieldDef[] = APPEARANCE_FIELDS.filter((f) => BRAND_KEYS.includes(f.key));
const EXTRA_DEFS: readonly FieldDef[] = [...CONTACT_FIELDS, ...BRAND_FIELDS, ...LEGAL_FIELDS];
type Extra = Record<string, string>;

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

/** Valide les champs supplémentaires : seuls ceux qui sont remplis sont contrôlés (tous sont facultatifs). */
function validateExtra(x: Extra): Errors {
  const e: Errors = {};
  for (const def of EXTRA_DEFS) {
    const value = (x[def.key] ?? '').trim();
    if (value && def.validate) {
      const message = def.validate(def.lowercase ? value.toLowerCase() : value);
      if (message) e[def.key] = message;
    }
  }
  return e;
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

function toInput(f: Form, x: Extra, contract: ContractTermsForm | null): CreateCompanyInput {
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
  // Champs supplémentaires : un champ laissé vide n'est pas envoyé (le serveur le laisse vide).
  const extra: Record<string, string> = {};
  for (const def of EXTRA_DEFS) {
    const value = (x[def.key] ?? '').trim();
    if (value) extra[def.key] = def.lowercase ? value.toLowerCase() : value;
  }
  // Conditions du contrat : si elles sont fournies, le serveur émet le contrat et joint le lien de signature aux identifiants.
  if (contract) input.contract = toTermsInput(contract, f.subscriptionType);
  return { ...input, ...extra };
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

        {created.result.contract ? (
          <Card className="credentials">
            <header className="credentials__head">
              <span className="section-card__icon">
                <Icon name="pen" size={20} />
              </span>
              <div>
                <h2>Contrat à signer</h2>
                <p>
                  Le contrat {created.result.contract.reference} est dans l'e-mail de bienvenue, avec ses identifiants.
                  Dès qu'il le signe, il en reçoit un exemplaire signé et vous le retrouvez dans « Contrats ».
                </p>
              </div>
            </header>
            {created.result.contract.signUrl ? (
              <dl className="kv">
                <div className="kv__row">
                  <dt>Lien de signature</dt>
                  <dd className="inline-copy">
                    <span className="mono ct-link__url">{created.result.contract.signUrl}</span>
                    <CopyButton value={created.result.contract.signUrl} />
                  </dd>
                </div>
              </dl>
            ) : null}
            {created.result.contractError ? <Notice tone="error">{created.result.contractError}</Notice> : null}
          </Card>
        ) : created.result.contractError ? (
          <Notice tone="error" title="La société est créée, mais le contrat n'a pas pu l'être">
            {created.result.contractError} Vous pouvez l'émettre depuis la fiche de la société, rubrique « Contrats ».
          </Notice>
        ) : null}

        <div className="form-actions form-actions--start">
          {created.result.contract ? (
            <Button icon="file" onClick={() => navigate(`/contracts/${created.result.contract!.id}`)}>
              Voir le contrat
            </Button>
          ) : null}
          <Button variant={created.result.contract ? 'secondary' : 'primary'} icon="building" onClick={() => navigate(`/companies/${client.id}`)}>
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
  const [extra, setExtra] = useState<Extra>({});
  const [contractOn, setContractOn] = useState(true);
  const [terms, setTerms] = useState<ContractTermsForm>(() => initialTermsForm());
  const [termErrors, setTermErrors] = useState<Record<string, string | undefined>>({});
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

  function setExtraValue(key: string, value: string) {
    setExtra((x) => ({ ...x, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  /** Une ligne de formulaire pour un champ de la fiche (texte, e-mail, adresse web, zone de texte). */
  function extraField(def: FieldDef) {
    const id = `c-x-${def.key}`;
    const common = { id, label: def.label, error: errors[def.key], hint: def.hint };
    const wrap = def.wide || def.kind === 'textarea' ? 'form-grid__wide' : def.half ? 'form-grid__half' : undefined;
    const value = extra[def.key] ?? '';
    return (
      <div key={def.key} className={wrap}>
        {def.kind === 'image' ? (
          <LogoUploader
            id={id}
            label={def.label}
            value={value}
            error={errors[def.key]}
            onChange={(v) => setExtraValue(def.key, v)}
          />
        ) : def.kind === 'textarea' ? (
          <TextAreaField
            {...common}
            value={value}
            maxLength={def.maxLength}
            placeholder={def.placeholder}
            onChange={(e) => setExtraValue(def.key, e.target.value)}
          />
        ) : (
          <Field
            {...common}
            type={def.kind === 'color' || def.kind === 'select' ? 'text' : (def.kind ?? 'text')}
            value={value}
            maxLength={def.maxLength}
            placeholder={def.placeholder}
            autoComplete="off"
            onChange={(e) => setExtraValue(def.key, def.lowercase ? e.target.value.toLowerCase() : e.target.value)}
          />
        )}
      </div>
    );
  }

  function onNameChange(name: string) {
    setForm((f) => ({ ...f, name, code: codeTouched ? f.code : suggestCode(name) }));
    if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    const problems: Errors = { ...validate(form), ...validateExtra(extra) };
    setErrors(problems);
    const termProblems = contractOn ? validateTerms(terms, form.subscriptionType) : {};
    setTermErrors(termProblems);
    if (Object.values(problems).some(Boolean) || Object.keys(termProblems).length > 0) {
      setFormError('Corrigez les champs signalés avant de continuer.');
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      const result = await api.companies.create(toInput(form, extra, contractOn ? terms : null));
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
    setExtra({});
    setContractOn(true);
    setTerms(initialTermsForm());
    setTermErrors({});
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
              <p>Son nom, son code d'identification, son pays d'implantation et ses coordonnées.</p>
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
            {CONTACT_FIELDS.map(extraField)}
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
              className="form-grid__half"
              value={form.adminFirstName}
              onChange={(e) => set('adminFirstName', e.target.value)}
              error={errors.adminFirstName}
              autoComplete="off"
            />
            <Field
              id="c-admin-last"
              label="Nom"
              className="form-grid__half"
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
              <Icon name="file" size={20} />
            </span>
            <div className="section-card__title">
              <h2>Contrat de {form.subscriptionType === 'RENTAL' ? 'location' : "l'achat"}</h2>
              <p>
                Le contrat est envoyé au patron avec ses identifiants, dans le même e-mail, avec un lien pour le signer en ligne.
                Il reçoit ensuite son contrat signé par e-mail.
              </p>
            </div>
          </header>
          <label className="check-row">
            <input type="checkbox" checked={contractOn} onChange={(e) => setContractOn(e.target.checked)} />
            <span>
              Émettre le contrat de {form.subscriptionType === 'RENTAL' ? 'location' : "l'achat"} et l'envoyer à signer
            </span>
          </label>
          {contractOn ? (
            <ContractTermsFields
              idPrefix="c-ct"
              kind={form.subscriptionType}
              value={terms}
              errors={termErrors}
              onChange={(patch) => {
                setTerms((t) => ({ ...t, ...patch }));
                setTermErrors({});
              }}
            />
          ) : (
            <p className="muted">Aucun contrat ne sera émis : vous pourrez le faire plus tard depuis la fiche de la société.</p>
          )}
        </Card>

        <Card className="section-card">
          <header className="section-card__head">
            <span className="section-card__icon">
              <Icon name="globe" size={20} />
            </span>
            <div className="section-card__title">
              <h2>Portail et apparence</h2>
              <p>Facultatif : domaine du portail, couleurs, logo, slogan, message d'accueil et police.</p>
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
            {BRAND_FIELDS.map(extraField)}
            <div className="form-grid__wide">
              <AppearancePreview
                draft={{
                  primaryColor: form.primaryColor,
                  secondaryColor: form.secondaryColor,
                  tagline: extra.tagline ?? '',
                  logoUrl: extra.logoUrl ?? '',
                  fontFamily: extra.fontFamily ?? '',
                }}
              />
            </div>
          </div>
        </Card>

        <Card className="section-card">
          <header className="section-card__head">
            <span className="section-card__icon">
              <Icon name="shield" size={20} />
            </span>
            <div className="section-card__title">
              <h2>Mentions légales</h2>
              <p>
                Facultatif : affichées aux clients dans les conditions d'utilisation et l'assistance. Elles peuvent être
                complétées plus tard.
              </p>
            </div>
          </header>
          <div className="form-grid">{LEGAL_FIELDS.map(extraField)}</div>
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
