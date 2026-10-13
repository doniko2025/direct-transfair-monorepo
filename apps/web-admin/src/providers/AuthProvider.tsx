// src/providers/AuthProvider.tsx
// =========================================================
// AUTH PROVIDER v1.1
// ✅ v1.1 : loginWithAssertion() — connexion unique depuis la console dkmoney.store (POST /auth/platform-sso).
//   Passe par acceptSession() comme le login : mêmes contrôles (rôle web, profil complet).
//
//
// - Restaure la session au chargement (GET /auth/me ; le refresh
//   automatique sur 401 est géré par le client HTTP partagé).
// - login() : POST /auth/v2/login-password. Trois issues :
//     success       → session ouverte
//     verification  → email/téléphone à vérifier (écran dédié)
//     client-account→ compte client : refusé sur le web, session
//                     fermée immédiatement côté serveur
// - Cohérence portail : un SUPER_ADMIN n'est accepté que sur le portail
//   plateforme, les autres rôles que sur le portail de leur société
//   (le backend l'impose déjà au login ; on le revérifie à la restauration).
// =========================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ApiError,
  PLATFORM_TENANT,
  isVerificationNeeded,
  isWebRole,
  normalizeTenantCode,
  type AuthUser,
  type LoginResult,
  type VerificationNeeded,
} from '@direct-transfair/shared';
import { api, onSessionExpired, storage } from '../lib/api';
import { useTenant } from './TenantProvider';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; notice: string | null }
  | { status: 'authenticated'; user: AuthUser };

export type LoginOutcome =
  | { kind: 'success' }
  | { kind: 'verification'; pending: VerificationNeeded }
  | { kind: 'client-account' };

interface AuthContextValue {
  state: AuthState;
  user: AuthUser | null;
  login(email: string, password: string): Promise<LoginOutcome>;
  /** Connexion unique : échange l'assertion signée de la console contre une session (lève ApiError si refusée). */
  loginWithAssertion(assertion: string): Promise<LoginOutcome>;
  logout(): Promise<void>;
  dismissNotice(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function portalMatches(user: AuthUser, tenantCode: string): boolean {
  if (user.role === 'SUPER_ADMIN') return tenantCode === PLATFORM_TENANT;
  const companyCode = normalizeTenantCode(user.client?.code);
  return companyCode !== null && companyCode === tenantCode;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const tenant = useTenant();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  // ── Restauration de session ───────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!storage.getAccessToken() && !storage.getRefreshToken()) {
        setState({ status: 'anonymous', notice: null });
        return;
      }
      try {
        const me = await api.auth.me();
        if (cancelled) return;

        if (!isWebRole(me.role)) {
          storage.clear();
          setState({
            status: 'anonymous',
            notice: "Ce compte est un compte client : utilisez l'application mobile.",
          });
          return;
        }
        if (!portalMatches(me, tenant.code)) {
          storage.clear();
          setState({
            status: 'anonymous',
            notice: 'Cette session appartient à un autre espace. Reconnectez-vous ici.',
          });
          return;
        }
        setState({ status: 'authenticated', user: me });
      } catch (err) {
        if (cancelled) return;

        // Panne passagère (réseau coupé, serveur qui redémarre, délai dépassé) :
        // on NE vide PAS la session, sinon une simple coupure déconnecterait
        // l'utilisateur. Seul un refus d'authentification la détruit.
        const transient = err instanceof ApiError && (err.status === 0 || err.status >= 500);
        if (transient) {
          setState({
            status: 'anonymous',
            notice:
              'Impossible de vérifier votre session pour le moment. Rechargez la page, ou reconnectez-vous.',
          });
          return;
        }

        storage.clear();
        setState({ status: 'anonymous', notice: null });
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [tenant.code]);

  // ── Session perdue (refresh refusé) ───────────────────
  useEffect(
    () =>
      onSessionExpired(() =>
        setState({ status: 'anonymous', notice: 'Votre session a expiré. Reconnectez-vous.' }),
      ),
    [],
  );

  const acceptSession = useCallback(async (result: LoginResult): Promise<LoginOutcome> => {
    storage.setTokens(result.access_token, result.refresh_token ?? null);

    if (!isWebRole(result.user.role)) {
      // Compte client : on referme la session que le serveur vient d'ouvrir.
      try {
        await api.auth.logout();
      } catch {
        /* le serveur invalidera le token à expiration */
      } finally {
        storage.clear();
      }
      return { kind: 'client-account' };
    }

    // Profil complet (société, agence…) ; si l'appel échoue on garde celui du login.
    let user: AuthUser = result.user;
    try {
      user = { ...result.user, ...(await api.auth.me()) };
    } catch {
      /* profil du login conservé */
    }

    setState({ status: 'authenticated', user });
    return { kind: 'success' };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginOutcome> => {
      const result = await api.auth.loginPassword(email.trim(), password);
      if (isVerificationNeeded(result)) return { kind: 'verification', pending: result };
      return acceptSession(result);
    },
    [acceptSession],
  );

  const loginWithAssertion = useCallback(
    async (assertion: string): Promise<LoginOutcome> => {
      const result = await api.auth.platformSso(assertion);
      return acceptSession(result);
    },
    [acceptSession],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* déconnexion locale quoi qu'il arrive */
    } finally {
      storage.clear();
      setState({ status: 'anonymous', notice: null });
    }
  }, []);

  const dismissNotice = useCallback(() => {
    setState((s) => (s.status === 'anonymous' ? { status: 'anonymous', notice: null } : s));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      user: state.status === 'authenticated' ? state.user : null,
      login,
      loginWithAssertion,
      logout,
      dismissNotice,
    }),
    [state, login, loginWithAssertion, logout, dismissNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth doit être utilisé dans <AuthProvider>.');
  return value;
}

/** Utilisateur connecté — à utiliser uniquement sous <RequireAuth>. */
export function useCurrentUser(): AuthUser {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser appelé sans session ouverte.');
  return user;
}
