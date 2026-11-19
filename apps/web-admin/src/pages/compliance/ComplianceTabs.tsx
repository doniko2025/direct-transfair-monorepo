// src/pages/compliance/ComplianceTabs.tsx
// Sous-menu commun aux écrans de conformité : Dossiers · Listes · Règles.
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/conformite', label: 'Dossiers', end: true },
  { to: '/conformite/listes', label: 'Listes de surveillance', end: false },
  { to: '/conformite/regles', label: 'Règles', end: false },
] as const;

export function ComplianceTabs() {
  return (
    <nav className="cmp-tabs" aria-label="Conformité">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `cmp-tab${isActive ? ' is-active' : ''}`}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
