// src/providers/TenantProvider.tsx
// =========================================================
// TENANT PROVIDER v1.0
//
// Détermine « quel portail est ouvert » avant d'afficher quoi que ce soit :
//   1. ?tenant=CODE (dev, ou prod si VITE_ALLOW_TENANT_QUERY=true)
//   2. VITE_TENANT_CODE (test)
//   3. localhost / IP            → portail plateforme
//   4. GET /branding/by-host     → société trouvée par domaine personnalisé
//                                  ou sous-domaine
//   5. hôte inconnu              → portail plateforme (ou « Portail
//                                  introuvable » si VITE_PLATFORM_HOSTS est défini
//                                  et ne contient pas cet hôte)
//
// Les enfants ne sont rendus qu'une fois le tenant résolu : useTenant()
// renvoie donc toujours une valeur complète.
// =========================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  ApiError,
  PLATFORM_TENANT,
  isLocalHost,
  normalizeHost,
  normalizeTenantCode,
  type TenantBranding,
} from '@direct-transfair/shared';
import { ALLOW_TENANT_QUERY, API_CONFIGURED, API_URL, FIXED_TENANT, PLATFORM_HOSTS } from '../config';
import { api, setCurrentTenant } from '../lib/api';
import { applyBranding, platformBranding } from '../lib/branding';
import { Button, LoadingScreen, ScreenState } from '../components/ui';

export interface TenantValue {
  /** Code envoyé dans x-tenant-id. */
  code: string;
  branding: TenantBranding;
  /** true = portail plateforme (super admin), false = portail d'une société. */
  isPlatform: boolean;
}

type Resolution =
  | { kind: 'ready'; value: TenantValue }
  | { kind: 'not-found'; host: string };

type State =
  | { status: 'loading' }
  | { status: 'ready'; value: TenantValue }
  | { status: 'not-found'; host: string }
  | { status: 'error'; message: string };

const TenantContext = createContext<TenantValue | null>(null);

function platformValue(): TenantValue {
  return { code: PLATFORM_TENANT, branding: platformBranding(), isPlatform: true };
}

function companyValue(branding: TenantBranding): TenantValue {
  const code = normalizeTenantCode(branding.code);
  if (!code) throw new Error('Le portail renvoie un code société invalide.');
  return { code, branding, isPlatform: code === PLATFORM_TENANT };
}

function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 404 || err.status === 400);
}

async function resolveTenant(): Promise<Resolution> {
  const host = normalizeHost(window.location.hostname);

  const fromQuery = ALLOW_TENANT_QUERY
    ? normalizeTenantCode(new URLSearchParams(window.location.search).get('tenant'))
    : null;
  const forced = fromQuery ?? FIXED_TENANT;

  if (forced) {
    if (forced === PLATFORM_TENANT) return { kind: 'ready', value: platformValue() };
    try {
      return { kind: 'ready', value: companyValue(await api.branding.byCode(forced)) };
    } catch (err) {
      if (isNotFound(err)) return { kind: 'not-found', host: forced };
      throw err;
    }
  }

  if (isLocalHost(host)) return { kind: 'ready', value: platformValue() };

  try {
    return { kind: 'ready', value: companyValue(await api.branding.byHost(host)) };
  } catch (err) {
    if (!isNotFound(err)) throw err;
    if (PLATFORM_HOSTS.length > 0 && !PLATFORM_HOSTS.includes(host)) {
      return { kind: 'not-found', host };
    }
    return { kind: 'ready', value: platformValue() };
  }
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!API_CONFIGURED) return;
    let cancelled = false;
    setState({ status: 'loading' });

    resolveTenant()
      .then((res) => {
        if (cancelled) return;
        if (res.kind === 'not-found') {
          setState({ status: 'not-found', host: res.host });
          return;
        }
        setCurrentTenant(res.value.code);
        applyBranding(res.value.branding);
        setState({ status: 'ready', value: res.value });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Erreur inattendue.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (!API_CONFIGURED) {
    return (
      <ScreenState title="Configuration manquante" icon="alert">
        <p>
          L'adresse du serveur n'est pas définie. Ajoutez la variable <code>VITE_API_URL</code> dans
          les paramètres de déploiement, puis redéployez.
        </p>
      </ScreenState>
    );
  }

  if (state.status === 'loading') return <LoadingScreen label="Ouverture de votre espace…" />;

  if (state.status === 'not-found') {
    return (
      <ScreenState title="Portail introuvable" icon="alert">
        <p>
          Aucun espace de gestion n'est associé à <strong>{state.host}</strong>. Vérifiez l'adresse
          saisie ou contactez l'administrateur de votre société.
        </p>
      </ScreenState>
    );
  }

  if (state.status === 'error') {
    return (
      <ScreenState
        title="Le serveur ne répond pas"
        icon="alert"
        actions={<Button onClick={retry}>Réessayer</Button>}
      >
        <p>{state.message}</p>
        <p className="muted">Serveur contacté : {safeHost(API_URL)}</p>
      </ScreenState>
    );
  }

  return <TenantContext.Provider value={state.value}>{children}</TenantContext.Provider>;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function useTenant(): TenantValue {
  const value = useContext(TenantContext);
  if (!value) throw new Error('useTenant doit être utilisé dans <TenantProvider>.');
  return value;
}
