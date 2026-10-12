// src/components/AppShell.tsx
// Cadre de l'application : panneau latéral flottant (bureau) ou tiroir (mobile).

import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { WebRole } from '@direct-transfair/shared';
import { ROLE_LABEL, navFor } from '../navigation';
import { useCurrentUser, useAuth } from '../providers/AuthProvider';
import { useTenant } from '../providers/TenantProvider';
import { BrandMark } from './BrandMark';
import { Icon } from './Icon';

function displayName(first?: string | null, last?: string | null, email?: string): string {
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || email || 'Mon compte';
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? '?';
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (a + b).toUpperCase();
}

export function AppShell() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const { branding } = useTenant();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Referme le tiroir à chaque navigation.
  useEffect(() => setOpen(false), [location.pathname]);

  // Échap referme le tiroir.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const role = user.role as WebRole;
  const items = navFor(role);
  const name = displayName(user.firstName, user.lastName, user.email);

  return (
    <div className="shell">
      <header className="topbar">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={open}
          aria-controls="sidebar"
        >
          <Icon name="menu" />
        </button>
        <div className="topbar__brand">
          <BrandMark name={branding.name} logoUrl={branding.logoUrl} size={30} />
          <span>{branding.name}</span>
        </div>
      </header>

      <div className="scrim" data-open={open} onClick={() => setOpen(false)} aria-hidden="true" />

      <aside id="sidebar" className="sidebar" data-open={open} aria-label="Navigation principale">
        <div className="sidebar__brand">
          <BrandMark name={branding.name} logoUrl={branding.logoUrl} size={40} />
          <div>
            <strong>{branding.name}</strong>
            <span>{ROLE_LABEL[role]}</span>
          </div>
          <button
            type="button"
            className="icon-btn sidebar__close"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="sidebar__nav">
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                {item.ready ? (
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
                  >
                    <Icon name={item.icon} size={19} />
                    <span>{item.label}</span>
                  </NavLink>
                ) : (
                  <span className="nav-item is-soon" aria-disabled="true">
                    <Icon name={item.icon} size={19} />
                    <span>{item.label}</span>
                    <em>Bientôt</em>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar__user">
          <span className="avatar" aria-hidden="true">
            {initials(name)}
          </span>
          <div className="sidebar__user-text">
            <strong title={name}>{name}</strong>
            <span title={user.email}>{user.email}</span>
          </div>
          <button type="button" className="icon-btn" onClick={() => void logout()} aria-label="Se déconnecter" title="Se déconnecter">
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <main className="main" id="contenu">
        <Outlet />
      </main>
    </div>
  );
}
