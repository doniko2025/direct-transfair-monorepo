// src/components/Guards.tsx
// RequireAuth : session obligatoire (sinon /login, avec retour à la page demandée).
// RequireRole : page réservée à certains rôles.
//
// ⚠️ Ces gardes améliorent l'expérience, elles ne sécurisent rien : la
// vraie protection reste côté backend (JwtAuthGuard + contrôle du rôle).

import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { WEB_ROLES, isWebRole, type WebRole } from '@direct-transfair/shared';
import { useAuth } from '../providers/AuthProvider';
import { Button, LoadingScreen, ScreenState } from './ui';

export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') return <LoadingScreen label="Vérification de votre session…" />;
  if (state.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

export function RequireRole({
  roles = WEB_ROLES,
  children,
}: {
  roles?: readonly WebRole[];
  children: ReactNode;
}) {
  const { user, logout } = useAuth();

  if (!user || !isWebRole(user.role) || !roles.includes(user.role)) {
    return (
      <ScreenState
        title="Accès non autorisé"
        icon="shield"
        actions={
          <Button variant="secondary" onClick={() => void logout()}>
            Changer de compte
          </Button>
        }
      >
        <p>Cette page n'est pas disponible pour votre profil.</p>
      </ScreenState>
    );
  }
  return <>{children}</>;
}
