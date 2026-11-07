// src/pages/settings/SettingsKit.tsx
// Petites briques communes de la page Réglages : groupe repliable, bouton-icône, journal compact d'une ligne par modification.

import { useEffect, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import { Notice, Spinner } from '../../components/ui';
import { describeError } from '../../lib/errors';
import { fullDate, when } from '../../lib/supervisionRules';
import type { Resource } from '../../lib/useResource';

// ─── Groupe repliable : titre + résumé d'une ligne, le détail s'ouvre au toucher ───
interface SetGroupProps {
  id?: string;
  icon: IconName;
  title: string;
  /** Résumé affiché sous le titre quand le groupe est replié (ex. « 2 modes gratuits »). */
  summary?: string;
  /** Pastille d'alerte (ex. une erreur de saisie dans le groupe). */
  alert?: boolean;
  defaultOpen?: boolean;
  /** Ouvre le groupe dès que la valeur passe à vrai (ex. erreur de validation à corriger). */
  forceOpen?: boolean;
  children: ReactNode;
}

export function SetGroup({ id, icon, title, summary, alert = false, defaultOpen = false, forceOpen = false, children }: SetGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);
  return (
    <details id={id} className="set-group" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="set-group__sum">
        <span className="set-group__icon" aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
        <span className="set-group__text">
          <strong>{title}</strong>
          {summary ? <small>{summary}</small> : null}
        </span>
        {alert ? <span className="set-group__alert" role="img" aria-label="À corriger" /> : null}
        <span className="set-group__chev" aria-hidden="true">
          <Icon name="chevronRight" size={16} />
        </span>
      </summary>
      <div className="set-group__body">{children}</div>
    </details>
  );
}

// ─── Bouton rond avec icône (Modifier, Rétablir…) ───
export function IconBtn({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="set-iconbtn" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      <Icon name={icon} size={17} />
    </button>
  );
}

// ─── Interrupteur avec explication (une ligne : texte à gauche, bouton à droite) ───
export function SwitchRow({
  checked,
  onChange,
  disabled,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <label className="set-switch">
      <span className="set-switch__text">
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

// ─── Journal compact ───
export interface LogLine {
  /** Libellé de la valeur changée (ex. « Par envoi »). */
  label?: string;
  from?: string | null;
  to: string;
}

export interface LogItem {
  id: string;
  title: string;
  createdAt: string;
  user: string | null;
  lines: LogLine[];
}

interface ChangeLogProps<T> {
  resource: Resource<{ data: T[] }>;
  toItem: (c: T) => LogItem;
  title?: string;
  emptyText: string;
}

/** Une modification = un bloc de 2-3 lignes : titre + date, valeurs changées (ancienne → nouvelle), auteur. */
export function ChangeLog<T>({ resource, toItem, title = 'Historique', emptyText }: ChangeLogProps<T>) {
  const { data, error, loading, reload } = resource;
  const items = (data?.data ?? []).map(toItem);
  const summary = loading && !data ? 'Chargement…' : items.length === 0 ? 'Aucune modification' : `${items.length} dernière${items.length > 1 ? 's' : ''} modification${items.length > 1 ? 's' : ''}`;
  return (
    <SetGroup icon="list" title={title} summary={summary}>
      {loading && !data ? (
        <div className="center-block">
          <Spinner label="Chargement du journal" />
        </div>
      ) : error && !data ? (
        <Notice
          tone="error"
          title="Impossible de charger le journal"
          action={
            <button type="button" className="link-btn" onClick={reload}>
              Réessayer
            </button>
          }
        >
          {describeError(error).message}
        </Notice>
      ) : items.length === 0 ? (
        <p className="set-note">{emptyText}</p>
      ) : (
        <ul className="set-log">
          {items.map((c) => (
            <li key={c.id}>
              <div className="set-log__head">
                <strong>{c.title}</strong>
                <time className="muted" dateTime={c.createdAt} title={fullDate(c.createdAt)}>
                  {when(c.createdAt)}
                </time>
              </div>
              {c.lines.map((l, i) => (
                <p key={i} className="set-log__line">
                  {l.label ? <span className="set-log__label">{l.label}</span> : null}
                  {l.from ? (
                    <>
                      <span className="muted">{l.from}</span>
                      <Icon name="chevronRight" size={14} />
                    </>
                  ) : null}
                  <strong>{l.to}</strong>
                </p>
              ))}
              <span className="muted set-log__by">Par {c.user ?? 'un administrateur'}</span>
            </li>
          ))}
        </ul>
      )}
    </SetGroup>
  );
}

// ─── État de chargement / d'erreur d'une section ───
export function SectionState({
  resource,
  loadingLabel,
  errorTitle,
}: {
  resource: Resource<unknown>;
  loadingLabel: string;
  errorTitle: string;
}) {
  if (resource.loading && !resource.data) {
    return (
      <div className="center-block">
        <Spinner label={loadingLabel} />
      </div>
    );
  }
  if (resource.error && !resource.data) {
    return (
      <Notice
        tone="error"
        title={errorTitle}
        action={
          <button type="button" className="link-btn" onClick={resource.reload}>
            Réessayer
          </button>
        }
      >
        {describeError(resource.error).message}
      </Notice>
    );
  }
  return null;
}
