// src/components/FilterTabs.tsx
// Filtre à choix unique : onglets sur grand écran, liste déroulante sur mobile.
// Les deux sont rendus et le CSS (styles/mobile-layout.css) n'affiche que le bon : sur mobile,
// la liste vient se ranger sur la même ligne que les autres filtres, au lieu de
// plusieurs rangées d'onglets qui s'empilent.

import { SelectField } from './form';

export interface FilterTabOption<T extends string> {
  id: T;
  label: string;
  /** Compteur affiché à côté du libellé (onglets) et entre parenthèses (liste). */
  count?: number;
}

interface FilterTabsProps<T extends string> {
  /** Nom du filtre : lu par les lecteurs d'écran, jamais affiché sur la liste mobile. */
  label: string;
  /** Identifiant unique de la liste déroulante mobile. */
  id: string;
  options: readonly FilterTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Grand écran : les onglets occupent une rangée à eux seuls, sous la barre d'outils. */
  rowOnDesktop?: boolean;
}

export function FilterTabs<T extends string>({ label, id, options, value, onChange, rowOnDesktop = false }: FilterTabsProps<T>) {
  return (
    <>
      <div className={rowOnDesktop ? 'tabs tabs--row tabs--desktop' : 'tabs tabs--desktop'} role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" className="tab" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
            {o.label}
            {o.count !== undefined ? <span>{o.count}</span> : null}
          </button>
        ))}
      </div>
      <SelectField
        id={id}
        label={label}
        className="toolbar__select toolbar__select--tabs"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        options={options.map((o) => ({ value: o.id, label: o.count !== undefined ? `${o.label} (${o.count})` : o.label }))}
      />
    </>
  );
}
