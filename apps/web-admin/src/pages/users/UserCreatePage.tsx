// src/pages/users/UserCreatePage.tsx
// Ajout d'un administrateur à une société existante (super admin uniquement).
// Les agents se créent depuis l'espace de la société (module Agences) : POST /users ignore
// l'agence, un agent créé ici serait rattaché à aucune agence.
// Le rôle est fixé à COMPANY_ADMIN côté web ; le mot de passe temporaire est généré ici et
// n'est affiché qu'une fois.

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { UserSummary } from '@direct-transfair/shared';
import { Icon } from '../../components/Icon';
import { CredentialsCard } from '../../components/CredentialsCard';
import { SelectField } from '../../components/form';
import { Button, Card, Field, Notice, PageHeader, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { EMAIL } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';
import { generateTempPassword } from '../../lib/password';
import { useResource } from '../../lib/useResource';
import { fullName } from '../../lib/userRules';

interface Form {
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

type Errors = Partial<Record<keyof Form, string>>;

const initial = (): Form => ({
  companyId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: generateTempPassword(),
});

function validate(f: Form): Errors {
  const e: Errors = {};
  if (!f.companyId) e.companyId = 'Choisissez la société.';
  if (!f.firstName.trim()) e.firstName = 'Le prénom est obligatoire.';
  if (!f.lastName.trim()) e.lastName = 'Le nom est obligatoire.';
  if (!EMAIL.test(f.email.trim())) e.email = 'Adresse email invalide.';
  if (f.phone.trim() && !/^\+?[0-9 ().-]{6,25}$/.test(f.phone.trim())) e.phone = 'Numéro de téléphone invalide.';
  if (f.password.length < 10) e.password = 'Au moins 10 caractères.';
  return e;
}

export default function UserCreatePage() {
  const companies = useResource(() => api.companies.list(), []);
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ user: UserSummary; password: string; company: string } | null>(null);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
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
      const user = await api.users.create({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        role: 'COMPANY_ADMIN',
        clientId: Number(form.companyId),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      });
      const company = companies.data?.find((c) => String(c.id) === form.companyId)?.name ?? '';
      setCreated({ user, password: form.password, company });
    } catch (err) {
      setFormError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setForm(initial());
    setErrors({});
    setFormError(null);
    setShowPassword(false);
    setCreated(null);
  }

  if (created) {
    return (
      <>
        <PageHeader
          title="Administrateur créé"
          description={`${fullName(created.user)} peut administrer ${created.company || 'la société'}.`}
        />
        <div className="stack">
          <CredentialsCard
            title="Accès de l'administrateur"
            intro="Transmettez-lui ces identifiants par un canal sûr. À sa première connexion, il devra vérifier son email."
            rows={[
              ...(created.company ? [{ label: 'Société', value: created.company }] : []),
              { label: 'Identifiant', value: created.user.email, copy: true },
            ]}
            password={created.password}
          />
          <div className="form-actions form-actions--start">
            <Link to={`/users/${encodeURIComponent(created.user.id)}`} className="btn btn--primary">
              <Icon name="user" size={18} />
              <span>Ouvrir la fiche</span>
            </Link>
            <Button variant="secondary" icon="plus" onClick={reset}>
              Ajouter un autre administrateur
            </Button>
          </div>
        </div>
      </>
    );
  }

  const options = (companies.data ?? []).map((c) => ({ value: String(c.id), label: `${c.name} (${c.code})` }));

  return (
    <>
      <PageHeader
        title="Nouvel administrateur"
        description="Ajoutez un administrateur à une société existante. Les agents se créent depuis l'espace de la société."
        actions={
          <Link to="/users" className="btn btn--secondary">
            <Icon name="arrowLeft" size={18} />
            <span>Retour aux utilisateurs</span>
          </Link>
        }
      />

      {companies.loading && !companies.data ? (
        <div className="center-block">
          <Spinner label="Chargement des sociétés" />
        </div>
      ) : companies.error ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger les sociétés"
            action={
              <button type="button" className="link-btn" onClick={companies.reload}>
                Réessayer
              </button>
            }
          >
            {describeError(companies.error).message}
          </Notice>
        </Card>
      ) : options.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="building" size={26} />
          </span>
          <h2>Aucune société</h2>
          <p>Créez d'abord une société : son premier administrateur est créé avec elle.</p>
          <Link to="/companies/new" className="btn btn--primary">
            <Icon name="plus" size={18} />
            <span>Créer une société</span>
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
                <p>Il aura accès à toute la gestion de la société choisie.</p>
              </div>
            </header>
            <div className="form-grid">
              <div className="form-grid__wide">
                <SelectField
                  id="u-company"
                  label="Société"
                  value={form.companyId}
                  onChange={(e) => set('companyId', e.target.value)}
                  options={options}
                  placeholder="Choisir une société"
                  error={errors.companyId}
                />
              </div>
              <Field
                id="u-first"
                label="Prénom"
                className="form-grid__half"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                error={errors.firstName}
                autoComplete="off"
              />
              <Field
                id="u-last"
                label="Nom"
                className="form-grid__half"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                error={errors.lastName}
                autoComplete="off"
              />
              <Field
                id="u-email"
                type="email"
                label="Adresse email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                error={errors.email}
                hint="Ce sera son identifiant de connexion."
                autoComplete="off"
              />
              <Field
                id="u-phone"
                type="tel"
                label="Téléphone"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                error={errors.phone}
                hint="Facultatif. Format international, exemple : +33612345678."
                autoComplete="off"
              />
              <div className="form-grid__wide">
                <Field
                  id="u-password"
                  type={showPassword ? 'text' : 'password'}
                  label="Mot de passe temporaire"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  error={errors.password}
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
                <button type="button" className="link-btn" onClick={() => set('password', generateTempPassword())}>
                  Générer un autre mot de passe
                </button>
              </div>
            </div>
          </Card>

          <div className="form-actions form-actions--start">
            <Button type="submit" busy={busy} icon="check">
              Créer l'administrateur
            </Button>
            <Link to="/users" className="btn btn--ghost">
              Annuler
            </Link>
          </div>
        </form>
      )}
    </>
  );
}
