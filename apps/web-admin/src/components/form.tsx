// src/components/form.tsx
// Compléments au Field de ui/ : liste déroulante, zone de texte, couleur,
// bouton « copier » et boîte de confirmation (élément <dialog> natif : le focus
// reste dans la boîte, Échap la ferme, l'arrière-plan est inerte).

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon } from './Icon';
import { Button } from './ui';
import { HEX_COLOR } from '../lib/companyRules';
import { MOBILE_QUERY, useMediaQuery } from '../lib/useMediaQuery';

// ─── Aide / erreur sous un champ ─────────────────────────
function FieldNote({ id, hint, error }: { id: string; hint?: string; error?: string | null }) {
  if (error) {
    return (
      <p className="field__error" id={id}>
        {error}
      </p>
    );
  }
  return hint ? (
    <p className="field__hint" id={id}>
      {hint}
    </p>
  ) : null;
}

// ─── Liste déroulante ────────────────────────────────────
interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string | null;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  /** Libellé court de l'option vide, utilisé sur mobile où la liste est étroite (ex. « Période »). */
  compactPlaceholder?: string;
}

export function SelectField({ label, hint, error, options, placeholder, compactPlaceholder, id, className, ...rest }: SelectFieldProps) {
  const compact = useMediaQuery(MOBILE_QUERY);
  const shownPlaceholder = compact && compactPlaceholder ? compactPlaceholder : placeholder;
  const inputId = id ?? `s-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const noteId = `${inputId}-note`;
  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label htmlFor={inputId}>{label}</label>
      <div className="field__control field__control--select">
        <select
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? noteId : undefined}
          {...rest}
        >
          {shownPlaceholder ? (
            <option value="">{shownPlaceholder}</option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <FieldNote id={noteId} hint={hint} error={error} />
    </div>
  );
}

// ─── Zone de texte ───────────────────────────────────────
interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export function TextAreaField({ label, hint, error, id, className, ...rest }: TextAreaFieldProps) {
  const inputId = id ?? `t-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const noteId = `${inputId}-note`;
  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label htmlFor={inputId}>{label}</label>
      <div className="field__control">
        <textarea
          id={inputId}
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? noteId : undefined}
          {...rest}
        />
      </div>
      <FieldNote id={noteId} hint={hint} error={error} />
    </div>
  );
}

// ─── Couleur (code hexadécimal + sélecteur natif) ────────
interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string | null;
}

export function ColorField({ id, label, value, fallback, onChange, hint, error }: ColorFieldProps) {
  const noteId = `${id}-note`;
  const swatch = HEX_COLOR.test(value) ? value : fallback;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__control color-field">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="#059669"
          maxLength={9}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? noteId : undefined}
        />
        <input
          type="color"
          className="color-field__picker"
          value={swatch.toLowerCase()}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} : choisir dans la palette`}
        />
      </div>
      <FieldNote id={noteId} hint={hint} error={error} />
    </div>
  );
}

// ─── Copier dans le presse-papiers ───────────────────────
export function CopyButton({ value, label = 'Copier' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : la valeur reste
      // affichée et sélectionnable, l'utilisateur peut la copier à la main.
      setCopied(false);
    }
  }

  return (
    <button type="button" className="copy-btn" onClick={() => void copy()} aria-live="polite">
      <Icon name={copied ? 'check' : 'copy'} size={16} />
      <span>{copied ? 'Copié' : label}</span>
    </button>
  );
}

// ─── Boîte de confirmation ───────────────────────────────
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** « danger » colore le bouton de confirmation en rouge. */
  tone?: 'default' | 'danger';
  busy?: boolean;
  /** Masque le bouton d'annulation (boîte d'information : un seul bouton pour fermer). */
  hideCancel?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Annuler',
  tone = 'default',
  busy = false,
  hideCancel = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        // Échap : on ferme via l'état du parent, jamais pendant une requête en cours.
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onCancel();
      }}
    >
      <div className="dialog__body">
        <h2 id="dialog-title">{title}</h2>
        {children ? <div className="dialog__content">{children}</div> : null}
        <div className="dialog__actions">
          {hideCancel ? null : (
            <Button variant="secondary" onClick={onCancel} disabled={busy}>
              {cancelLabel}
            </Button>
          )}
          <Button
            variant="primary"
            className={tone === 'danger' ? 'btn--danger' : undefined}
            onClick={onConfirm}
            busy={busy}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
