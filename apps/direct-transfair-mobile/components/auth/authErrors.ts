// apps/direct-transfair-mobile/components/auth/authErrors.ts
// =========================================================
// MESSAGES D'ERREUR D'AUTHENTIFICATION v1.2 — Direct Transf'air
// ✅ v1.2 : textes FR / EN / PT (i18n/messages/auth.ts) — la langue suit le choix de l'utilisateur ; le message du serveur arrive déjà traduit (Accept-Language).
// ✅ v1.1 : sur navigateur, « aucune réponse » n'affiche plus « vérifiez votre connexion internet » (trompeur :
//    serveur en veille/arrêté ou CORS) mais un message exact avec l'adresse de la page. Mobile inchangé.
// Développé par Thierno Doniko (Grand Chef) — Doniko Digital.
// Transforme n'importe quelle erreur (réseau, timeout, serveur qui
// dort, mauvais identifiants, quota…) en un message clair en français,
// avec un type exploitable par l'écran. Plus jamais un « Network
// Error » ou un « Application not found » brut devant le client.
// =========================================================

import { tr } from '../../i18n/runtime';

export type AuthErrorKind =
  | 'network'      // serveur injoignable / pas de connexion
  | 'timeout'      // le serveur met trop de temps (démarrage à froid)
  | 'server'       // 5xx
  | 'config'       // mauvaise URL de serveur (réponse qui n'est pas notre API)
  | 'credentials'  // email / mot de passe incorrect
  | 'rate_limit'   // trop de tentatives
  | 'conflict'     // compte déjà existant
  | 'validation'   // données refusées par le serveur
  | 'forbidden'    // accès refusé (compte suspendu, portail web…)
  | 'unknown';

export type AuthErrorInfo = {
  kind: AuthErrorKind;
  title: string;
  message: string;
  /** Code métier renvoyé par le backend (USE_WEB_PORTAL, VERIFICATION_REQUIRED…). */
  code?: string;
  status?: number;
};

function asRecord(v: unknown): Record<string, any> | null {
  return typeof v === 'object' && v !== null ? (v as Record<string, any>) : null;
}

/** Message textuel renvoyé par le backend (string ou tableau de class-validator). */
export function serverMessage(err: unknown): string | null {
  const e = asRecord(err);
  const data = asRecord(e?.response?.data);
  if (!data) return null;
  const raw = data.message ?? data.error;
  if (Array.isArray(raw)) return raw.length ? String(raw[0]) : null;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

/** Vrai pour une panne passagère qu'on peut retenter (réseau coupé, timeout, 502/503/504). */
export function isTransientError(err: unknown): boolean {
  const e = asRecord(err);
  if (!e) return false;
  if (e.response === undefined || e.response === null) {
    // pas de réponse : réseau, DNS, timeout — mais pas une erreur de programmation
    return e.isAxiosError === true || e.code === 'ECONNABORTED' || e.code === 'ERR_NETWORK' || /network|timeout/i.test(String(e.message ?? ''));
  }
  const s = Number(e.response.status);
  return s === 502 || s === 503 || s === 504;
}

/** Message d'Express/Nest quand aucune route ne correspond. */
const NO_ROUTE_RE = /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \//i;

export function describeAuthError(err: unknown, ctx: 'login' | 'register' | 'otp' | 'reset' | 'generic' = 'generic'): AuthErrorInfo {
  const e = asRecord(err);
  const status: number | undefined = typeof e?.response?.status === 'number' ? e.response.status : undefined;
  const data = asRecord(e?.response?.data);
  const code: string | undefined = typeof data?.code === 'string' ? data.code : undefined;
  const srv = serverMessage(err);

  // Pas de réponse HTTP : réseau ou timeout.
  if (status === undefined) {
    const isTimeout = e?.code === 'ECONNABORTED' || /timeout/i.test(String(e?.message ?? ''));
    if (isTimeout) {
      return { kind: 'timeout', title: tr('err.timeout.title'), message: tr('err.timeout.msg') };
    }
    // Navigateur : une erreur sans statut HTTP n'est pas forcément une coupure internet — le serveur peut
    // être en veille / en panne (réponse d'hébergeur sans en-têtes CORS) ou refuser cette adresse (CORS).
    if (typeof document !== 'undefined') {
      return {
        kind: 'network',
        title: tr('err.web.title'),
        message: tr('err.web.msg', { host: typeof window !== 'undefined' ? window.location.host : tr('err.web.thisPage') }),
      };
    }
    return { kind: 'network', title: tr('err.network.title'), message: tr('err.network.msg') };
  }

  // Route inconnue du serveur (« Cannot GET /api/… ») : le serveur n'a pas encore la version qui apporte cette fonction.
  if (status === 404 && NO_ROUTE_RE.test(srv ?? '')) {
    return { kind: 'config', title: tr('err.noRoute.title'), message: tr('err.noRoute.msg'), status };
  }
  // Fichier ou image refusé pour sa taille avant même d'atteindre l'application serveur.
  if (status === 413) {
    return { kind: 'validation', title: tr('err.tooLarge.title'), message: tr('err.tooLarge.msg'), status };
  }

  // Réponse qui n'est pas celle de notre API (page d'hébergeur, HTML…).
  const looksForeign =
    typeof e?.response?.data === 'string' ||
    (/application not found|not found|bad gateway|service unavailable/i.test(srv ?? '') && !code);
  if ((status === 404 || status === 502 || status === 503) && looksForeign) {
    return {
      kind: status === 404 ? 'config' : 'server',
      title: status === 404 ? tr('err.notFoundServer.title') : tr('err.unavailable.title'),
      message: status === 404 ? tr('err.notFoundServer.msg') : tr('err.unavailable.restarting'),
      status,
    };
  }

  if (code === 'USE_WEB_PORTAL' || code === 'USE_COMPANY_PORTAL' || code === 'USE_DEFAULT_PORTAL' || code === 'VERIFICATION_REQUIRED') {
    return {
      kind: 'forbidden',
      title: code === 'USE_WEB_PORTAL' ? tr('err.webPortal.title') : tr('err.restricted.title'),
      message: srv ?? tr('err.restricted.msg'),
      code,
      status,
    };
  }

  if (status === 429) {
    return { kind: 'rate_limit', title: tr('err.rateLimit.title'), message: tr('err.rateLimit.msg'), status };
  }
  if (status >= 500) {
    return { kind: 'server', title: tr('err.unavailable.title'), message: tr('err.unavailable.incident'), status };
  }
  if (status === 401) {
    return ctx === 'login'
      ? { kind: 'credentials', title: tr('err.credentials.title'), message: srv && !/unauthorized/i.test(srv) ? srv : tr('err.credentials.msg'), status }
      : { kind: 'forbidden', title: tr('err.session.title'), message: tr('err.session.msg'), status };
  }
  if (status === 409) {
    return { kind: 'conflict', title: tr('err.conflict.title'), message: srv ?? tr('err.conflict.msg'), status };
  }
  if (status === 403) {
    return { kind: 'forbidden', title: tr('err.forbidden.title'), message: srv ?? tr('err.forbidden.msg'), status };
  }
  if (status === 404 && ctx === 'reset') {
    return { kind: 'validation', title: tr('err.accountNotFound.title'), message: tr('err.accountNotFound.msg'), status };
  }
  if (status === 400 || status === 404 || status === 422) {
    const title = ctx === 'otp' ? tr('err.otpWrong.title') : tr('err.fix.title');
    return { kind: 'validation', title, message: srv ?? tr('err.fix.msg'), status };
  }
  return { kind: 'unknown', title: tr('err.fallbackTitle'), message: srv ?? tr('err.fallbackMsg'), status };
}
