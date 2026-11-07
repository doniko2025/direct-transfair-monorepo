// src/components/UserMenu.tsx
// Avatar de la barre du haut : menu compte (Mon compte, installer l'application, déconnexion).

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ROLE_LABEL } from '../navigation';
import { useInstallPrompt } from '../lib/useInstallPrompt';
import { useAuth, useCurrentUser } from '../providers/AuthProvider';
import type { WebRole } from '@direct-transfair/shared';
import { Icon } from './Icon';

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? '?';
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (a + b).toUpperCase();
}

export function UserMenu() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const { canInstall, install } = useInstallPrompt();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'Mon compte';

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  return (
    <div className="umenu" ref={rootRef}>
      <button type="button" className="umenu__btn" onClick={() => setOpen((v) => !v)} aria-label="Menu du compte" aria-haspopup="true" aria-expanded={open}>
        <span className="avatar avatar--sm" aria-hidden="true">
          {initials(name)}
        </span>
      </button>

      {open ? (
        <div className="umenu__panel" role="menu">
          <div className="umenu__who">
            <strong title={name}>{name}</strong>
            <span>{ROLE_LABEL[user.role as WebRole]}</span>
          </div>
          <Link to="/account" className="umenu__item" role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="user" size={18} />
            <span>Mon compte</span>
          </Link>
          {canInstall ? (
            <button
              type="button"
              className="umenu__item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void install();
              }}
            >
              <Icon name="download" size={18} />
              <span>Installer l'application</span>
            </button>
          ) : null}
          <button type="button" className="umenu__item umenu__item--danger" role="menuitem" onClick={() => void logout()}>
            <Icon name="logout" size={18} />
            <span>Se déconnecter</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
