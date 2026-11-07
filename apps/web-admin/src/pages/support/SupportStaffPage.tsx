// apps/web-admin/src/pages/support/SupportStaffPage.tsx
// Lot 9 — « Service client » (administrateur de société) : les comptes du support et leurs délégations.
// Chaque délégation est un interrupteur : activé, le support voit le bouton / la page ; coupé, ils disparaissent
// (et le serveur refuse l'action). Un changement est enregistré tout de suite et s'applique sans reconnexion.

import { useMemo, useState, type FormEvent } from 'react';
import type { SupportPermission, SupportPermissionMeta, SupportStaff } from '@direct-transfair/shared';
import { SUPPORT_GROUP_LABEL, expandSupportPermissions } from '@direct-transfair/shared';
import { CredentialsCard } from '../../components/CredentialsCard';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, CopyButton, SelectField } from '../../components/form';
import { Button, Card, Field, Notice, PageHeader, Pill, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { PRESETS, groupedCatalog, presetOf, requiredBy, toggled } from '../../lib/supportRules';
import { useResource } from '../../lib/useResource';
import { formatDateTime, fullName, initialsOf } from '../../lib/userRules';
import { useDialogAction } from '../treasury/useDialogAction';

// ─── Un interrupteur ─────────────────────────────────────
function Switch({
  checked,
  locked,
  busy,
  label,
  onChange,
}: {
  checked: boolean;
  locked: boolean;
  busy: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`sp-switch${checked ? ' is-on' : ''}${locked ? ' is-locked' : ''}`}
      disabled={locked || busy}
      onClick={() => onChange(!checked)}
    >
      <span className="sp-switch__knob" />
    </button>
  );
}

// ─── Carte d'un compte du support ────────────────────────
function StaffCard({
  staff,
  catalog,
  onChanged,
  onReset,
}: {
  staff: SupportStaff;
  catalog: readonly SupportPermissionMeta[];
  onChanged: (message?: string) => void;
  onReset: (s: SupportStaff) => void;
}) {
  const [explicit, setExplicit] = useState<SupportPermission[]>(staff.permissions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  const effective = useMemo(() => new Set(expandSupportPermissions(explicit, catalog)), [explicit, catalog]);
  const groups = useMemo(() => groupedCatalog(catalog), [catalog]);
  const preset = presetOf(explicit);
  const activeCount = effective.size;

  async function save(next: SupportPermission[]) {
    const previous = explicit;
    setExplicit(next);
    setSaving(true);
    setError(null);
    try {
      const updated = await api.support.setPermissions(staff.id, next);
      setExplicit(updated.permissions);
      setSavedAt(Date.now());
    } catch (err) {
      setExplicit(previous);
      setError(describeError(err).message);
    } finally {
      setSaving(false);
    }
  }

  async function setActive(active: boolean) {
    setToggling(true);
    setError(null);
    try {
      await api.support.setStaffActive(staff.id, active);
      onChanged(active ? `${fullName(staff)} peut de nouveau se connecter.` : `${fullName(staff)} est suspendu : ses sessions sont fermées.`);
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setToggling(false);
    }
  }

  return (
    <li className="sp-staff">
      <div className="sp-staff__head">
        <span className="avatar sp-staff__avatar" aria-hidden="true">
          {initialsOf(staff)}
        </span>
        <div className="sp-staff__id">
          <strong>{fullName(staff)}</strong>
          <span>{staff.email}</span>
        </div>
        <div className="sp-staff__pills">
          {staff.active ? <Pill tone="ok">Actif</Pill> : <Pill tone="danger">Suspendu</Pill>}
          {staff.mustChangePassword ? <Pill tone="warn">Mot de passe provisoire</Pill> : null}
        </div>
      </div>

      <p className="sp-staff__meta">
        {formatDateTime(staff.lastLoginAt) ? `Dernière connexion : ${formatDateTime(staff.lastLoginAt)}` : 'Jamais connecté'}
      </p>

      <button type="button" className="sp-staff__summary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>
          <strong>
            {activeCount} délégation{activeCount > 1 ? 's' : ''} active{activeCount > 1 ? 's' : ''}
          </strong>
          <small>{preset ? preset.label : activeCount === 0 ? 'Aucune' : 'Réglage personnalisé'}</small>
        </span>
        <span className="sp-staff__chev" data-open={open}>
          <Icon name="chevronRight" size={18} />
        </span>
      </button>

      {open ? (
        <div className="sp-perms">
          <div className="sp-presets" role="group" aria-label="Profils types">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="sp-preset" aria-pressed={preset?.id === p.id} disabled={saving} onClick={() => void save(p.permissions)} title={p.hint}>
                {p.label}
              </button>
            ))}
          </div>

          {groups.map(({ group, items }) => (
            <fieldset key={group} className="sp-group">
              <legend>{SUPPORT_GROUP_LABEL[group]}</legend>
              {items.map((m) => {
                const on = effective.has(m.key);
                const by = on && !explicit.includes(m.key) ? requiredBy(m.key, explicit, catalog) : [];
                const locked = by.length > 0;
                return (
                  <div key={m.key} className={`sp-perm${on ? ' is-on' : ''}`}>
                    <div className="sp-perm__text">
                      <strong>
                        {m.label}
                        {m.sensitive ? <em className="sp-sensitive">Sensible</em> : null}
                      </strong>
                      <span>{m.description}</span>
                      {locked ? <small className="sp-perm__lock">Activée d'office par « {by.map((b) => b.label).join(' », « ')} »</small> : null}
                    </div>
                    <Switch checked={on} locked={locked} busy={saving} label={m.label} onChange={(next) => void save(toggled(explicit, m.key, next, catalog))} />
                  </div>
                );
              })}
            </fieldset>
          ))}

          <p className="sp-saved" role="status" aria-live="polite">
            {saving ? 'Enregistrement…' : savedAt ? 'Enregistré — appliqué immédiatement.' : 'Chaque changement est enregistré aussitôt.'}
          </p>
        </div>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="sp-staff__actions">
        <Button variant="ghost" onClick={() => onReset(staff)}>
          Nouveau mot de passe
        </Button>
        {staff.active ? (
          <Button variant="ghost" busy={toggling} onClick={() => void setActive(false)}>
            Suspendre
          </Button>
        ) : (
          <Button variant="secondary" busy={toggling} onClick={() => void setActive(true)}>
            Réactiver
          </Button>
        )}
      </div>
    </li>
  );
}

// ─── Création ────────────────────────────────────────────
interface NewForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preset: string;
}
const EMPTY: NewForm = { firstName: '', lastName: '', email: '', phone: '', preset: 'level1' };

function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (r: { staff: SupportStaff; generatedPassword: string }) => void }) {
  const [form, setForm] = useState<NewForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof NewForm, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof NewForm>(key: K, value: NewForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const problems: Partial<Record<keyof NewForm, string>> = {};
    if (!form.firstName.trim()) problems.firstName = 'Prénom requis.';
    if (!form.lastName.trim()) problems.lastName = 'Nom requis.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) problems.email = 'Email invalide.';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setBusy(true);
    setError(null);
    try {
      const phone = form.phone.trim();
      const result = await api.support.createStaff({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        ...(phone ? { phone } : {}),
        permissions: PRESETS.find((p) => p.id === form.preset)?.permissions ?? [],
      });
      onCreated(result);
    } catch (err) {
      setError(describeError(err).message);
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog open title="Nouveau compte service client" confirmLabel="Créer le compte" busy={busy} onConfirm={() => void submit()} onCancel={onClose}>
      <form className="dialog-form" onSubmit={(e) => void submit(e)} noValidate>
        <button type="submit" hidden />
        <Field label="Prénom" id="sp-first" value={form.firstName} error={errors.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="off" />
        <Field label="Nom" id="sp-last" value={form.lastName} error={errors.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="off" />
        <Field label="Email" id="sp-email" type="email" value={form.email} error={errors.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" />
        <Field label="Téléphone (facultatif)" id="sp-phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="off" />
        <SelectField
          id="sp-preset"
          label="Délégations de départ"
          hint={PRESETS.find((p) => p.id === form.preset)?.hint}
          value={form.preset}
          onChange={(e) => set('preset', e.target.value)}
          options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        />
        <p className="muted">Vous pourrez ensuite activer ou couper chaque délégation, à tout moment.</p>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </form>
    </ConfirmDialog>
  );
}

function ResetDialog({ staff, onClose, onDone }: { staff: SupportStaff; onClose: () => void; onDone: (message: string) => void }) {
  const [password, setPassword] = useState<string | null>(null);
  const { busy, error, run } = useDialogAction(() => undefined);
  const name = fullName(staff);

  if (password) {
    return (
      <ConfirmDialog open title="Nouveau mot de passe" confirmLabel="Terminé" hideCancel onConfirm={() => onDone(`Mot de passe de ${name} réinitialisé.`)} onCancel={() => onDone(`Mot de passe de ${name} réinitialisé.`)}>
        <div className="dialog-form">
          <p>Transmettez-le à {name} par un canal sûr. Un email lui a aussi été envoyé.</p>
          <p className="inline-copy">
            <span className="mono">{password}</span>
            <CopyButton value={password} />
          </p>
          <Notice tone="info">Affiché une seule fois. Ses sessions ouvertes ont été fermées.</Notice>
        </div>
      </ConfirmDialog>
    );
  }
  return (
    <ConfirmDialog
      open
      title="Nouveau mot de passe"
      confirmLabel="Générer un mot de passe"
      busy={busy}
      onConfirm={() =>
        void run(async () => {
          const r = await api.support.resetStaffPassword(staff.id);
          setPassword(r.generatedPassword);
          return '';
        })
      }
      onCancel={onClose}
    >
      <div className="dialog-form">
        <p>Le mot de passe actuel de {name} cessera de fonctionner et ses sessions seront fermées. Un mot de passe temporaire sera généré et envoyé à {staff.email}.</p>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </ConfirmDialog>
  );
}

// ─── Page ────────────────────────────────────────────────
export default function SupportStaffPage() {
  const staff = useResource(() => api.support.listStaff(), []);
  const catalog = useResource(() => api.support.catalog(), []);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ staff: SupportStaff; generatedPassword: string } | null>(null);
  const [reset, setReset] = useState<SupportStaff | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const list = staff.data ?? [];
  const cat = catalog.data ?? [];
  const ready = !!staff.data && !!catalog.data;
  const loadError = staff.error ?? catalog.error;

  function reloadAll(text?: string) {
    if (text) setMessage(text);
    staff.reload();
  }

  return (
    <>
      <PageHeader
        title="Service client"
        description="Créez les comptes de votre support et choisissez, interrupteur par interrupteur, ce qu'ils ont le droit de faire. Un bouton désactivé disparaît de leur espace."
        actions={
          <Button icon="plus" onClick={() => setCreating(true)}>
            Nouveau compte
          </Button>
        }
      />

      {message ? (
        <div className="stack stack--tight">
          <Notice
            tone="ok"
            title={message}
            action={
              <button type="button" className="link-btn" onClick={() => setMessage(null)}>
                Fermer
              </button>
            }
          />
        </div>
      ) : null}

      {created ? (
        <div className="stack">
          <CredentialsCard
            title="Compte créé"
            intro="Transmettez ces identifiants par un canal sûr. Un email avec le mot de passe temporaire a aussi été envoyé. Le support devra le remplacer à sa première connexion sur le portail web."
            rows={[{ label: 'Identifiant', value: created.staff.email, copy: true }]}
            password={created.generatedPassword}
          >
            <Button variant="secondary" onClick={() => setCreated(null)}>
              J'ai transmis les accès
            </Button>
          </CredentialsCard>
        </div>
      ) : null}

      {!ready && !loadError ? (
        <div className="center-block">
          <Spinner label="Chargement du service client" />
        </div>
      ) : loadError ? (
        <Card>
          <Notice
            tone="error"
            title="Impossible de charger le service client"
            action={
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  staff.reload();
                  catalog.reload();
                }}
              >
                Réessayer
              </button>
            }
          >
            {describeError(loadError).message}
          </Notice>
        </Card>
      ) : list.length === 0 ? (
        <Card className="empty">
          <span className="empty__icon">
            <Icon name="users" size={26} />
          </span>
          <h2>Aucun compte service client</h2>
          <p>Déléguez la validation des pièces, les litiges, les remboursements ou la suspension de comptes à votre équipe d'assistance, sans leur donner accès à la trésorerie.</p>
          <Button icon="plus" onClick={() => setCreating(true)}>
            Créer le premier compte
          </Button>
        </Card>
      ) : (
        <ul className="sp-staff-list">
          {list.map((s) => (
            <StaffCard key={s.id} staff={s} catalog={cat} onChanged={reloadAll} onReset={setReset} />
          ))}
        </ul>
      )}

      {creating ? (
        <CreateDialog
          onClose={() => setCreating(false)}
          onCreated={(r) => {
            setCreating(false);
            setCreated(r);
            staff.reload();
          }}
        />
      ) : null}
      {reset ? (
        <ResetDialog
          staff={reset}
          onClose={() => setReset(null)}
          onDone={(text) => {
            setReset(null);
            reloadAll(text);
          }}
        />
      ) : null}
    </>
  );
}
