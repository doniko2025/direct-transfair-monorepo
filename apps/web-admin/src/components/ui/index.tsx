// src/components/ui/index.tsx
// Petits composants d'interface. Le back-office n'utilise JAMAIS de tableau :
// toute liste de données est une pile de cartes (voir Card).

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Icon, type IconName } from '../Icon';

// ─── Card ────────────────────────────────────────────────
// tone : "raised" (défaut, grande carte), "flat" (carte secondaire teintée, sans ombre)
interface CardProps extends HTMLAttributes<HTMLElement> {
  tone?: 'raised' | 'flat';
  as?: 'section' | 'article' | 'div';
}

export function Card({ tone = 'raised', as: Tag = 'section', className, ...rest }: CardProps) {
  return <Tag className={['card', `card--${tone}`, className].filter(Boolean).join(' ')} {...rest} />;
}

// ─── PageHeader ──────────────────────────────────────────
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

// ─── Button ──────────────────────────────────────────────
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  busy?: boolean;
  icon?: IconName;
  block?: boolean;
}

export function Button({
  variant = 'primary',
  busy = false,
  icon,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, block ? 'btn--block' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} disabled={disabled || busy} aria-busy={busy} {...rest}>
      {busy ? <span className="spinner spinner--inline" aria-hidden="true" /> : icon ? <Icon name={icon} size={18} /> : null}
      <span>{children}</span>
    </button>
  );
}

// ─── Field ───────────────────────────────────────────────
interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  /** Message d'erreur de validation : remplace l'aide et marque le champ invalide. */
  error?: string | null;
  trailing?: ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, trailing, id, className, ...rest },
  ref,
) {
  const inputId = id ?? `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const noteId = `${inputId}-note`;
  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label htmlFor={inputId}>{label}</label>
      <div className="field__control">
        <input
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? noteId : undefined}
          {...rest}
        />
        {trailing ? <div className="field__trailing">{trailing}</div> : null}
      </div>
      {error ? (
        <p className="field__error" id={noteId}>
          {error}
        </p>
      ) : hint ? (
        <p className="field__hint" id={noteId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
});

// ─── Pill ────────────────────────────────────────────────
export function Pill({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: 'neutral' | 'brand' | 'ok' | 'warn' | 'danger';
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <span className={`pill pill--${tone}`}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}

// ─── Notice ──────────────────────────────────────────────
export function Notice({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: 'info' | 'error' | 'ok';
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const icon: IconName = tone === 'error' ? 'alert' : tone === 'ok' ? 'check' : 'info';
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={icon} size={18} />
      <div className="notice__body">
        {title ? <strong>{title}</strong> : null}
        {children ? <p>{children}</p> : null}
        {action ? <div className="notice__action">{action}</div> : null}
      </div>
    </div>
  );
}

// ─── Spinner / écrans d'état ─────────────────────────────
export function Spinner({ label = 'Chargement' }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label} />;
}

export function ScreenState({
  title,
  children,
  actions,
  icon = 'info',
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: IconName;
}) {
  return (
    <main className="screen-state">
      <Card className="screen-state__card">
        <span className="screen-state__icon">
          <Icon name={icon} size={26} />
        </span>
        <h1>{title}</h1>
        {children ? <div className="screen-state__body">{children}</div> : null}
        {actions ? <div className="screen-state__actions">{actions}</div> : null}
      </Card>
    </main>
  );
}

export function LoadingScreen({ label = 'Chargement…' }: { label?: string }) {
  return (
    <main className="screen-state" aria-busy="true">
      <div className="loading-screen">
        <Spinner label={label} />
        <p>{label}</p>
      </div>
    </main>
  );
}
