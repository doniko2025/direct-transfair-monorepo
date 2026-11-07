// src/components/Guards.tsx
// RequireAuth : session obligatoire (sinon /login, avec retour à la page demandée). Mot de passe temporaire encore
// actif (`mustChangePassword`) : seul l'écran de changement est affiché (le serveur refuse de toute façon le reste).
// RequireRole : page réservée à certains rôles.
//
// ⚠️ Ces gardes améliorent l'expérience, elles ne sécurisent rien : la
// vraie protection reste côté backend (JwtAuthGuard + contrôle du rôle).

import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { WEB_ROLES, can, isWebRole, type SupportPermission, type WebRole } from '@direct-transfair/shared';
import { useAuth } from '../providers/AuthProvider';
import { ForcedPasswordChange } from './ForcedPasswordChange';
import { Button, LoadingScreen, ScreenState } from './ui';

export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') return <LoadingScreen label="Vérification de votre session…" />;
  if (state.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (state.user.mustChangePassword === true) return <ForcedPasswordChange />;
  return <Outlet />;
}

export function RequireRole({
  roles = WEB_ROLES,
  permission,
  children,
}: {
  roles?: readonly WebRole[];
  /** Lot 9 — délégation(s) du service client (une seule suffit). Les administrateurs passent toujours. */
  permission?: readonly SupportPermission[];
  children: ReactNode;
}) {
  const { user, logout } = useAuth();

  const roleOk = !!user && isWebRole(user.role) && roles.includes(user.role);
  const delegated = !permission || permission.length === 0 || (user ? can(user, ...permission) : false);

  if (roleOk && !delegated) {
    return (
      <ScreenState title="Action non déléguée" icon="shield">
        <p>Votre administrateur n'a pas activé cette fonction pour votre compte. Contactez-le pour en obtenir l'accès.</p>
      </ScreenState>
    );
  }

  if (!roleOk) {
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
