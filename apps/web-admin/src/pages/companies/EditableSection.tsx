// src/pages/companies/EditableSection.tsx
// Carte d'information qui se transforme en formulaire (« Modifier »).
// Pilotée par une liste de champs : une seule implémentation pour l'identité, le portail,
// l'apparence et les mentions légales d'une société.
//
// Règles d'envoi (PATCH /clients/:id n'est pas validé côté serveur) :
//   - seuls les champs réellement modifiés sont envoyés ;
//   - un champ facultatif vidé part en `null` (jamais "" : la colonne est unique pour
//     subdomain/customDomain, deux chaînes vides entreraient en collision) ;
//   - chaque champ est validé ici avant l'envoi.

import { useState, type FormEvent, type ReactNode } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import { ColorField, SelectField, TextAreaField } from '../../components/form';
import { Button, Card, Field, Notice } from '../../components/ui';
import { safeColor } from '../../lib/companyRules';
import { describeError } from '../../lib/errors';

export interface FieldDef {
  key: string;
  label: string;
  kind?: 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'color' | 'select';
  options?: readonly { value: string; label: string }[];
  hint?: string;
  placeholder?: string;
  maxLength?: number;
  /** Obligatoire : ne peut pas être vidé. */
  required?: boolean;
  /** Valeur de repli pour l'aperçu de couleur. */
  fallback?: string;
  /** Met la valeur en minuscules avant validation et envoi (domaines). */
  lowercase?: boolean;
  /** Retourne un message d'erreur, ou null si la valeur (déjà nettoyée) est valide. */
  validate?: (value: string) => string | null;
  /** Occupe toute la largeur du formulaire. */
  wide?: boolean;
}

type Values = Record<string, string | null | undefined>;

interface Props {
  id: string;
  title: string;
  icon: IconName;
  description?: string;
  fields: readonly FieldDef[];
  values: Values;
  onSave: (patch: Record<string, string | null>) => Promise<void>;
  /** Lecture seule : la carte n'offre pas le bouton « Modifier ». */
  readOnly?: boolean;
  /** Contenu additionnel (aperçu, aide), reçoit les valeurs en cours de saisie. */
  extra?: (draft: Record<string, string>, editing: boolean) => ReactNode;
}

function toDraft(fields: readonly FieldDef[], values: Values): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const f of fields) draft[f.key] = values[f.key] ?? '';
  return draft;
}

function clean(def: FieldDef, raw: string): string {
  const trimmed = raw.trim();
  return def.lowercase ? trimmed.toLowerCase() : trimmed;
}

export function EditableSection({
  id,
  title,
  icon,
  description,
  fields,
  values,
  onSave,
  readOnly = false,
  extra,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() => toDraft(fields, values));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function startEdit() {
    setDraft(toDraft(fields, values));
    setErrors({});
    setSaveError(null);
    setSaved(false);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setErrors({});
    setSaveError(null);
  }

  function set(key: string, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const nextErrors: Record<string, string> = {};
    const patch: Record<string, string | null> = {};

    for (const f of fields) {
      const value = clean(f, draft[f.key] ?? '');
      const before = clean(f, values[f.key] ?? '');

      if (!value) {
        if (f.required) nextErrors[f.key] = `${f.label} est obligatoire.`;
      } else {
        const problem = f.validate?.(value) ?? null;
        if (problem) nextErrors[f.key] = problem;
      }

      if (value !== before) patch[f.key] = value === '' ? null : value;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await onSave(patch);
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setSaveError(describeError(err).message);
    } finally {
      setSaving(false);
    }
  }

  const headingId = `${id}-title`;

  return (
    <Card as="section" aria-labelledby={headingId} className="section-card">
      <header className="section-card__head">
        <span className="section-card__icon">
          <Icon name={icon} size={20} />
        </span>
        <div className="section-card__title">
          <h2 id={headingId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {!editing && !readOnly ? (
          <Button variant="ghost" icon="edit" onClick={startEdit} aria-label={`Modifier : ${title}`}>
            Modifier
          </Button>
        ) : null}
      </header>

      {saved && !editing ? (
        <div className="section-card__flash">
          <Notice tone="ok">Modifications enregistrées.</Notice>
        </div>
      ) : null}

      {editing ? (
        <form onSubmit={(e) => void submit(e)} noValidate className="form-grid">
          {fields.map((f) => {
            const fid = `${id}-${f.key}`;
            const error = errors[f.key] || null;
            const common = { id: fid, label: f.label, error, hint: f.hint };
            const wrap = f.wide || f.kind === 'textarea' ? 'form-grid__wide' : undefined;
            const value = draft[f.key] ?? '';
            return (
              <div key={f.key} className={wrap}>
                {f.kind === 'select' ? (
                  <SelectField
                    {...common}
                    value={value}
                    options={f.options ?? []}
                    placeholder={f.required ? undefined : 'Non renseigné'}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                ) : f.kind === 'textarea' ? (
                  <TextAreaField
                    {...common}
                    value={value}
                    maxLength={f.maxLength}
                    placeholder={f.placeholder}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                ) : f.kind === 'color' ? (
                  <ColorField
                    {...common}
                    value={value}
                    fallback={f.fallback ?? '#059669'}
                    onChange={(v) => set(f.key, v)}
                  />
                ) : (
                  <Field
                    {...common}
                    type={f.kind ?? 'text'}
                    value={value}
                    maxLength={f.maxLength}
                    placeholder={f.placeholder}
                    autoComplete="off"
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
              </div>
            );
          })}

          {extra ? <div className="form-grid__wide">{extra(draft, true)}</div> : null}

          {saveError ? (
            <div className="form-grid__wide">
              <Notice tone="error">{saveError}</Notice>
            </div>
          ) : null}

          <div className="form-grid__wide form-actions">
            <Button variant="secondary" onClick={cancel} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" busy={saving}>
              Enregistrer
            </Button>
          </div>
        </form>
      ) : (
        <>
          <dl className="kv">
            {fields.map((f) => {
              const raw = values[f.key];
              const text = raw && String(raw).trim() ? String(raw) : null;
              const shown =
                f.kind === 'select' ? (f.options?.find((o) => o.value === text)?.label ?? text) : text;
              return (
                <div className="kv__row" key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>
                    {shown ? (
                      f.kind === 'color' ? (
                        <span className="swatch">
                          <i style={{ background: safeColor(text, 'transparent') }} aria-hidden="true" />
                          {shown}
                        </span>
                      ) : (
                        shown
                      )
                    ) : (
                      <span className="muted">Non renseigné</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          {extra ? <div className="section-card__extra">{extra(toDraft(fields, values), false)}</div> : null}
        </>
      )}
    </Card>
  );
}
