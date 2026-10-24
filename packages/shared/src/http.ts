// packages/shared/src/http.ts
// =========================================================
// CLIENT HTTP v1.1 — fetch natif, sans dépendance
//
// Reproduit le comportement utile de services/api.ts (mobile) :
//   - préfixe /api
//   - en-tête x-tenant-id sur chaque requête
//   - en-tête x-app-client (optionnel) : le portail web envoie « web » ;
//     le backend refuse les rôles SUPER_ADMIN / COMPANY_ADMIN / AGENT
//     (login, OTP, refresh) sans cet en-tête — voir
//     apps/backend/src/auth/app-client.policy.ts
//   - Authorization: Bearer <access_token>
//   - sur 401 : UN refresh (POST /auth/refresh), partagé entre les
//     requêtes concurrentes, puis rejeu de la requête
//   - si le refresh échoue : tokens effacés + onSessionExpired()
//
// Le stockage des tokens est injecté (TokenStorage) : le web-admin
// fournit aujourd'hui un stockage navigateur ; on pourra le remplacer
// par des cookies httpOnly sans toucher à ce fichier.
// =========================================================

import type { RefreshResult } from './types';

export interface TokenStorage {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(access: string, refresh?: string | null): void;
  clear(): void;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly data: unknown;

  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export interface HttpClientOptions {
  /** Racine du backend, avec ou sans le suffixe /api. */
  baseUrl: string;
  storage: TokenStorage;
  /** Code du tenant courant (en-tête x-tenant-id). null = ne pas l'envoyer. */
  getTenant: () => string | null;
  /** Valeur de l'en-tête x-app-client (« web » pour le web-admin). Absent = non envoyé. */
  appClient?: string;
  onSessionExpired?: () => void;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /** false = pas d'Authorization ni de refresh (routes publiques). Défaut : true. */
  auth?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** « blob » : renvoie le corps tel quel (PDF…) au lieu de l'interpréter comme du JSON. Défaut : « json ». */
  responseType?: 'json' | 'blob';
}

export interface HttpClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  delete<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
}

/** Routes sur lesquelles un 401 ne doit JAMAIS déclencher un refresh. */
const NO_REFRESH_PREFIXES = ['/auth/login', '/auth/v2/', '/auth/refresh', '/auth/register'];

const DEFAULT_TIMEOUT_MS = 20_000;

export function buildApiBase(baseUrl: string): string {
  return `${baseUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '')}/api`;
}

function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
    if (Array.isArray(message)) {
      const parts = message.filter((m): m is string => typeof m === 'string');
      if (parts.length > 0) return parts.join(' ; ');
    }
  }
  return fallback;
}

function extractCode(body: unknown): string | undefined {
  if (body && typeof body === 'object') {
    const code = (body as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const base = buildApiBase(options.baseUrl);
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let refreshInFlight: Promise<string> | null = null;

  async function send(path: string, opts: RequestOptions, accessToken: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };

    const tenant = options.getTenant();
    if (tenant) headers['x-tenant-id'] = tenant;
    if (options.appClient) headers['x-app-client'] = options.appClient;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    Object.assign(headers, opts.headers);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onExternalAbort);

    try {
      const init: RequestInit = {
        method: opts.method ?? 'GET',
        headers,
        signal: controller.signal,
      };
      if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
      return await doFetch(`${base}${path}`, init);
    } catch (err) {
      if (controller.signal.aborted && !opts.signal?.aborted) {
        throw new ApiError(
          'Le serveur met trop de temps à répondre. Réessayez dans un instant.',
          0,
          'TIMEOUT',
        );
      }
      if (opts.signal?.aborted) throw err;
      throw new ApiError(
        'Impossible de joindre le serveur. Vérifiez votre connexion internet.',
        0,
        'NETWORK',
      );
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  async function parse<T>(res: Response, responseType: 'json' | 'blob' = 'json'): Promise<T> {
    if (responseType === 'blob' && res.ok) return (await res.blob()) as unknown as T;
    const text = await res.text();
    let body: unknown = undefined;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!res.ok) {
      throw new ApiError(
        extractMessage(body, `Erreur ${res.status}`),
        res.status,
        extractCode(body),
        body,
      );
    }
    return body as T;
  }

  function refreshOnce(): Promise<string> {
    if (refreshInFlight) return refreshInFlight;

    const refreshToken = options.storage.getRefreshToken();
    if (!refreshToken) return Promise.reject(new ApiError('Session expirée', 401, 'NO_REFRESH_TOKEN'));

    refreshInFlight = (async () => {
      const res = await send(
        '/auth/refresh',
        { method: 'POST', body: { refresh_token: refreshToken }, auth: false },
        null,
      );
      const data = await parse<RefreshResult>(res);
      if (!data?.access_token) throw new ApiError('Réponse de rafraîchissement invalide', 500);
      options.storage.setTokens(data.access_token, data.refresh_token ?? refreshToken);
      return data.access_token;
    })().finally(() => {
      refreshInFlight = null;
    });

    return refreshInFlight;
  }

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const useAuth = opts.auth !== false;
    const token = useAuth ? options.storage.getAccessToken() : null;

    const res = await send(path, opts, token);

    const canRefresh =
      useAuth &&
      res.status === 401 &&
      !NO_REFRESH_PREFIXES.some((prefix) => path.startsWith(prefix));

    if (!canRefresh) return parse<T>(res, opts.responseType);

    try {
      const fresh = await refreshOnce();
      const retry = await send(path, opts, fresh);
      return parse<T>(retry, opts.responseType);
    } catch (err) {
      // Le refresh a échoué (ou le rejeu est encore refusé en 401) : la session est perdue.
      if (!(err instanceof ApiError) || err.status === 401) {
        options.storage.clear();
        options.onSessionExpired?.();
      }
      throw err;
    }
  }

  return {
    request,
    get: (path, o) => request(path, { ...o, method: 'GET' }),
    post: (path, body, o) => request(path, { ...o, method: 'POST', body }),
    patch: (path, body, o) => request(path, { ...o, method: 'PATCH', body }),
    delete: (path, o) => request(path, { ...o, method: 'DELETE' }),
  };
}
